// Tipos del flujo de 4 pasos de la app.
import type { ClimateId, SuggestionResult } from '../lib/itinerary/suggestDestination'
import type { CategoryId, Destination } from './itinerary'

/** 1 = Tu viaje · 2 = Actividades · 3 = Itinerario · 4 = Confirmación */
export type FlowStep = 1 | 2 | 3 | 4

/**
 * Cómo eligió el destino el usuario en el Paso 1:
 * - 'known'     (Modo A): lo escribió; las actividades se eligen en el Paso 2.
 * - 'suggested' (Modo B): eligió clima + actividades y tomó una sugerencia.
 */
export type DestinationMode = 'known' | 'suggested'

/** Estado de la búsqueda del Modo B (se conserva al volver al Paso 1). */
export interface SuggestionSearch {
  climate: ClimateId | null
  /** Actividades marcadas en los chips. */
  categories: CategoryId[]
  /** Último resultado (null si aún no se busca o si cambiaron los filtros). */
  result: SuggestionResult | null
  /** ID del candidato elegido entre las sugerencias. */
  selectedId: string | null
}

/** Datos del Paso 1 ya validados (y con el destino geocodificado). */
export interface TripDetails {
  mode: DestinationMode
  /** Resultado de Nominatim (Modo A) o de la sugerencia elegida (Modo B). */
  destination: Destination
  /** Fechas ISO "AAAA-MM-DD". */
  startDate: string
  endDate: string
  budgetCOP: number
  /** Número de viajeros (mínimo 1). */
  travelers: number
  /** Número de habitaciones (mínimo 1, como máximo una por viajero). */
  rooms: number
}

export interface TripFlowState {
  step: FlowStep
  trip: TripDetails | null
  categories: CategoryId[]
  suggestionSearch: SuggestionSearch | null
}
