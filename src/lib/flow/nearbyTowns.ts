/**
 * Pueblos turísticos cercanos al destino, para la opción "Conocer pueblos
 * cercanos" del Paso 2. Cada pueblo elegido se vuelve un día de excursión en
 * el itinerario (ver planItinerary).
 *
 * Salen de src/data/touristTowns.json (npm run data:tourist-towns): una lista
 * escrita a mano de pueblos con algo especial (Barichara, Guatavita, Jardín…),
 * con coordenadas verificadas en Nominatim. No se usa la lista de municipios
 * más poblados porque cerca de Medellín propondría Bello o Itagüí.
 *
 * "Cercano" se mide en TIEMPO EN CARRO (Geoapify Route Matrix): en la montaña
 * la línea recta engaña (Villavicencio–Sopó: 92 km en línea recta, más de
 * 2 h 30 por carretera). Sin clave de Geoapify, o si falla, se usa una
 * distancia en línea recta corta y prudente.
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
  /** Lo imperdible del pueblo, con coordenadas verificadas (entra siempre en su día). */
  highlight?: Excursion['highlight']
}

export const TOURIST_TOWNS: readonly TouristTown[] = data.towns as TouristTown[]

/** Más cerca que esto es el mismo lugar (o un barrio): ya entra en el itinerario normal. */
export const EXCURSION_MIN_KM = 8
/** Candidatos a revisar en carro: más lejos que esto en línea recta nunca queda a 2 h. */
export const CANDIDATE_MAX_KM = 150
/** Máximo en carro (sin tráfico) para una excursión de ida y vuelta en el día. */
export const MAX_DRIVE_MINUTES = 120
/** Sin tiempos en carro: solo pueblos a esta distancia en línea recta. */
export const FALLBACK_MAX_KM = 45
/** Cuántos pueblos se ofrecen como máximo. */
export const MAX_NEARBY_TOWNS = 8

/** Pueblos de la lista entre EXCURSION_MIN_KM y `maxKm` en línea recta, sin el propio destino. */
export function townsWithinKm(
  destination: GeoPoint & { displayName?: string },
  maxKm: number,
  towns: readonly TouristTown[] = TOURIST_TOWNS,
): Excursion[] {
  const ownName = destination.displayName ? placeKey(destination.displayName) : null
  return towns
    .map((town) => ({ ...town, distanceKm: Math.round(haversineKm(destination, town)) }))
    .filter((town) => town.distanceKm >= EXCURSION_MIN_KM && town.distanceKm <= maxKm && placeKey(town.name) !== ownName)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/** Candidatos para pedir el tiempo en carro. */
export const nearbyCandidates = (destination: GeoPoint & { displayName?: string }) =>
  townsWithinKm(destination, CANDIDATE_MAX_KM)

/**
 * Con los minutos en carro de cada candidato (mismo orden): los que quedan a
 * MAX_DRIVE_MINUTES o menos, del más rápido al más lento.
 */
export function pickByDrivingTime(candidates: readonly Excursion[], minutes: readonly (number | null)[]): Excursion[] {
  return candidates
    .map((town, i) => ({ ...town, driveMinutes: minutes[i] ?? undefined }))
    .filter((town) => town.driveMinutes !== undefined && town.driveMinutes <= MAX_DRIVE_MINUTES)
    .sort((a, b) => a.driveMinutes! - b.driveMinutes!)
    .slice(0, MAX_NEARBY_TOWNS)
}

/** Sin tiempos en carro: solo los muy cercanos en línea recta. */
export const fallbackNearbyTowns = (destination: GeoPoint & { displayName?: string }) =>
  townsWithinKm(destination, FALLBACK_MAX_KM).slice(0, MAX_NEARBY_TOWNS)

/** Máximo de excursiones: siempre queda al menos un día en el destino principal. */
export const maxExcursions = (tripDays: number) => Math.max(0, tripDays - 1)
