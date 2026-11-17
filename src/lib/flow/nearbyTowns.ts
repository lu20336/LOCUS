/**
 * Pueblos turísticos cercanos al destino, para la opción "Conocer pueblos
 * cercanos" del Paso 2. Cada pueblo elegido se vuelve un día de excursión en
 * el itinerario (ver planItinerary).
 *
 * Salen de src/data/touristTowns.json (npm run data:tourist-towns): una lista
 * escrita a mano de pueblos con algo especial (Barichara, Guatavita, Jardín…),
 * con coordenadas verificadas en Nominatim. No se usa la lista de municipios
 * más poblados porque cerca de Medellín propondría Bello o Itagüí.
 */
import data from '../../data/touristTowns.json'
import type { Excursion, GeoPoint } from '../../types/itinerary'
import { placeKey } from '../featuredDestinations'
import { haversineKm } from '../itinerary/geo'

export interface TouristTown extends GeoPoint {
  id: string
  name: string
  region: string
  tagline: string
}

export const TOURIST_TOWNS: readonly TouristTown[] = data.towns

/** Más cerca que esto es el mismo lugar (o un barrio): ya entra en el itinerario normal. */
export const EXCURSION_MIN_KM = 8
/**
 * Más lejos que esto no es una excursión de un día (en línea recta; por
 * carretera en la montaña puede ser el doble).
 */
export const EXCURSION_MAX_KM = 110
/** Cuántos pueblos se ofrecen como máximo. */
export const MAX_NEARBY_TOWNS = 8

/**
 * Pueblos turísticos entre EXCURSION_MIN_KM y EXCURSION_MAX_KM del destino,
 * del más cercano al más lejano. Nunca el propio destino (mismo nombre).
 */
export function nearbyTowns(
  destination: GeoPoint & { displayName?: string },
  towns: readonly TouristTown[] = TOURIST_TOWNS,
  limit = MAX_NEARBY_TOWNS,
): Excursion[] {
  const ownName = destination.displayName ? placeKey(destination.displayName) : null
  return towns
    .map((town) => ({ ...town, distanceKm: Math.round(haversineKm(destination, town)) }))
    .filter(
      (town) =>
        town.distanceKm >= EXCURSION_MIN_KM &&
        town.distanceKm <= EXCURSION_MAX_KM &&
        placeKey(town.name) !== ownName,
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

/** Máximo de excursiones: siempre queda al menos un día en el destino principal. */
export const maxExcursions = (tripDays: number) => Math.max(0, tripDays - 1)
