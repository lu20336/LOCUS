/**
 * Ajustes del itinerario en el Paso 3, antes de guardarlo:
 *   - dayParts: en qué momento del día va cada parada (mañana, tarde, noche).
 *   - removeStop / replaceStop: quitar una parada o cambiarla por otra de la
 *     misma actividad (de las que no entraron en el plan: day.alternatives).
 * Funciones puras: devuelven un itinerario nuevo, no modifican el original.
 */
import type { DayPlan, Itinerary, Place } from '../../types/itinerary'
import { haversineKm } from '../itinerary/geo'
import { routeDistanceKm } from '../itinerary/generateItinerary'

export type DayPart = 'mañana' | 'tarde' | 'noche'

export const DAY_PART_LABELS: Record<DayPart, string> = { mañana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }

/**
 * Momento del día de cada parada: la vida nocturna en la noche y el resto
 * repartido entre mañana y tarde (la mitad redondeada hacia arriba en la mañana).
 */
export function dayParts(places: readonly Pick<Place, 'category'>[]): DayPart[] {
  const daytime = places.filter((p) => p.category !== 'vidaNocturna').length
  const morning = Math.ceil(daytime / 2)
  let seen = 0
  return places.map((p) => {
    if (p.category === 'vidaNocturna') return 'noche'
    seen++
    return seen <= morning ? 'mañana' : 'tarde'
  })
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Recalcula la distancia del día y del viaje, y marca el plan como editado. */
function withDay(itinerary: Itinerary, dayIndex: number, places: Place[]): Itinerary {
  const days = itinerary.days.map((day, i): DayPlan => {
    if (i !== dayIndex) return day
    const start = day.excursion ?? itinerary.destination
    return { ...day, places, distanceKm: round1(routeDistanceKm(start, places)) }
  })
  const optimizedKm = round1(days.filter((d) => !d.excursion).reduce((sum, d) => sum + d.distanceKm, 0))
  return { ...itinerary, days, edited: true, stats: { ...itinerary.stats, optimizedKm, savingPercent: 0 } }
}

export function removeStop(itinerary: Itinerary, dayIndex: number, placeIndex: number): Itinerary {
  const places = itinerary.days[dayIndex].places.filter((_, i) => i !== placeIndex)
  return withDay(itinerary, dayIndex, places)
}

/**
 * La alternativa para una parada: de la misma actividad si hay, que no esté ya
 * en el plan, y la más cercana a la parada que reemplaza (así no cambia la ruta).
 */
export function alternativeFor(itinerary: Itinerary, dayIndex: number, placeIndex: number): Place | null {
  const day = itinerary.days[dayIndex]
  const current = day.places[placeIndex]
  const used = new Set(itinerary.days.flatMap((d) => d.places.map((p) => p.id)))
  const free = (day.alternatives ?? []).filter((p) => !used.has(p.id))
  const sameKind = free.filter((p) => p.category === current.category)
  const pool = sameKind.length > 0 ? sameKind : free
  return pool.reduce<Place | null>(
    (best, p) => (!best || haversineKm(current, p) < haversineKm(current, best) ? p : best),
    null,
  )
}

/** Cambia la parada por su alternativa (ver alternativeFor); null si no hay ninguna. */
export function replaceStop(itinerary: Itinerary, dayIndex: number, placeIndex: number): Itinerary | null {
  const next = alternativeFor(itinerary, dayIndex, placeIndex)
  if (!next) return null
  const places = itinerary.days[dayIndex].places.map((p, i) => (i === placeIndex ? next : p))
  return withDay(itinerary, dayIndex, places)
}
