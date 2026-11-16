/**
 * Cliente de Geoapify Places (https://apidocs.geoapify.com/docs/places/):
 * RESPALDO de Overpass cuando sus servidores públicos no responden.
 *
 * - Usa los mismos datos de OpenStreetMap, ya indexados por Geoapify.
 * - Plan gratuito: 3.000 créditos/día, 5 peticiones/s (1 petición = 1 crédito).
 * - Necesita una clave (VITE_GEOAPIFY_KEY en .env.local). La clave queda visible
 *   en el navegador: en el panel de Geoapify hay que limitarla a los dominios
 *   de la app (ver .env.example). Sin clave, la app funciona solo con Overpass.
 * - Atribución obligatoria en el plan gratuito: "Powered by Geoapify" (pie de
 *   página, App.tsx) además de "© OpenStreetMap contributors".
 *
 * Funciones puras (URL, clasificación, lectura de la respuesta) + un cliente
 * con fetch, igual que osm.ts / osmClient.ts.
 */
import type { CategoryId, GeoPoint, Place } from '../../types/itinerary'
import { CATEGORY_IDS, kindLabel } from './categories'
import { OsmHttpError } from './errors'
import { COUNT_UNNAMED, scorePlace } from './osm'

export const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places'

/**
 * Categorías de Geoapify equivalentes a cada actividad de Locus (las mismas
 * etiquetas de OSM que busca Overpass en categories.ts; Geoapify no tiene
 * "cascada", así que Aventura no la incluye).
 */
export const GEOAPIFY_CATEGORIES: Record<CategoryId, string[]> = {
  playa: ['beach'],
  cultura: [
    'entertainment.museum',
    'entertainment.culture',
    'tourism.sights.castle',
    'tourism.sights.fort',
    'tourism.sights.archaeological_site',
    'tourism.sights.memorial.monument',
  ],
  gastronomia: ['catering.restaurant', 'catering.cafe'],
  aventura: [
    'tourism.attraction.viewpoint',
    'leisure.park.nature_reserve',
    'natural.mountain.peak',
    'entertainment.theme_park',
    'entertainment.water_park',
  ],
  vidaNocturna: ['catering.bar', 'catering.pub', 'adult.nightclub'],
  compras: ['commercial.shopping_mall', 'commercial.department_store', 'commercial.marketplace'],
}

/** Forma (parcial) de la respuesta GeoJSON de /v2/places. */
export interface GeoapifyFeature {
  properties: {
    /** Normalmente texto, pero Geoapify a veces lo envía como número. */
    name?: string | number | null
    lat: number
    lon: number
    categories?: string[]
    place_id: string
    datasource?: { sourcename?: string; raw?: Record<string, unknown> }
  }
}

export interface GeoapifyResponse {
  features?: GeoapifyFeature[]
}

export function buildGeoapifyUrl(
  center: GeoPoint,
  radiusMeters: number,
  geoapifyCategories: string[],
  apiKey: string,
  limit: number,
): string {
  const params = new URLSearchParams({
    categories: geoapifyCategories.join(','),
    // Geoapify usa el orden lon,lat.
    filter: `circle:${center.lon.toFixed(6)},${center.lat.toFixed(6)},${Math.round(radiusMeters)}`,
    limit: String(Math.min(500, Math.max(1, limit))),
    lang: 'es',
    apiKey,
  })
  return `${GEOAPIFY_PLACES_URL}?${params}`
}

/**
 * A qué actividad pertenece un lugar según sus categorías de Geoapify, y su
 * tipo más específico (ej. "catering.restaurant.pizza" → "restaurant").
 */
export function classifyGeoapify(
  placeCategories: readonly string[],
  categories: readonly CategoryId[],
): { category: CategoryId; tagValue: string } | null {
  for (const category of categories) {
    for (const key of GEOAPIFY_CATEGORIES[category]) {
      const matches = placeCategories.filter((c) => c === key || c.startsWith(`${key}.`))
      if (matches.length === 0) continue
      // Para el tipo legible usamos la categoría elegida (ej. "restaurant"), no la cocina.
      return { category, tagValue: key.split('.').at(-1)! }
    }
  }
  return null
}

/** Las etiquetas crudas de OSM (si Geoapify las envía) como texto, para puntuar igual que Overpass. */
function rawTags(feature: GeoapifyFeature): Record<string, string> {
  const raw = feature.properties.datasource?.raw ?? {}
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as Record<string, string>
}

