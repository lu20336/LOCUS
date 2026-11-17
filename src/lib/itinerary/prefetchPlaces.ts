/**
 * Búsqueda de lugares POR ADELANTADO.
 *
 * Buscar lugares tarda unos segundos (Overpass o Geoapify). En vez de empezar
 * cuando el usuario pulsa "Generar itinerario", se empieza apenas se conoce el
 * destino (Paso 1) o un pueblo de excursión (Paso 2), pidiendo TODAS las
 * actividades de una vez. Cuando el motor pide algunas, se filtran de lo que
 * ya llegó (o de lo que está llegando): no se repiten consultas.
 */
import type { CategoryId, GeoPoint, Place } from '../../types/itinerary'
import type { OsmClient } from './osmClient'

export function createPrefetchingClient(base: Pick<OsmClient, 'findPlaces'>, allCategories: readonly CategoryId[]) {
  const cache = new Map<string, Promise<Place[]>>()
  const keyOf = (center: GeoPoint, radiusMeters: number) =>
    `${center.lat.toFixed(4)},${center.lon.toFixed(4)},${Math.round(radiusMeters)}`

  function prefetch(center: GeoPoint, radiusMeters: number): Promise<Place[]> {
    const key = keyOf(center, radiusMeters)
    let pending = cache.get(key)
    if (!pending) {
      pending = base.findPlaces(center, radiusMeters, [...allCategories])
      // Si falla, se olvida: el próximo intento vuelve a consultar.
      pending.catch(() => cache.delete(key))
      cache.set(key, pending)
    }
    return pending
  }

  async function findPlaces(center: GeoPoint, radiusMeters: number, categories: CategoryId[]): Promise<Place[]> {
    const pending = cache.get(keyOf(center, radiusMeters))
    if (pending) {
      try {
        const wanted = new Set(categories)
        return (await pending).filter((p) => wanted.has(p.category))
      } catch {
        // La búsqueda anticipada falló: se hace la normal.
      }
    }
    return base.findPlaces(center, radiusMeters, categories)
  }

  return { prefetch, findPlaces }
}
