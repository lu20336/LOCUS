import { useMemo, useReducer, type ReactNode } from 'react'
import { TripFlowContext, initialTripFlowState, tripFlowReducer, type TripFlowContextValue } from './tripFlowContext'

/** Envuelve la app y pone el estado del flujo a disposición de todas las pantallas. */
export function TripFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripFlowReducer, initialTripFlowState)

  const value = useMemo<TripFlowContextValue>(
    () => ({
      ...state,
      completeTripDetails: (trip, extras) => dispatch({ type: 'COMPLETE_TRIP_DETAILS', trip, ...extras }),
      goToStep: (step) => dispatch({ type: 'GO_TO_STEP', step }),
      setCategories: (categories) => dispatch({ type: 'SET_CATEGORIES', categories }),
      setItinerary: (itinerary) => dispatch({ type: 'SET_ITINERARY', itinerary }),
    }),
    [state],
  )

  return <TripFlowContext.Provider value={value}>{children}</TripFlowContext.Provider>
}
