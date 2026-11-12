/**
 * Convierte lo que el usuario escribió en la barra (Modo A) en un destino con
 * coordenadas, de la forma más confiable posible:
 *
 *   1. Si coincide con un destino destacado ("Cartagena", "Salento"…), usamos
 *      sus coordenadas guardadas: sin red y sin ambigüedad.
 *   2. Si no, preguntamos a Nominatim (solo Colombia, ver osm.ts).
 *   3. Si Nominatim no responde (caído, sin red o límite de peticiones),
 *      buscamos el nombre en la lista local de pueblos de Colombia
 *      (src/data/colombiaTowns.json). Así el Paso 1 funciona aunque falle el
 *      servicio de mapas.
 */
import type { Destination } from '../../types/itinerary'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'
import { ItineraryError } from '../itinerary/errors'
import type { TownCandidate } from '../itinerary/suggestDestination'

/** "Bogotá, Colombia" → "bogota"; "Salento, Quindío" → "salento quindio". */
export function normalizePlaceName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\bcolombia\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Variantes a comparar: el texto completo y solo la parte antes de la primera coma. */
function nameVariants(query: string): string[] {
  const full = normalizePlaceName(query)
  const first = normalizePlaceName(query.split(',')[0] ?? '')
  return [...new Set([full, first].filter(Boolean))]
}

/** Destino destacado cuyo nombre coincide con lo escrito, o null. */
export function findFeaturedDestination(query: string): Destination | null {
  const variants = nameVariants(query)
  const match = FEATURED_DESTINATIONS.find((item) =>
    [item.name, item.destination.query, item.destination.displayName]
      .map(normalizePlaceName)
      .some((name) => variants.includes(name)),
  )
  return match ? { ...match.destination, query: query.trim() } : null
}

/** Radio de búsqueda para un pueblo de la lista local (no hay bbox como en Nominatim). */
const TOWN_RADIUS_METERS = { city: 8000, town: 5000 } as const

/**
 * Pueblo de la lista local cuyo nombre coincide con lo escrito, o null.
 * La lista viene ordenada por popularidad: si hay dos con el mismo nombre
 * (ej. "Rionegro"), gana el más conocido.
 */
export function findTownDestination(query: string, towns: readonly TownCandidate[]): Destination | null {
  const variants = nameVariants(query)
  const town = towns.find((t) => variants.includes(normalizePlaceName(t.name)))
  if (!town) return null
  return {
    query: query.trim(),
    displayName: `${town.name}, Colombia`,
    lat: town.lat,
    lon: town.lon,
    radiusMeters: TOWN_RADIUS_METERS[town.place as keyof typeof TOWN_RADIUS_METERS] ?? TOWN_RADIUS_METERS.town,
  }
}

export interface ResolveDestinationDeps {
  /** Geocodificación en línea (geocodeDestination + Nominatim). Lanza ItineraryError. */
  geocode: (query: string) => Promise<Destination>
  /** Lista local de pueblos (se descarga solo si hace falta). */
  loadTowns: () => Promise<TownCandidate[]>
}

/** Errores que indican "el servicio no respondió", no "ese lugar no existe". */
const isServiceFailure = (error: unknown) =>
  error instanceof ItineraryError && (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'RATE_LIMITED')

export async function resolveDestination(query: string, deps: ResolveDestinationDeps): Promise<Destination> {
  const featured = findFeaturedDestination(query)
  if (featured) return featured

  try {
    return await deps.geocode(query)
  } catch (error) {
    if (!isServiceFailure(error)) throw error
    let towns: TownCandidate[]
    try {
      towns = await deps.loadTowns()
    } catch {
      throw error
    }
    const town = findTownDestination(query, towns)
    if (town) return town
    throw error
  }
}
