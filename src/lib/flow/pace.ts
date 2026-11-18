/**
 * Ritmo del viaje (Paso 2): cuántos lugares por día incluye el itinerario.
 * El motor lo recibe como `activitiesPerDay` (ver generateItinerary.ts).
 */
import type { TripPace } from '../../types/flow'
import { getT } from '../i18n/store'

export interface PaceDefinition {
  id: TripPace
  label: string
  placesPerDay: number
  description: string
}

export const PACES: Record<TripPace, PaceDefinition> = {
  tranquilo: {
    id: 'tranquilo',
    get label() {
      return getT()('pace.tranquilo')
    },
    placesPerDay: 3,
    get description() {
      return getT()('pace.tranquilo.desc')
    },
  },
  normal: {
    id: 'normal',
    get label() {
      return getT()('pace.normal')
    },
    placesPerDay: 4,
    get description() {
      return getT()('pace.normal.desc')
    },
  },
  intenso: {
    id: 'intenso',
    get label() {
      return getT()('pace.intenso')
    },
    placesPerDay: 5,
    get description() {
      return getT()('pace.intenso.desc')
    },
  },
}

export const PACE_IDS = Object.keys(PACES) as TripPace[]
