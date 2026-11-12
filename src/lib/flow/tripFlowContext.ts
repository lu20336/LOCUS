/**
 * Estado del flujo de 4 pasos, compartido con React Context.
 *
 * - TripFlowProvider (TripFlowProvider.tsx) guarda el estado y envuelve la app.
 * - useTripFlow() lo lee desde cualquier pantalla.
 *
 * Los cambios de estado pasan por un reducer: una función pura que recibe el
 * estado actual y una acción, y devuelve el estado nuevo. Así todas las
 * transiciones del flujo están en un solo lugar y se pueden probar.
 */
import { createContext, useContext } from 'react'
import type { FlowStep, SuggestionSearch, TripDetails, TripFlowState } from '../../types/flow'
import type { CategoryId } from '../../types/itinerary'

export type TripFlowAction =
  | {
      type: 'COMPLETE_TRIP_DETAILS'
      trip: TripDetails
      /** Solo en Modo B: las actividades ya se eligieron en el Paso 1. */
      categories?: CategoryId[]
      suggestionSearch?: SuggestionSearch | null
    }
  | { type: 'GO_TO_STEP'; step: FlowStep }

export const initialTripFlowState: TripFlowState = {
  step: 1,
  trip: null,
  categories: [],
  suggestionSearch: null,
}

export function tripFlowReducer(state: TripFlowState, action: TripFlowAction): TripFlowState {
  switch (action.type) {
    case 'COMPLETE_TRIP_DETAILS':
      // Guarda los datos del Paso 1 y avanza al Paso 2.
      return {
        ...state,
        trip: action.trip,
        categories: action.categories ?? state.categories,
        suggestionSearch: action.suggestionSearch !== undefined ? action.suggestionSearch : state.suggestionSearch,
        step: 2,
      }
    case 'GO_TO_STEP':
      // No se puede saltar a un paso posterior sin haber completado el Paso 1.
      if (action.step > 1 && !state.trip) return state
      return { ...state, step: action.step }
  }
}

export interface TripFlowContextValue extends TripFlowState {
  completeTripDetails: (
    trip: TripDetails,
    extras?: { categories?: CategoryId[]; suggestionSearch?: SuggestionSearch | null },
  ) => void
  goToStep: (step: FlowStep) => void
}

export const TripFlowContext = createContext<TripFlowContextValue | null>(null)

export function useTripFlow(): TripFlowContextValue {
  const value = useContext(TripFlowContext)
  if (!value) throw new Error('useTripFlow debe usarse dentro de <TripFlowProvider>')
  return value
}
