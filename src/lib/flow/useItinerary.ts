/**
 * Itinerario del Paso 3: llama al motor (planItinerary) con lo elegido en los
 * pasos 1 y 2. Busca lugares en Overpass y, si falla, en Geoapify
 * (placesClient).
 *
 * El resultado se guarda en sessionStorage: volver al Paso 2 sin cambiar nada
 * y regresar muestra el mismo plan al instante, sin repetir consultas.
 */
import { useEffect, useState } from 'react'
import type { TripDetails, TripPace } from '../../types/flow'
import type { CategoryId, Itinerary } from '../../types/itinerary'
import { placesClient } from '../itinerary/browserClient'
import { ItineraryError } from '../itinerary/errors'
import { planItinerary } from '../itinerary/generateItinerary'
import { PACES } from './pace'

export type ItineraryState =
  | { status: 'loading' }
  | { status: 'done'; itinerary: Itinerary }
  | { status: 'error'; message: string; code?: ItineraryError['code'] }

const CACHE_PREFIX = 'locus:itinerary:v1:'

/** Identifica un plan: mismo destino, fechas, actividades y ritmo → mismo itinerario. */
export function itineraryKey(trip: TripDetails, categories: readonly CategoryId[], pace: TripPace): string {
  const { lat, lon } = trip.destination
  return [lat.toFixed(4), lon.toFixed(4), trip.startDate, trip.endDate, [...categories].sort().join('+'), pace].join('|')
}

function readCache(key: string): Itinerary | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as Itinerary) : null
  } catch {
    return null
  }
}

function writeCache(key: string, itinerary: Itinerary) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(itinerary))
  } catch {
    // Sin espacio o bloqueado: solo perdemos la caché.
  }
}

/** Una sola generación a la vez por plan (React monta dos veces en desarrollo). */
const inFlight = new Map<string, Promise<Itinerary>>()

function generateOnce(key: string, run: () => Promise<Itinerary>): Promise<Itinerary> {
  const running = inFlight.get(key)
  if (running) return running
  const promise = run()
    .then((itinerary) => {
      writeCache(key, itinerary)
      return itinerary
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

export function useItinerary(
  trip: TripDetails | null,
  categories: readonly CategoryId[],
  pace: TripPace,
): { state: ItineraryState; retry: () => void } {
  const key = trip ? itineraryKey(trip, categories, pace) : ''
  const [result, setResult] = useState<{ key: string; state: ItineraryState } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const cached = key ? readCache(key) : null

  useEffect(() => {
    if (!trip || !key || readCache(key)) return
    let cancelled = false
    generateOnce(key, () =>
      planItinerary(
        trip.destination,
        {
          destination: trip.destination.query,
          startDate: trip.startDate,
          endDate: trip.endDate,
          budgetCOP: trip.budgetCOP,
          categories: [...categories],
        },
        placesClient,
        { activitiesPerDay: PACES[pace].placesPerDay },
      ),
    ).then(
      (itinerary) => {
        if (!cancelled) setResult({ key, state: { status: 'done', itinerary } })
      },
      (error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof ItineraryError ? error.message : 'Ocurrió un error inesperado al armar tu itinerario.'
        const code = error instanceof ItineraryError ? error.code : undefined
        setResult({ key, state: { status: 'error', message, code } })
      },
    )
    return () => {
      cancelled = true
    }
    // trip, categories y pace están resumidos en `key`; `attempt` fuerza un reintento.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const state: ItineraryState = cached
    ? { status: 'done', itinerary: cached }
    : result?.key === key
      ? result.state
      : { status: 'loading' }

  return {
    state,
    // Borra el error (vuelve a "cargando") y repite la generación.
    retry: () => {
      setResult(null)
      setAttempt((n) => n + 1)
    },
  }
}
