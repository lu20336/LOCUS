import { useMemo, useReducer, type ReactNode } from 'react'
import { TripFlowContext, initialTripFlowState, tripFlowReducer, type TripFlowContextValue } from './tripFlowContext'

/** Envuelve la app y pone el estado del flujo a disposición de todas las pantallas. */
export function TripFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripFlowReducer, initialTripFlowState)

  // Las acciones usan `dispatch` (estable): su identidad no cambia entre renders, así
  // que se pueden poner en las dependencias de un efecto sin provocar bucles.
  const actions = useMemo(
    () => ({
      completeTripDetails: ((trip, extras) => dispatch({ type: 'COMPLETE_TRIP_DETAILS', trip, ...extras })) as TripFlowContextValue['completeTripDetails'],
      completeActivities: ((categories, pace) => dispatch({ type: 'COMPLETE_ACTIVITIES', categories, pace })) as TripFlowContextValue['completeActivities'],
      goToStep: ((step) => dispatch({ type: 'GO_TO_STEP', step })) as TripFlowContextValue['goToStep'],
      setCategories: ((categories) => dispatch({ type: 'SET_CATEGORIES', categories })) as TripFlowContextValue['setCategories'],
      setItinerary: ((itinerary) => dispatch({ type: 'SET_ITINERARY', itinerary })) as TripFlowContextValue['setItinerary'],
    }),
    [],
  )
  const value = useMemo<TripFlowContextValue>(() => ({ ...state, ...actions }), [state, actions])

  return <TripFlowContext.Provider value={value}>{children}</TripFlowContext.Provider>
}
