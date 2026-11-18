/**
 * Servicio de precios de LOCUS (Cloudflare Worker, plan GRATIS).
 *
 * Qué hace: consulta, en el servidor, los precios de vuelos que la API de datos
 * de Aviasales (Travelpayouts) tiene en caché ("los más baratos que encontraron
 * viajeros en las últimas 48 h") y los entrega ya normalizados a la web de LOCUS.
 *
 * Por qué existe: el token de Travelpayouts es una credencial y NO puede ir en
 * el navegador. Aquí vive como secreto del Worker (`wrangler secret put`).
 *
 * Qué NO es: no son precios en vivo ni reservables; son una REFERENCIA ("desde
 * $X, visto hace poco"). La interfaz lo dice así y envía al usuario a Aviasales
 * para ver la tarifa real. No se hace scraping de ninguna página.
 *
 * ⚠ El contrato con Travelpayouts (`/aviasales/v3/prices_for_dates`) se escribió
 * con su documentación pública pero NO se ha probado con un token real: al
 * activarlo, verifica con `GET /health` y una consulta real (docs/PRECIOS_EN_VIVO.md).
 * El análisis de la respuesta es defensivo: ante cualquier forma inesperada
 * responde "sin datos", nunca un precio inventado.
 */

export interface Env {
  /** Secreto: token de la API de datos de Travelpayouts. */
  TRAVELPAYOUTS_TOKEN?: string
  /** Marker de afiliado (público) para el enlace a Aviasales. */
  TRAVELPAYOUTS_MARKER?: string
  /** Orígenes web permitidos, separados por comas. */
  ALLOWED_ORIGINS?: string
}

/** Lo mínimo de la caché de Cloudflare que usamos (se inyecta en las pruebas). */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export interface Deps {
  fetchFn?: typeof fetch
  cache?: CacheLike | null
  now?: () => Date
}

export interface FlightReference {
  ok: true
  found: true
  /** Precio por pasajero, en COP. */
  priceCOP: number
  airline: string | null
  departureAt: string | null
  returnAt: string | null
  transfers: number | null
  /** 'date' = el día pedido; 'month' = el más barato de ese mes. */
  matched: 'date' | 'month'
  /** Enlace a Aviasales (con el marker de LOCUS si existe). */
  link: string
  fetchedAt: string
}
export interface NoData {
  ok: true
  found: false
  fetchedAt: string
}
export interface ApiError {
  ok: false
  error: 'forbidden' | 'bad-request' | 'not-configured' | 'upstream' | 'not-found'
}
export type PriceResponse = FlightReference | NoData | ApiError

const UPSTREAM = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates'
const AVIASALES = 'https://www.aviasales.com'
const CACHE_FOUND_SECONDS = 6 * 3600
const CACHE_EMPTY_SECONDS = 3600
const MAX_DAYS_AHEAD = 330
const ISO = /^\d{4}-\d{2}-\d{2}$/
const IATA = /^[A-Z]{3}$/

const daysBetween = (fromISO: string, toISO: string) => Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000)
const validISO = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s

export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: PriceResponse | { ok: true; service: string; configured: boolean }, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extra },
  })
}

/** Valores de la respuesta de Travelpayouts que usamos. Todo es opcional a propósito. */
interface UpstreamTicket {
  price?: unknown
  airline?: unknown
  departure_at?: unknown
  return_at?: unknown
  transfers?: unknown
  link?: unknown
}

/** Primer boleto válido de la respuesta, o null. Pura: se prueba sin red. */
export function pickCheapest(
  payload: unknown,
  marker: string | undefined,
  matched: 'date' | 'month',
  fetchedAt: string,
): FlightReference | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as { success?: unknown; data?: unknown; currency?: unknown }
  if (p.success !== true || !Array.isArray(p.data)) return null
  // Si la API no devolvió COP, un número en otra moneda sería un precio falso.
  if (typeof p.currency === 'string' && p.currency.toLowerCase() !== 'cop') return null
  const tickets = (p.data as UpstreamTicket[])
    .filter((t) => typeof t?.price === 'number' && Number.isFinite(t.price) && t.price > 0)
    .sort((a, b) => (a.price as number) - (b.price as number))
  const t = tickets[0]
  if (!t) return null
  return {
    ok: true,
    found: true,
    priceCOP: Math.round(t.price as number),
    airline: typeof t.airline === 'string' ? t.airline : null,
    departureAt: typeof t.departure_at === 'string' ? t.departure_at : null,
    returnAt: typeof t.return_at === 'string' && t.return_at ? t.return_at : null,
    transfers: typeof t.transfers === 'number' ? t.transfers : null,
    matched,
    link: buildLink(t.link, marker),
    fetchedAt,
  }
}

