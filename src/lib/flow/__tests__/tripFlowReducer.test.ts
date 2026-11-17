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

  it('completar el Paso 2 guarda actividades y ritmo, y avanza al Paso 3', () => {
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    const state = tripFlowReducer(atStep2, {
      type: 'COMPLETE_ACTIVITIES',
      categories: ['playa', 'gastronomia', 'playa'],
      pace: 'intenso',
    })
    expect(state.step).toBe(3)
    expect(state.categories).toEqual(['playa', 'gastronomia']) // sin repetidas
    expect(state.pace).toBe('intenso')
  })

  it('el Paso 2 no avanza sin actividades ni sin haber completado el Paso 1', () => {
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    expect(tripFlowReducer(atStep2, { type: 'COMPLETE_ACTIVITIES', categories: [], pace: 'normal' })).toBe(atStep2)
    expect(
      tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'normal' }),
    ).toBe(initialTripFlowState)
  })

  it('no deja ir al Paso 3 sin actividades elegidas', () => {
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    expect(tripFlowReducer(atStep2, { type: 'GO_TO_STEP', step: 3 }).step).toBe(2)
  })

  it('volver del Paso 3 al Paso 2 conserva actividades y ritmo', () => {
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    const atStep3 = tripFlowReducer(atStep2, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'tranquilo' })
    const back = tripFlowReducer(atStep3, { type: 'GO_TO_STEP', step: 2 })
    expect(back).toMatchObject({ step: 2, categories: ['cultura'], pace: 'tranquilo' })
  })

  it('guarda los pueblos para excursiones y los olvida si cambia el destino', () => {
    const turbaco = { id: 'turbaco', name: 'Turbaco', region: 'Bolívar', tagline: 'x', lat: 10.33, lon: -75.41, distanceKm: 18 }
    const atStep2 = tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip })
    const atStep3 = tripFlowReducer(atStep2, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'normal', excursions: [turbaco] })
    expect(atStep3.excursions).toEqual([turbaco])
    // Mismo destino (editar fechas): se conservan.
    expect(tripFlowReducer(atStep3, { type: 'COMPLETE_TRIP_DETAILS', trip }).excursions).toEqual([turbaco])
    // Otro destino: ya no aplican.
    const otro = { ...trip, destination: { ...trip.destination, lat: 6.24, lon: -75.58 } }
    expect(tripFlowReducer(atStep3, { type: 'COMPLETE_TRIP_DETAILS', trip: otro }).excursions).toEqual([])
  })

  it('el ritmo empieza en "normal"', () => {
    expect(initialTripFlowState.pace).toBe('normal')
  })

  it('en Modo B guarda también las actividades elegidas en el Paso 1', () => {
    const state = tripFlowReducer(initialTripFlowState, {
      type: 'COMPLETE_TRIP_DETAILS',
      trip: { ...trip, mode: 'suggested' },
      categories: ['cultura', 'aventura'],
    })
    expect(state.categories).toEqual(['cultura', 'aventura'])
  })

  it('al cambiar las actividades o el ritmo se descarta el itinerario generado; si no cambian, se conserva', () => {
    const itinerary = { input: {}, destination: trip.destination, days: [], missingCategories: [], stats: {}, generatedAt: '' } as never
    const at3 = { ...tripFlowReducer(tripFlowReducer(initialTripFlowState, { type: 'COMPLETE_TRIP_DETAILS', trip }), { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'normal' }), itinerary }
    expect(tripFlowReducer(at3, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'normal' }).itinerary).toBe(itinerary)
    expect(tripFlowReducer(at3, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura', 'playa'], pace: 'normal' }).itinerary).toBeNull()
    expect(tripFlowReducer(at3, { type: 'COMPLETE_ACTIVITIES', categories: ['cultura'], pace: 'intenso' }).itinerary).toBeNull()
  })
})
