/**
 * Cliente de lugares con RESPALDO estático. Los servidores públicos de Overpass
 * se saturan con frecuencia; si la consulta en vivo falla y el destino es uno
 * de los destacados, se usan los lugares precalculados de
 * src/data/featuredPlaces.json (generado con `npm run data:places`). Si ese
 * archivo no existe o el destino no es destacado, se propaga el error original.
 */
import type { CategoryId, GeoPoint, Place } from '../../types/itinerary'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'
import { osmClient } from './browserClient'
import { haversineKm } from './geo'
import type { OsmClient } from './osmClient'

interface StaticPlaces {
  generatedAt: string
  destinations: Record<string, Place[]>
}

// import.meta.glob no rompe el build si el archivo todavía no se generó.
const loaders = import.meta.glob<{ default: StaticPlaces }>('../../data/featuredPlaces.json')
let cache: Promise<StaticPlaces | null> | null = null

function loadStatic(): Promise<StaticPlaces | null> {
  const loader = Object.values(loaders)[0]
  if (!loader) return Promise.resolve(null)
  cache ??= loader().then((m) => m.default, () => null)
  return cache
}

/** Qué fuente respondió la última vez, para avisarle al usuario. */
export const placesSource: { last: 'live' | 'static'; generatedAt?: string } = { last: 'live' }

export async function staticPlacesFor(center: GeoPoint, categories: CategoryId[]): Promise<Place[] | null> {
  const data = await loadStatic()
  if (!data) return null
  const featured = FEATURED_DESTINATIONS.find((d) => haversineKm(center, d.destination) < 3)
  const places = featured ? data.destinations[featured.id] : undefined
  if (!places || places.length === 0) return null
  const wanted = new Set(categories)
  const filtered = places.filter((p) => wanted.has(p.category))
  return filtered.length > 0 ? filtered : null
}

export const placesClient: OsmClient = {
  geocode: (query) => osmClient.geocode(query),
  async findPlaces(center, radiusMeters, categories) {
    try {
      const live = await osmClient.findPlaces(center, radiusMeters, categories)
      placesSource.last = 'live'
      return live
    } catch (error) {
      const fallback = await staticPlacesFor(center, categories)
      if (!fallback) throw error
      const data = await loadStatic()
      placesSource.last = 'static'
      placesSource.generatedAt = data?.generatedAt
      return fallback
    }
  },
}
