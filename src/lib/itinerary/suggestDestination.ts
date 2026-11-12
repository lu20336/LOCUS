/**
 * ============================================================================
 *  SUGERENCIA DE DESTINO (Modo B del Paso 1: "Sugiéreme un destino")
 * ============================================================================
 *
 * El usuario no sabe a dónde ir: elige un CLIMA (frío, templado, cálido) y
 * unas ACTIVIDADES. Recomendamos 3 pueblos/ciudades de Colombia así:
 *
 *   1. Candidatos: todos los pueblos y ciudades de Colombia en OpenStreetMap
 *      (Overpass: place=city / town / village con Wikidata). En la app esta
 *      lista viene PRECALCULADA en src/data/colombiaTowns.json (generada con
 *      `npm run data:towns` usando esta misma consulta): es una consulta pesada
 *      que los servidores públicos de Overpass no siempre atienden desde el
 *      navegador, y los pueblos de Colombia casi no cambian.
 *   2. Popularidad: los ordenamos por qué tan conocidos son (tipo de lugar,
 *      población, artículo en Wikipedia) y nos quedamos con los primeros.
 *   3. Clima por altitud: en el trópico el clima depende sobre todo de la
 *      altura ("pisos térmicos"). Tomamos la altitud de la etiqueta `ele` de
 *      OSM o, si no la tiene, de Open-Elevation (en la lista precalculada ya
 *      viene resuelta), y filtramos por el clima elegido.
 *   4. Actividades: para los primeros CANDIDATES_TO_CHECK que cumplen el clima,
 *      contamos lugares reales cerca (radio ACTIVITY_RADIUS_METERS) con los
 *      MISMOS filtros de OSM por categoría que usa el motor de itinerarios, y
 *      vemos cuántas de las categorías elegidas tienen al menos un lugar.
 *      Todos los candidatos se revisan en UNA sola consulta (`out count`:
 *      Overpass solo cuenta, no descarga los lugares).
 *   5. Ranking: más categorías encontradas primero; empate → más popular.
 *      Devolvemos los 3 mejores.
 *
 * Si ningún candidato tiene ninguna de las actividades (ej. "Frío" + "Playa":
 * no hay playas en alta montaña), igual devolvemos los 3 más populares que
 * cumplen el clima y marcamos `climateOnly` para avisarle al usuario.
 *
 * Prioridad: que el usuario NUNCA se quede esperando. La consulta del paso 4
 * tiene como máximo 2 intentos de 2,5 s (ver osmClient.ts). Si no alcanza a
 * responder, se devuelven igual los 3 mejores por clima, marcados con
 * `activitiesUnverified` para avisar que no se confirmaron las actividades.
 * ============================================================================
 */
import type { CategoryId, Destination, GeoPoint } from '../../types/itinerary'
import type { ElevationLookup } from './elevationClient'
import { ItineraryError } from './errors'
import type { OverpassResponse } from './osm'

// ---------------------------------------------------------------------------
// Climas por altitud (pisos térmicos de Colombia)
// ---------------------------------------------------------------------------

export type ClimateId = 'frio' | 'templado' | 'calido'

export interface ClimateDefinition {
  id: ClimateId
  label: string
  /** Temperatura media aproximada, para mostrar al usuario. */
  temperature: string
  /** Rango de altitud en metros: [mínimo incluido, máximo excluido). */
  minElevation: number
  maxElevation: number
}

export const CLIMATES: Record<ClimateId, ClimateDefinition> = {
  calido: { id: 'calido', label: 'Cálido', temperature: 'más de 24 °C', minElevation: -Infinity, maxElevation: 1000 },
  templado: { id: 'templado', label: 'Templado', temperature: '17 a 24 °C', minElevation: 1000, maxElevation: 2000 },
  // Por encima de ~3.300 m es páramo: no hay pueblos para turismo convencional.
  frio: { id: 'frio', label: 'Frío', temperature: '12 a 17 °C', minElevation: 2000, maxElevation: 3300 },
}

export const CLIMATE_IDS: ClimateId[] = ['frio', 'templado', 'calido']

export function climateForElevation(elevation: number): ClimateId | null {
  return CLIMATE_IDS.find((id) => elevation >= CLIMATES[id].minElevation && elevation < CLIMATES[id].maxElevation) ?? null
}

// ---------------------------------------------------------------------------
// Parámetros del algoritmo
// ---------------------------------------------------------------------------

/** Cuántos de los más populares revisamos por altitud. */
export const CANDIDATES_FOR_ELEVATION = 200
/** Cuántos candidatos que cumplen el clima revisamos por actividades (1 consulta c/u). */
export const CANDIDATES_TO_CHECK = 15
/** Pueblos revisados por consulta en el paso 4 (todos en una sola consulta). */
export const ACTIVITY_BATCH_SIZE = 15
/** Radio de búsqueda de actividades alrededor del centro del pueblo. */
export const ACTIVITY_RADIUS_METERS = 7000
/** Cuántas sugerencias devolvemos. */
export const SUGGESTIONS_TO_SHOW = 3

