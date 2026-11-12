/**
 * Funciones puras para hablar con OpenStreetMap: construyen las consultas y
 * convierten las respuestas crudas de Nominatim/Overpass en tipos de Locus.
 *
 * No hacen peticiones de red: eso lo hace osmClient.ts. Así se pueden probar
 * con datos de ejemplo, sin conexión.
 */
import type { CategoryId, Destination, GeoPoint, Place } from '../../types/itinerary'
import { CATEGORIES, kindLabel } from './categories'
import { haversineKm } from './geo'

/** Límites del radio de búsqueda: suficiente para una ciudad, recorrible en un día. */
export const MIN_RADIUS_METERS = 1500
export const MAX_RADIUS_METERS = 8000

/** Cuántos lugares pedimos a Overpass por categoría (luego elegimos los mejores). */
export const PLACES_PER_CATEGORY = 60

// ---------------------------------------------------------------------------
// Nominatim (geocodificación: nombre → coordenadas)
// ---------------------------------------------------------------------------

/** Forma (parcial) de un resultado de https://nominatim.openstreetmap.org/search?format=jsonv2 */
export interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  /** [sur, norte, oeste, este] como strings. */
  boundingbox?: [string, string, string, string]
}

/**
 * URL de búsqueda de Nominatim. `email` es el contacto que pide su política
 * de uso para identificar a quien hace las consultas (se omite si no hay).
 */
export function buildNominatimUrl(baseUrl: string, query: string, email?: string): string {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'es',
    // Locus solo planifica viajes por Colombia: sin esto, "Salento" se
    // resuelve a Salento (Italia) y "Santa Marta" a otros países.
    countrycodes: 'co',
  })
  if (email) params.set('email', email)
  return `${baseUrl}/search?${params}`
}

/**
 * Calcula un radio de búsqueda a partir del "bounding box" (rectángulo que
 * encierra la ciudad): la mitad de su diagonal, acotada entre MIN y MAX.
 * Una ciudad pequeña recibe un radio pequeño; una enorme no se sale de lo recorrible.
 */
export function radiusFromBoundingBox(bbox: NominatimResult['boundingbox']): number {
  if (!bbox) return MAX_RADIUS_METERS / 2
  const [south, north, west, east] = bbox.map(Number)
  if ([south, north, west, east].some(Number.isNaN)) return MAX_RADIUS_METERS / 2
  const halfDiagonalMeters =
    (haversineKm({ lat: south, lon: west }, { lat: north, lon: east }) * 1000) / 2
  return Math.round(Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, halfDiagonalMeters)))
}

/** Convierte la respuesta de Nominatim en un Destination, o null si no hubo resultados. */
export function parseNominatimResponse(query: string, results: NominatimResult[]): Destination | null {
  const first = results[0]
  if (!first) return null
  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  return {
    query,
    displayName: first.display_name,
    lat,
    lon,
    radiusMeters: radiusFromBoundingBox(first.boundingbox),
  }
}

// ---------------------------------------------------------------------------
// Overpass (búsqueda de puntos de interés cerca de unas coordenadas)
// ---------------------------------------------------------------------------

/** Forma (parcial) de un elemento de la respuesta JSON de Overpass. */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  /** Para "way" y "relation" (polígonos), Overpass da su centro con `out center`. */
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface OverpassResponse {
  elements: OverpassElement[]
  /**
   * Overpass responde 200 con `remark` cuando la consulta falló en el
   * servidor (ej. "runtime error: Query timed out"); los resultados vienen
   * vacíos o incompletos y NO significan "no hay lugares".
   */
  remark?: string
}

/** Escapa un valor para usarlo dentro de una expresión regular de Overpass. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&')

/**
 * Construye UNA sola consulta Overpass QL para todas las categorías elegidas
 * (una petición en vez de seis, para respetar los límites de uso).
 *
 * Por cada categoría se arma un conjunto con nombre y se limita su salida, ej.:
 *
 *   (
 *     nwr["tourism"~"^(museum|gallery)$"]["name"](around:5000,10.42,-75.54);
 *     nwr["amenity"~"^(theatre|arts_centre)$"]["name"](around:5000,10.42,-75.54);
 *   )->.cultura;
 *   .cultura out center 60;
 *
 * - `nwr` = nodos, vías y relaciones (un museo puede ser un punto o un edificio).
 * - `["name"]` = solo lugares con nombre (un restaurante sin nombre no sirve).
 * - `around:R,lat,lon` = dentro de R metros del centro del destino.
 * - `out center` = para edificios/áreas, devuelve su punto central.
 */
export function buildOverpassQuery(
  center: GeoPoint,
  radiusMeters: number,
  categories: CategoryId[],
  perCategoryLimit = PLACES_PER_CATEGORY,
): string {
  const blocks = categories.map((categoryId) => {
    const statements = categoryStatements(categoryId, center, radiusMeters)
    return `(\n${statements}\n)->.${categoryId};\n.${categoryId} out center ${perCategoryLimit};`
  })
  return `[out:json][timeout:25];\n${blocks.join('\n')}`
}

