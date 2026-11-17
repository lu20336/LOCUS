/**
 * Clientes que usa la app en el navegador. Se configuran en `.env.local`
 * (ver `.env.example`):
 *   VITE_NOMINATIM_EMAIL  correo de contacto para Nominatim (política de uso).
 *   VITE_GEOAPIFY_KEY     clave de Geoapify, respaldo de Overpass (opcional).
 *
 * Fuentes de lugares, en orden:
 *   1. Datos precalculados (npm run data:activities) para saber qué hay cerca.
 *   2. Overpass en vivo (servidores públicos de OpenStreetMap).
 *   3. Geoapify Places, solo si Overpass falla y hay clave configurada.
 */
import type { CategoryId, GeoPoint } from '../../types/itinerary'
import {
  availableCategories,
  countsForTown,
  loadAvailability,
  toCounts,
  type ActivityCounts,
} from '../flow/activityAvailability'
import { CATEGORY_IDS } from './categories'
import { isCoastal, withoutInlandBeaches } from './coast'
import { createElevationClient } from './elevationClient'
import { createGeoapifyClient } from './geoapifyClient'
import { buildActivityCountQuery, parseActivityTotals } from './osm'
import { createOsmClient, type OsmClient } from './osmClient'
import { createTravelTimeClient } from './travelTimes'
import {
  ACTIVITY_RADIUS_METERS,
  CANDIDATES_FOR_ELEVATION,
  type SuggestionDeps,
  type TownCandidate,
} from './suggestDestination'

export const osmClient = createOsmClient({
  email: import.meta.env.VITE_NOMINATIM_EMAIL || undefined,
})

const geoapifyKey: string | undefined = import.meta.env.VITE_GEOAPIFY_KEY || undefined

/** Respaldo de Overpass; null si no hay clave (la app sigue funcionando sin él). */
export const geoapifyClient = geoapifyKey ? createGeoapifyClient({ apiKey: geoapifyKey }) : null

/** Tiempos en carro (pueblos cercanos del Paso 2); null sin clave de Geoapify. */
export const travelTimes = geoapifyKey ? createTravelTimeClient({ apiKey: geoapifyKey }) : null

/** true si la app puede usar Geoapify (el pie de página muestra su atribución). */
export const usesGeoapify = geoapifyClient !== null

/** Intenta Overpass y, si falla, Geoapify (si está configurado). */
async function withGeoapifyFallback<T>(overpass: () => Promise<T>, geoapify: (() => Promise<T>) | null): Promise<T> {
  try {
    return await overpass()
  } catch (error) {
    if (!geoapify) throw error
    return geoapify()
  }
}

/**
 * Cliente para el motor de itinerarios (generateItinerary): geocodifica con
 * Nominatim y busca lugares en Overpass, con Geoapify de respaldo.
 */
export const placesClient: OsmClient = {
  geocode: (query) => osmClient.geocode(query),
  findPlaces: (center, radiusMeters, categories) =>
    withGeoapifyFallback(
      () => osmClient.findPlaces(center, radiusMeters, categories),
      geoapifyClient && (() => geoapifyClient.findPlaces(center, radiusMeters, categories)),
    ),
}

/**
 * Actividades de cada pueblo candidato del Modo B: salen de los conteos
 * precalculados (npm run data:activities), así que la respuesta es inmediata
 * y no depende de que Overpass esté disponible. Solo si algún pueblo no
 * estuviera en esos datos se pregunta a Overpass en vivo.
 */
async function checkActivities(centers: GeoPoint[], radiusMeters: number, categories: CategoryId[]) {
  const data = await loadAvailability()
  const known = centers.map((center) => {
    const id = (center as Partial<TownCandidate>).id
    const counts = id ? countsForTown(data, id) : null
    return counts ? availableCategories(withoutInlandBeaches(center, counts), categories) : null
  })
  if (known.every((k): k is CategoryId[] => k !== null)) return known
  const live = await osmClient.checkActivities(centers, radiusMeters, categories)
  return live.map((found, i) => (isCoastal(centers[i]) ? found : found.filter((c) => c !== 'playa')))
}

/**
 * Conteo en vivo de actividades alrededor de un punto: Overpass y, si falla,
 * Geoapify. Solo se usa para destinos que no están en los datos precalculados.
 */
export async function liveActivityCounts(point: GeoPoint): Promise<ActivityCounts> {
  const counts = await withGeoapifyFallback(
    async () => {
      const response = await osmClient.queryOverpass(buildActivityCountQuery([point], ACTIVITY_RADIUS_METERS, CATEGORY_IDS))
      return toCounts(CATEGORY_IDS, parseActivityTotals(response, 1, CATEGORY_IDS)[0])
    },
    geoapifyClient &&
      (async () => {
        const counts = await geoapifyClient.countActivities(point, ACTIVITY_RADIUS_METERS)
        return toCounts(CATEGORY_IDS, CATEGORY_IDS.map((c) => counts[c] ?? 0))
      }),
  )
  return withoutInlandBeaches(point, counts)
}

/** Dependencias de la sugerencia de destino (Modo B), sobre el mismo cliente OSM. */
export const suggestionDeps: SuggestionDeps = {
  // Lista precalculada (npm run data:towns). Se descarga solo al usar el Modo B.
  loadTowns: async () => (await import('../../data/colombiaTowns.json')).default.towns as TownCandidate[],
  checkActivities,
  elevation: createElevationClient(),
  // Con datos precalculados revisar todos los pueblos con el clima pedido no cuesta nada.
  candidatesToCheck: CANDIDATES_FOR_ELEVATION,
  batchSize: CANDIDATES_FOR_ELEVATION,
}
