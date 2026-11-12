import { describe, expect, it } from 'vitest'
import type { TripDetails } from '../../../types/flow'
import { initialTripFlowState, tripFlowReducer } from '../tripFlowContext'

const trip: TripDetails = {
  mode: 'known',
  destination: { query: 'Cartagena', displayName: 'Cartagena, Colombia', lat: 10.42, lon: -75.54, radiusMeters: 8000 },
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  budgetCOP: 2_000_000,
  travelers: 2,
  rooms: 1,
}

describe('tripFlowReducer', () => {
  it('completar el Paso 1 guarda los datos y avanza al Paso 2', () => {
    const state = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    expect(state.step).toBe(2)
    expect(state.trip).toEqual(trip)
  })

  it('no deja saltar pasos sin haber completado el Paso 1', () => {
    expect(tripFlowReducer(initialTripFlowState, { type: 'GO_TO_STEP', step: 3 }).step).toBe(1)
  })

  it('volver al Paso 1 conserva los datos para editarlos', () => {
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    const back = tripFlowReducer(atStep2, { type: 'GO_TO_STEP', step: 1 })
    expect(back.step).toBe(1)
    expect(back.trip).toEqual(trip)
  })

  it('en Modo B guarda también las actividades elegidas en el Paso 1', () => {
    const state = tripFlowReducer(initialTripFlowState, {
      type: 'COMPLETE_TRIP_DETAILS',
      trip: { ...trip, mode: 'suggested' },
      categories: ['cultura', 'aventura'],
    })
    expect(state.categories).toEqual(['cultura', 'aventura'])
  })
})