/** Enlace seguro a Aviasales: solo rutas relativas que empiecen por /search. */
export function buildLink(link: unknown, marker: string | undefined): string {
  const path = typeof link === 'string' && /^\/search[\w/?=&.%-]*$/.test(link) ? link : null
  if (!path) return `${AVIASALES}/`
  const url = new URL(path, AVIASALES)
  if (marker) url.searchParams.set('marker', marker)
  return url.toString()
}

async function queryUpstream(
  fetchFn: typeof fetch,
  token: string,
  params: { origin: string; destination: string; departure: string; ret?: string },
): Promise<unknown | null> {
  const url = new URL(UPSTREAM)
  url.searchParams.set('origin', params.origin)
  url.searchParams.set('destination', params.destination)
  url.searchParams.set('departure_at', params.departure)
  if (params.ret) url.searchParams.set('return_at', params.ret)
  url.searchParams.set('one_way', params.ret ? 'false' : 'true')
  url.searchParams.set('currency', 'cop')
  url.searchParams.set('sorting', 'price')
  url.searchParams.set('limit', '5')
  url.searchParams.set('unique', 'false')
  const res = await fetchFn(url.toString(), { headers: { 'X-Access-Token': token, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return res.json()
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const fetchFn = deps.fetchFn ?? fetch
  const now = (deps.now ?? (() => new Date()))()
  const origin = request.headers.get('Origin')
  const allowed = parseOrigins(env.ALLOWED_ORIGINS)
  const originOk = origin !== null && allowed.includes(origin)
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 })
  }
  if (request.method !== 'GET') return json({ ok: false, error: 'bad-request' }, 405, originOk ? origin : null)

  // Salud: no gasta cuota ni exige origen. Dice si el secreto está puesto.
  if (url.pathname === '/health') {
    return json({ ok: true, service: 'locus-prices', configured: Boolean(env.TRAVELPAYOUTS_TOKEN) }, 200, originOk ? origin : null)
  }

  if (!originOk) return json({ ok: false, error: 'forbidden' }, 403, null)
  if (url.pathname !== '/flights') return json({ ok: false, error: 'not-found' }, 404, origin)
  if (!env.TRAVELPAYOUTS_TOKEN) return json({ ok: false, error: 'not-configured' }, 503, origin)

  const originCode = (url.searchParams.get('origin') ?? '').toUpperCase()
  const destCode = (url.searchParams.get('destination') ?? '').toUpperCase()
  const date = url.searchParams.get('date') ?? ''
  const ret = url.searchParams.get('return') ?? ''
  const today = now.toISOString().slice(0, 10)
  const bad =
    !IATA.test(originCode) ||
    !IATA.test(destCode) ||
    originCode === destCode ||
    !validISO(date) ||
    date < today ||
    daysBetween(today, date) > MAX_DAYS_AHEAD ||
    (ret !== '' && (!validISO(ret) || ret < date || daysBetween(date, ret) > 60))
  if (bad) return json({ ok: false, error: 'bad-request' }, 400, origin)

  // Caché: la misma ruta y fecha no vuelve a gastar cuota durante horas.
  const cacheKey = new Request(`https://cache.locus.invalid/flights?o=${originCode}&d=${destCode}&t=${date}&r=${ret}`)
  const cached = await deps.cache?.match(cacheKey)
  if (cached) return new Response(cached.body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin), 'X-Cache': 'HIT' } })

  const fetchedAt = now.toISOString()
  let body: FlightReference | NoData
  try {
    const exact = await queryUpstream(fetchFn, env.TRAVELPAYOUTS_TOKEN, { origin: originCode, destination: destCode, departure: date, ret: ret || undefined })
    let found = pickCheapest(exact, env.TRAVELPAYOUTS_MARKER, 'date', fetchedAt)
    if (!found) {
      // Sin datos para ese día: el más barato del mes sigue siendo útil (y se dice).
      const month = await queryUpstream(fetchFn, env.TRAVELPAYOUTS_TOKEN, { origin: originCode, destination: destCode, departure: date.slice(0, 7) })
      found = pickCheapest(month, env.TRAVELPAYOUTS_MARKER, 'month', fetchedAt)
    }
    body = found ?? { ok: true, found: false, fetchedAt }
  } catch {
    return json({ ok: false, error: 'upstream' }, 502, origin)
  }

  const seconds = body.found ? CACHE_FOUND_SECONDS : CACHE_EMPTY_SECONDS
  const res = json(body, 200, origin, { 'Cache-Control': `public, max-age=${seconds}`, 'X-Cache': 'MISS' })
  if (deps.cache) await deps.cache.put(cacheKey, new Response(JSON.stringify(body), { headers: { 'Cache-Control': `public, max-age=${seconds}`, 'Content-Type': 'application/json' } }))
  return res
}