/** Id estable: el de OSM si viene (así se deduplica igual que con Overpass), si no el de Geoapify. */
function placeId(feature: GeoapifyFeature): string {
  const raw = feature.properties.datasource?.raw ?? {}
  const type = { n: 'node', w: 'way', r: 'relation' }[String(raw.osm_type)]
  return type && raw.osm_id ? `${type}/${String(raw.osm_id)}` : `geoapify/${feature.properties.place_id}`
}

/** Convierte la respuesta en lugares de Locus (sin nombre o sin categoría conocida, se descartan). */
export function parseGeoapifyPlaces(response: GeoapifyResponse, categories: CategoryId[]): Place[] {
  const places: Place[] = []
  const seen = new Set<string>()
  for (const feature of response.features ?? []) {
    const { name: rawName, lat, lon, categories: placeCategories = [] } = feature.properties
    // A veces el nombre llega como número (ej. una tienda llamada "7"): se pasa a texto.
    const name = rawName === undefined || rawName === null ? undefined : String(rawName).trim()
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const match = classifyGeoapify(placeCategories, categories)
    if (!match) continue
    const id = placeId(feature)
    const dedupeKey = `${match.category}|${name.toLowerCase()}`
    if (seen.has(id) || seen.has(dedupeKey)) continue
    seen.add(id)
    seen.add(dedupeKey)
    places.push({ id, name, lat, lon, category: match.category, kind: kindLabel(match.tagValue), score: scorePlace(rawTags(feature)) })
  }
  return places
}

/**
 * Cuántos lugares de una actividad trae la respuesta. Para "¿existe cerca?"
 * las actividades de COUNT_UNNAMED (playa) cuentan también los sin nombre;
 * las demás, solo los que tienen nombre (los mismos que usaría el itinerario).
 */
export function countGeoapifyMatches(response: GeoapifyResponse, category: CategoryId): number {
  if (!COUNT_UNNAMED.has(category)) return parseGeoapifyPlaces(response, [category]).length
  return (response.features ?? []).filter((f) => classifyGeoapify(f.properties.categories ?? [], [category])).length
}

export interface GeoapifyClient {
  /** Lugares de las actividades pedidas (una petición por actividad). */
  findPlaces(center: GeoPoint, radiusMeters: number, categories: CategoryId[], perCategoryLimit?: number): Promise<Place[]>
  /** Cuántos lugares hay de cada actividad (hasta `cap` por actividad; solo las de `categories`). */
  countActivities(
    center: GeoPoint,
    radiusMeters: number,
    cap?: number,
    categories?: CategoryId[],
  ): Promise<Partial<Record<CategoryId, number>>>
}

export function createGeoapifyClient(options: {
  apiKey: string
  fetchFn?: typeof fetch
  timeoutMs?: number
}): GeoapifyClient {
  const { apiKey, fetchFn = (...args) => fetch(...args), timeoutMs = 8000 } = options

  async function request(url: string): Promise<GeoapifyResponse> {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new OsmHttpError(response.status, `Geoapify respondió ${response.status}`)
    return (await response.json()) as GeoapifyResponse
  }

  // Una petición por actividad: así cada una trae sus propios resultados (un
  // solo pedido con todas devolvería casi solo restaurantes).
  async function byCategory(center: GeoPoint, radiusMeters: number, categories: CategoryId[], limit: number) {
    const results: { category: CategoryId; response: GeoapifyResponse }[] = []
    for (const category of categories) {
      // En serie: el plan gratuito admite 5 peticiones por segundo.
      const response = await request(buildGeoapifyUrl(center, radiusMeters, GEOAPIFY_CATEGORIES[category], apiKey, limit))
      results.push({ category, response })
    }
    return results
  }

  return {
    async findPlaces(center, radiusMeters, categories, perCategoryLimit = 60) {
      const results = await byCategory(center, radiusMeters, categories, perCategoryLimit)
      return results.flatMap(({ category, response }) => parseGeoapifyPlaces(response, [category]))
    },

    async countActivities(center, radiusMeters, cap = 100, categories = CATEGORY_IDS) {
      const results = await byCategory(center, radiusMeters, categories, cap)
      return Object.fromEntries(
        results.map(({ category, response }) => [category, countGeoapifyMatches(response, category)]),
      )
    },
  }
}
