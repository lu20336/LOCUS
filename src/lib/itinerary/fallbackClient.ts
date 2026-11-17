/**
 * Cliente de lugares con RESPALDOS. Los servidores públicos de Overpass se
 * saturan con frecuencia; la consulta en vivo (Overpass y, si hay clave,
 * Geoapify, ver browserClient.ts) y, si falla, en orden:
 *   1. los lugares precalculados de los destinos destacados
 *      (src/data/featuredPlaces.json, generado con `npm run data:reference`),
 *   2. Nominatim en vivo (búsqueda por categoría),
 *   3. si nada responde, se propaga el error original.
 */
import type { CategoryId, GeoPoint, Place } from '../../types/itinerary'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'
import { osmClient, placesClient as overpassPlacesClient } from './browserClient'
import { placesViaNominatim } from './nominatimPlaces'
import { haversineKm } from './geo'
import type { OsmClient } from './osmClient'
import { CATEGORY_IDS } from './categories'
import { createPrefetchingClient } from './prefetchPlaces'

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
export const placesSource: { last: 'live' | 'static' | 'nominatim'; generatedAt?: string } = { last: 'live' }

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

const livePlacesClient: OsmClient = {
  geocode: (query) => osmClient.geocode(query),
  async findPlaces(center, radiusMeters, categories) {
    try {
      // Overpass y, si falla y hay clave, Geoapify (cliente de browserClient).
      const live = await overpassPlacesClient.findPlaces(center, radiusMeters, categories)
      placesSource.last = 'live'
      return live
    } catch (error) {
      // 1) lugares precalculados (destinos destacados); 2) Nominatim en vivo; 3) el error original.
      const fallback = await staticPlacesFor(center, categories)
      if (fallback) {
        const data = await loadStatic()
        placesSource.last = 'static'
        placesSource.generatedAt = data?.generatedAt
        return fallback
      }
      try {
        const viaNominatim = await placesViaNominatim(osmClient, center, radiusMeters, categories)
        if (viaNominatim.length > 0) {
          placesSource.last = 'nominatim'
          return viaNominatim
        }
      } catch {
        // se propaga el error original de Overpass
      }
      throw error
    }
  },
}

/**
 * Cliente que usa el Paso 3. Busca los lugares de TODAS las actividades por
 * adelantado (prefetchPlaces, desde que se elige el destino en el Paso 1 o
 * un pueblo en el Paso 2), así al pulsar "Generar itinerario" ya están.
 */
const prefetching = createPrefetchingClient(livePlacesClient, CATEGORY_IDS)

export const placesClient: OsmClient = { geocode: livePlacesClient.geocode, findPlaces: prefetching.findPlaces }

/** Empieza a buscar en segundo plano los lugares alrededor de un punto. */
export const prefetchPlaces = (center: GeoPoint, radiusMeters: number) => {
  prefetching.prefetch(center, radiusMeters).catch(() => {
    // Si falla, el Paso 3 vuelve a intentarlo con su propia búsqueda.
  })
}