/** Sentencias Overpass de una categoría alrededor de un punto (una por filtro de OSM). */
function categoryStatements(categoryId: CategoryId, center: GeoPoint, radiusMeters: number): string {
  const around = `(around:${Math.round(radiusMeters)},${center.lat.toFixed(6)},${center.lon.toFixed(6)})`
  return CATEGORIES[categoryId].filters
    .map((f) => `  nwr["${f.key}"~"^(${f.values.map(escapeRegex).join('|')})$"]["name"]${around};`)
    .join('\n')
}

/**
 * Consulta que CUENTA (sin descargarlos) los lugares de cada categoría
 * alrededor de varios puntos a la vez. Usa los mismos filtros que
 * buildOverpassQuery. Por cada punto y cada categoría hay un bloque con
 * `out count;`, así que la respuesta trae un conteo por bloque, en orden:
 *
 *   (punto 1, categoría 1), (punto 1, categoría 2), …, (punto 2, categoría 1), …
 *
 * Sirve para revisar varios pueblos candidatos en UNA sola petición.
 */
export function buildActivityCountQuery(centers: GeoPoint[], radiusMeters: number, categories: CategoryId[]): string {
  const blocks = centers.flatMap((center) =>
    categories.map((categoryId) => `(\n${categoryStatements(categoryId, center, radiusMeters)}\n);\nout count;`),
  )
  // timeout corto: el navegador abandona a los 2,5 s, y Overpass da turno antes
  // a las consultas que declaran un límite bajo.
  return `[out:json][timeout:5];\n${blocks.join('\n')}`
}

/**
 * Lee la respuesta de buildActivityCountQuery: para cada punto, las
 * categorías con al menos un lugar. Lanza error si no llegaron todos los
 * conteos (respuesta incompleta), para no confundirla con "no hay nada".
 */
export function parseActivityCounts(
  response: OverpassResponse,
  centersCount: number,
  categories: CategoryId[],
): CategoryId[][] {
  const counts = (response.elements ?? []).filter((e) => (e.type as string) === 'count')
  if (counts.length !== centersCount * categories.length) {
    throw new Error(`Overpass devolvió ${counts.length} conteos; se esperaban ${centersCount * categories.length}`)
  }
  return Array.from({ length: centersCount }, (_, i) =>
    categories.filter((_, c) => Number(counts[i * categories.length + c].tags?.total ?? 0) > 0),
  )
}

/**
 * Determina a qué categoría (de las pedidas) pertenece un elemento según sus
 * etiquetas, y qué etiqueta lo hizo coincidir (para el "tipo" legible).
 */
export function classifyElement(
  tags: Record<string, string>,
  categories: CategoryId[],
): { category: CategoryId; tagValue: string } | null {
  for (const categoryId of categories) {
    for (const filter of CATEGORIES[categoryId].filters) {
      const value = tags[filter.key]
      if (value && filter.values.includes(value)) return { category: categoryId, tagValue: value }
    }
  }
  return null
}

/**
 * Relevancia de un lugar estimada con sus etiquetas de OSM. OSM no tiene
 * calificaciones de usuarios, así que usamos señales de "qué tan conocido y
 * documentado" es el lugar:
 * - Tiene artículo en Wikipedia/Wikidata → +3 (lugar notable).
 * - Tiene sitio web → +1.
 * - Tiene horario publicado → +1.
 * - Puntaje base → 1.
 */
export function scorePlace(tags: Record<string, string>): number {
  let score = 1
  if (tags.wikidata || tags.wikipedia) score += 3
  if (tags.website || tags['contact:website']) score += 1
  if (tags.opening_hours) score += 1
  return score
}

/**
 * Convierte la respuesta de Overpass en Place[]:
 * descarta elementos sin nombre o sin coordenadas, clasifica cada uno en su
 * categoría y elimina duplicados (el mismo lugar puede aparecer como punto y
 * como edificio con el mismo nombre).
 */
export function parseOverpassResponse(response: OverpassResponse, categories: CategoryId[]): Place[] {
  const places: Place[] = []
  const seen = new Set<string>()

  for (const element of response.elements ?? []) {
    const tags = element.tags ?? {}
    const name = tags.name?.trim()
    const lat = element.lat ?? element.center?.lat
    const lon = element.lon ?? element.center?.lon
    if (!name || lat === undefined || lon === undefined) continue

    const match = classifyElement(tags, categories)
    if (!match) continue

    const id = `${element.type}/${element.id}`
    const dedupeKey = `${match.category}|${name.toLowerCase()}`
    if (seen.has(id) || seen.has(dedupeKey)) continue
    seen.add(id)
    seen.add(dedupeKey)

    places.push({
      id,
      name,
      lat,
      lon,
      category: match.category,
      kind: kindLabel(match.tagValue),
      score: scorePlace(tags),
    })
  }
  return places
}
