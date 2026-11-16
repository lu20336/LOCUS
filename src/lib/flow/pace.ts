/**
 * Ritmo del viaje (Paso 2): cuántos lugares por día incluye el itinerario.
 * El motor lo recibe como `activitiesPerDay` (ver generateItinerary.ts).
 */
import type { TripPace } from '../../types/flow'

export interface PaceDefinition {
  id: TripPace
  label: string
  placesPerDay: number
  description: string
}

export const PACES: Record<TripPace, PaceDefinition> = {
  tranquilo: { id: 'tranquilo', label: 'Tranquilo', placesPerDay: 3, description: 'Más tiempo en cada lugar' },
  normal: { id: 'normal', label: 'Equilibrado', placesPerDay: 4, description: 'Lo recomendado para la mayoría' },
  intenso: { id: 'intenso', label: 'Intenso', placesPerDay: 5, description: 'Ver lo máximo posible' },
}

export const PACE_IDS = Object.keys(PACES) as TripPace[]
