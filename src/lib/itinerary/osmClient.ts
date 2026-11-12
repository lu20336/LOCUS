/**
 * Cliente de red para OpenStreetMap. El motor (generateItinerary.ts) no sabe
 * de dónde vienen los datos: recibe un OsmClient. createOsmClient habla
 * DIRECTO con Nominatim y Overpass usando fetch, tanto en el navegador como en
 * el script de prueba de Node. Para los tests se puede pasar un OsmClient
 * falso con datos de ejemplo.
 *
 * Política de uso de Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
 *  - Máximo 1 petición por segundo → cada servicio pasa por un throttle.
 *  - Identificar la app → en el navegador, el propio navegador envía el header
 *    Referer con el dominio de la app (no se puede fijar a mano); además
 *    agregamos el parámetro `email` de contacto. En Node (sin Referer) se
 *    envía también un User-Agent propio.
 *
 * Overpass (servidores públicos, saturados con frecuencia). Prioridad: que el
 * usuario NUNCA se quede esperando.
 *  - Cada intento tiene su propio límite de OVERPASS_ATTEMPT_TIMEOUT_MS
 *    (2,5 s, con AbortController). Un servidor que no conecta (sin código
 *    HTTP), un 429, un 504 o un error de red cuentan como intento fallido.
 *  - Si un intento falla, se pasa DE INMEDIATO al siguiente servidor, sin
 *    esperas: máximo OVERPASS_MAX_ATTEMPTS (2) intentos, es decir ≤ 5 s.
 *  - Los servidores que fallaron en los últimos 5 minutos se recuerdan en
 *    sessionStorage y se dejan al final de la lista en la siguiente búsqueda.
 *  - Throttle de 2,5 s entre peticiones al MISMO servidor.
 *  - Caché en sessionStorage (24 h): repetir una consulta no llama a Overpass.
 *  - overpass-api.de rechaza con 406 (sin cabecera CORS) los dominios
 *    *.web.app; por eso index.html redirige a *.firebaseapp.com.
 */
import type { CategoryId, Destination, GeoPoint, Place } from '../../types/itinerary'
import { OsmHttpError } from './errors'
import {
  buildActivityCountQuery,
  buildNominatimUrl,
  buildOverpassQuery,
  parseActivityCounts,
  parseNominatimResponse,
  parseOverpassResponse,
  type NominatimResult,
  type OverpassResponse,
} from './osm'
import {
  createSessionCache,
  createSessionFailureMemory,
  type OverpassCache,
  type ServerFailureMemory,
} from './overpassCache'
import { createThrottle } from './throttle'

export interface OsmClient {
  /** Devuelve el destino geocodificado o null si Nominatim no lo encuentra. */
  geocode(query: string): Promise<Destination | null>
  /** Devuelve los lugares encontrados (de todas las categorías pedidas). */
  findPlaces(center: GeoPoint, radiusMeters: number, categories: CategoryId[]): Promise<Place[]>
}

/**
 * Cliente real: además de lo que necesita el motor, permite enviar cualquier
 * consulta Overpass y contar actividades (los usa suggestDestination.ts).
 */
export interface FullOsmClient extends OsmClient {
  queryOverpass(query: string): Promise<OverpassResponse>
  /** Para cada punto, qué categorías tienen al menos un lugar cerca (una sola consulta). */
  checkActivities(centers: GeoPoint[], radiusMeters: number, categories: CategoryId[]): Promise<CategoryId[][]>
}

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

/**
 * Servidores Overpass, en orden de preferencia. Todos son réplicas públicas
 * de la misma API con los mismos datos de OpenStreetMap.
 */
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

/** Límite de cada intento: si se cumple, el intento se da por fallido. */
export const OVERPASS_ATTEMPT_TIMEOUT_MS = 2500

/** Intentos por consulta (cada uno en un servidor distinto): 2 × 2,5 s = 5 s como máximo. */
export const OVERPASS_MAX_ATTEMPTS = 2

/** Espera mínima entre dos peticiones al mismo servidor Overpass. */
export const OVERPASS_MIN_INTERVAL_MS = 2500

/** ¿Vale la pena probar otro servidor después de este error? */
export function isRetryableOverpassError(error: unknown): boolean {
  // 400 = la consulta está mal escrita: otro servidor dará el mismo error.
  if (error instanceof OsmHttpError) return error.status !== 400
  // TypeError = fallo de red/CORS (incluye "no se pudo conectar");
  // TimeoutError/AbortError = se cumplió el límite del intento.
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))
  )
}

