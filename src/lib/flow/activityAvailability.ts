/**
 * Qué actividades hay alrededor de un destino, a partir de los conteos
 * precalculados en src/data/activityAvailability.json (npm run data:activities).
 *
 * Así el Paso 2 no ofrece "Playa" en Bogotá y el Modo B confirma las
 * actividades de cada pueblo al instante, sin depender de Overpass en vivo.
 */
import type { CategoryId, GeoPoint } from '../../types/itinerary'
import { SAME_NAME_KM, SAME_PLACE_KM, findFeaturedNear, placeKey } from '../featuredDestinations'
import { withoutInlandBeaches } from '../itinerary/coast'
import { haversineKm } from '../itinerary/geo'
import type { TownCandidate } from '../itinerary/suggestDestination'

/** Formato del JSON generado por scripts/build-activity-availability.ts. */
export interface AvailabilityData {
  radiusMeters: number
  /** Orden de los números de cada lugar. */
  categories: CategoryId[]
  featured: Record<string, number[]>
  towns: Record<string, number[]>
}

/** Número de lugares de cada actividad cerca del destino. */
export type ActivityCounts = Record<CategoryId, number>


export function toCounts(categories: CategoryId[], totals: number[]): ActivityCounts {
  return Object.fromEntries(categories.map((category, i) => [category, totals[i] ?? 0])) as ActivityCounts
}

/** Actividades con al menos un lugar, en el orden de `categories`. */
export function availableCategories(counts: ActivityCounts, categories: CategoryId[]): CategoryId[] {
  return categories.filter((category) => counts[category] > 0)
}

/** Conteos de un pueblo de la lista (por su id de OSM), o null si no está. */
export function countsForTown(data: AvailabilityData, townId: string): ActivityCounts | null {
  const totals = data.towns[townId]
  return totals ? toCounts(data.categories, totals) : null
}

/**
 * Conteos para un destino: los del destino destacado o del pueblo de la
 * lista que sean EL MISMO lugar (mismo nombre y cerca, o a menos de
 * SAME_PLACE_KM). Nunca los de un pueblo vecino: si el lugar no está en los
 * datos, devuelve null y la app consulta en vivo.
 */
export function countsNear(
  point: GeoPoint & { displayName?: string },
  data: AvailabilityData,
  towns: readonly TownCandidate[],
): ActivityCounts | null {
  const featured = findFeaturedNear(point)
  if (featured && data.featured[featured.id]) return withoutInlandBeaches(point, toCounts(data.categories, data.featured[featured.id]))

  const key = point.displayName ? placeKey(point.displayName) : null
  let best: { town: TownCandidate; km: number } | null = null
  for (const town of towns) {
    const km = haversineKm(point, town)
    const same = km < SAME_PLACE_KM || (key !== null && placeKey(town.name) === key && km < SAME_NAME_KM)
    if (same && (!best || km < best.km)) best = { town, km }
  }
  const counts = best ? countsForTown(data, best.town.id) : null
  // OSM también llama "playa" a orillas de ríos y lagunas (Pasto): solo cuenta junto al mar.
  return counts && withoutInlandBeaches(point, counts)
}

let cache: Promise<AvailabilityData> | null = null

/** Carga el JSON una sola vez (se descarga aparte, solo cuando hace falta). */
export function loadAvailability(): Promise<AvailabilityData> {
  cache ??= import('../../data/activityAvailability.json').then((m) => m.default as unknown as AvailabilityData)
  return cache
}