// ---------------------------------------------------------------------------
// Paso 1 y 2 · Candidatos y popularidad
// ---------------------------------------------------------------------------

export interface TownCandidate extends GeoPoint {
  /** ID de OSM, ej. "node/123". */
  id: string
  name: string
  place: 'city' | 'town' | 'village'
  /** Altitud de la etiqueta `ele` de OSM (null si no la tiene). */
  elevation: number | null
  popularity: number
}

/**
 * Consulta Overpass: ciudades y pueblos (place=city/town) de Colombia, más
 * las veredas/aldeas (place=village) que tienen Wikidata (las conocidas).
 */
export function buildColombiaTownsQuery(): string {
  return [
    '[out:json][timeout:60];',
    'area["ISO3166-1"="CO"][admin_level=2]->.colombia;',
    '(',
    '  node["place"~"^(city|town)$"]["name"](area.colombia);',
    '  node["place"="village"]["name"]["wikidata"](area.colombia);',
    ');',
    'out body;',
  ].join('\n')
}

/** "2.640" / "2640 m" / "2640.5" → 2640 (la etiqueta `ele` es texto libre). */
export function parseElevationTag(value: string | undefined): number | null {
  if (!value) return null
  const number = Number.parseFloat(value.replace(/\s*m$/i, '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

/**
 * Popularidad estimada con etiquetas de OSM:
 *   tipo de lugar (ciudad 3, pueblo 2, vereda 1)
 * + 2 si tiene artículo en Wikipedia
 * + log10(población) (10.000 hab → +4; 1.000.000 → +6)
 */
export function popularityScore(tags: Record<string, string>): number {
  const placeWeight = { city: 3, town: 2, village: 1 }[tags.place] ?? 0
  const wikipedia = tags.wikipedia ? 2 : 0
  const population = Number.parseInt((tags.population ?? '').replace(/\D/g, ''), 10)
  const populationScore = population > 0 ? Math.log10(population) : 0
  return placeWeight + wikipedia + populationScore
}

export function parseTownCandidates(response: OverpassResponse): TownCandidate[] {
  const candidates: TownCandidate[] = []
  for (const element of response.elements ?? []) {
    const tags = element.tags ?? {}
    const name = tags.name?.trim()
    const place = tags.place
    if (!name || element.lat === undefined || element.lon === undefined) continue
    if (place !== 'city' && place !== 'town' && place !== 'village') continue
    candidates.push({
      id: `${element.type}/${element.id}`,
      name,
      lat: element.lat,
      lon: element.lon,
      place,
      elevation: parseElevationTag(tags.ele),
      popularity: popularityScore(tags),
    })
  }
  // Del más al menos popular.
  return candidates.sort((a, b) => b.popularity - a.popularity)
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export interface DestinationSuggestion {
  candidate: TownCandidate
  /** Listo para usar como destino del viaje (mismo tipo que devuelve Nominatim). */
  destination: Destination
  climate: ClimateId
  elevation: number
  /** Categorías elegidas con al menos un lugar real cerca. */
  matchedCategories: CategoryId[]
  /** false si la consulta de actividades de este candidato falló. */
  activitiesChecked: boolean
}

export interface SuggestionResult {
  climate: ClimateId
  categories: CategoryId[]
  suggestions: DestinationSuggestion[]
  /** Ningún candidato tiene ninguna actividad: se muestran solo por clima. */
  climateOnly: boolean
  /** Candidatos cuya revisión de actividades falló (red, límite de Overpass…). */
  failedChecks: number
  /** No se alcanzó a confirmar ninguna actividad: resultados solo por clima. */
  activitiesUnverified: boolean
}

export type SuggestionProgress =
  | { phase: 'towns'; message: string }
  | { phase: 'elevation'; message: string }
  | { phase: 'activities'; message: string; current: number; total: number; town: string }

export interface SuggestionDeps {
  /** Candidatos ordenados del más al menos popular (lista precalculada o Overpass en vivo). */
  loadTowns: () => Promise<TownCandidate[]>
  /**
   * Para cada punto, qué categorías tienen al menos un lugar a menos de
   * `radiusMeters` (osmClient.checkActivities: una petición por llamada).
   */
  checkActivities: (centers: GeoPoint[], radiusMeters: number, categories: CategoryId[]) => Promise<CategoryId[][]>
  elevation: ElevationLookup
}

export interface SuggestOptions {
  onProgress?: (progress: SuggestionProgress) => void
  /** Permite cancelar la búsqueda (ej. si el usuario cambia de modo). */
  signal?: AbortSignal
}

/**
 * Ranking (paso 5): más categorías encontradas primero; en empate, el más
 * popular. Función pura.
 */
export function rankSuggestions(suggestions: readonly DestinationSuggestion[]): DestinationSuggestion[] {
  return [...suggestions].sort(
    (a, b) =>
      b.matchedCategories.length - a.matchedCategories.length || b.candidate.popularity - a.candidate.popularity,
  )
}

/** Carga los candidatos consultando Overpass en vivo (la usan el script de demo y `npm run data:towns`). */
export async function fetchTownsFromOverpass(queryOverpass: (query: string) => Promise<OverpassResponse>) {
  return parseTownCandidates(await queryOverpass(buildColombiaTownsQuery()))
}

/** La lista de pueblos de Colombia casi no cambia: la guardamos para no repetir la carga. */
let townsCache: TownCandidate[] | null = null
export function clearTownsCache() {
  townsCache = null
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Búsqueda cancelada', 'AbortError')
}

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

export async function suggestDestination(
  climate: ClimateId,
  categories: CategoryId[],
  deps: SuggestionDeps,
  options: SuggestOptions = {},
): Promise<SuggestionResult> {
  const { onProgress, signal } = options
  if (categories.length === 0) {
    throw new ItineraryError('INVALID_INPUT', 'Elige al menos una actividad.')
  }
  const climateLabel = CLIMATES[climate].label.toLowerCase()

  // Pasos 1 y 2: candidatos ordenados por popularidad.
  onProgress?.({ phase: 'towns', message: 'Buscando pueblos y ciudades de Colombia…' })
  if (!townsCache) {
    try {
      townsCache = await deps.loadTowns()
    } catch {
      throw new ItineraryError(
        'SERVICE_UNAVAILABLE',
        'No pudimos consultar el mapa de Colombia (Overpass). Inténtalo de nuevo en unos segundos.',
      )
    }
  }
  throwIfAborted(signal)
  const popular = townsCache.slice(0, CANDIDATES_FOR_ELEVATION)

  // Paso 3: altitud → clima. Solo pedimos a Open-Elevation la de quienes no tienen `ele`.
  onProgress?.({ phase: 'elevation', message: `Revisando pueblos con clima ${climateLabel}…` })
  const missing = popular.filter((c) => c.elevation === null)
  const looked = new Map<string, number | null>()
  let elevationFailed = false
  if (missing.length > 0) {
    try {
      const values = await deps.elevation(missing)
      missing.forEach((c, i) => looked.set(c.id, values[i] ?? null))
    } catch {
      // Seguimos solo con los que traen `ele` desde OSM.
      elevationFailed = true
    }
  }
  throwIfAborted(signal)

  const inClimate = popular
    .map((candidate) => ({ candidate, elevation: candidate.elevation ?? looked.get(candidate.id) ?? null }))
    .filter((c): c is { candidate: TownCandidate; elevation: number } => c.elevation !== null)
    .filter((c) => climateForElevation(c.elevation) === climate)
    .slice(0, CANDIDATES_TO_CHECK)

  if (inClimate.length === 0) {
    throw new ItineraryError(
      elevationFailed ? 'SERVICE_UNAVAILABLE' : 'NO_PLACES',
      elevationFailed
        ? 'No pudimos consultar la altitud de los pueblos (Open-Elevation). Inténtalo de nuevo en unos segundos.'
        : `No encontramos pueblos con clima ${climateLabel}.`,
    )
  }

  // Paso 4: actividades cerca de cada candidato, en grupos de ACTIVITY_BATCH_SIZE.
  const checked: DestinationSuggestion[] = []
  let failedChecks = 0
  for (let start = 0; start < inClimate.length; start += ACTIVITY_BATCH_SIZE) {
    throwIfAborted(signal)
    const batch = inClimate.slice(start, start + ACTIVITY_BATCH_SIZE)
    const done = start + batch.length
    onProgress?.({
      phase: 'activities',
      message: `Comprobando actividades en ${batch.length} pueblos con clima ${climateLabel}…`,
      current: done,
      total: inClimate.length,
      town: batch[0].candidate.name,
    })

    let matches: CategoryId[][] | null = null
    try {
      matches = await deps.checkActivities(batch.map((c) => c.candidate), ACTIVITY_RADIUS_METERS, categories)
    } catch {
      // No se pudo revisar este grupo (servidores saturados): seguimos con el siguiente.
      failedChecks += batch.length
    }

    batch.forEach(({ candidate, elevation }, i) => {
      const destination: Destination = {
        query: candidate.name,
        displayName: `${candidate.name}, Colombia`,
        lat: candidate.lat,
        lon: candidate.lon,
        radiusMeters: ACTIVITY_RADIUS_METERS,
      }
      checked.push({
        candidate,
        destination,
        climate,
        elevation,
        matchedCategories: matches?.[i] ?? [],
        activitiesChecked: matches !== null,
      })
    })
  }
  throwIfAborted(signal)

  // Paso 5: ranking y las 3 mejores.
  const ranked = rankSuggestions(checked)
  return {
    climate,
    categories,
    suggestions: ranked.slice(0, SUGGESTIONS_TO_SHOW),
    climateOnly: ranked.every((s) => s.matchedCategories.length === 0),
    failedChecks,
    // Ningún pueblo verificado: se muestran los 3 más populares del clima, con aviso.
    activitiesUnverified: failedChecks === inClimate.length,
  }
}