export interface OsmClientOptions {
  /** Correo de contacto que se envía a Nominatim como parámetro `email`. */
  email?: string
  /**
   * Solo para Node (script de prueba). En el navegador NO se usa: el navegador
   * no deja cambiar el User-Agent y enviarlo forzaría una petición CORS extra.
   */
  userAgent?: string
  fetchFn?: typeof fetch
  nominatimUrl?: string
  /** Servidores Overpass en orden de preferencia (por defecto OVERPASS_URLS). */
  overpassUrls?: string[]
  /** Tiempo máximo de espera por petición (Nominatim). */
  timeoutMs?: number
  /** Límite de cada intento a Overpass (el script de datos usa uno mayor). */
  overpassTimeoutMs?: number
  /** Intentos por consulta a Overpass. */
  overpassMaxAttempts?: number
  /** Espera mínima entre peticiones al mismo servidor Overpass (los tests usan 0). */
  overpassMinIntervalMs?: number
  /** Caché de respuestas (por defecto sessionStorage si existe; null = sin caché). */
  cache?: OverpassCache | null
  /** Memoria de servidores que fallaron (por defecto sessionStorage; null = sin memoria). */
  failureMemory?: ServerFailureMemory | null
}

export function createOsmClient(options: OsmClientOptions = {}): FullOsmClient {
  const {
    email,
    userAgent,
    // Envoltura para no perder el `this` de window.fetch en el navegador.
    fetchFn = (...args) => fetch(...args),
    nominatimUrl = NOMINATIM_URL,
    overpassUrls = OVERPASS_URLS,
    timeoutMs = 30_000,
    overpassTimeoutMs = OVERPASS_ATTEMPT_TIMEOUT_MS,
    overpassMaxAttempts = OVERPASS_MAX_ATTEMPTS,
    overpassMinIntervalMs = OVERPASS_MIN_INTERVAL_MS,
  } = options
  const cache = options.cache === undefined ? createSessionCache() : (options.cache ?? undefined)
  const failures = options.failureMemory === undefined ? createSessionFailureMemory() : (options.failureMemory ?? undefined)

  // Limitadores independientes: Nominatim (1 petición/s) y uno por servidor Overpass.
  const nominatimThrottle = createThrottle(1100)
  const overpassThrottles = new Map(overpassUrls.map((url) => [url, createThrottle(overpassMinIntervalMs)]))

  async function requestJson<T>(url: string, init: RequestInit, timeout = timeoutMs): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) }
    if (userAgent) headers['User-Agent'] = userAgent
    // Límite propio de la petición con AbortController: al cumplirse, fetch se
    // cancela y el intento se da por fallido (sirve aunque el servidor ni conecte).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Tiempo agotado', 'TimeoutError')), timeout)
    try {
      const response = await fetchFn(url, { ...init, headers, signal: controller.signal })
      if (!response.ok) throw new OsmHttpError(response.status, `${url} respondió ${response.status}`)
      return (await response.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  /** Una petición POST a un servidor Overpass ("simple request" de CORS, sin preflight). */
  async function postOverpass(url: string, query: string): Promise<OverpassResponse> {
    const response = await requestJson<OverpassResponse>(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      },
      overpassTimeoutMs,
    )
    // 200 con "runtime error" = el servidor no terminó la consulta (no es "sin resultados").
    if (response.remark && /error|timed out|timeout/i.test(response.remark)) {
      throw new OsmHttpError(504, `${url}: ${response.remark}`)
    }
    return response
  }

  /** Servidores en el orden a probar: los que fallaron hace poco van al final. */
  function serverOrder(): string[] {
    const recent = failures?.recentFailures() ?? new Set<string>()
    return [...overpassUrls.filter((u) => !recent.has(u)), ...overpassUrls.filter((u) => recent.has(u))]
  }

  async function queryOverpass(query: string): Promise<OverpassResponse> {
    const cached = cache?.get(query)
    if (cached) return cached

    let lastError: unknown
    for (const url of serverOrder().slice(0, overpassMaxAttempts)) {
      try {
        const response = await overpassThrottles.get(url)!(() => postOverpass(url, query))
        cache?.set(query, response)
        return response
      } catch (error) {
        lastError = error
        if (!isRetryableOverpassError(error)) throw error // 400: error de la consulta, no del servidor
        failures?.markFailed(url)
        // Sin esperas: se pasa de inmediato al siguiente servidor.
      }
    }
    throw lastError
  }

  return {
    async geocode(query) {
      const results = await nominatimThrottle(() =>
        requestJson<NominatimResult[]>(buildNominatimUrl(nominatimUrl, query, email), { method: 'GET' }),
      )
      return parseNominatimResponse(query, results)
    },

    queryOverpass,

    async checkActivities(centers, radiusMeters, categories) {
      const response = await queryOverpass(buildActivityCountQuery(centers, radiusMeters, categories))
      return parseActivityCounts(response, centers.length, categories)
    },

    async findPlaces(center, radiusMeters, categories) {
      const response = await queryOverpass(buildOverpassQuery(center, radiusMeters, categories))
      return parseOverpassResponse(response, categories)
    },
  }
}
