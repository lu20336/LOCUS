/**
 * Cuántos lugares de cada actividad hay cerca del destino del viaje.
 *   1. Datos precalculados, si el destino ES un destacado o un pueblo de la
 *      lista (mismo nombre o mismo punto): inmediato.
 *   2. Si no, en vivo: Overpass y, si falla, Geoapify (browserClient).
 *   3. Si nada responde: 'unknown' (el Paso 2 deja elegir cualquiera).
 */
import { useEffect, useState } from 'react'
import type { Destination } from '../../types/itinerary'
import { liveActivityCounts, suggestionDeps } from '../itinerary/browserClient'
import { countsNear, loadAvailability, type ActivityCounts } from './activityAvailability'

export type AvailabilityState =
  | { status: 'loading' }
  | { status: 'ready'; counts: ActivityCounts }
  | { status: 'unknown' }

export function useActivityCounts(destination: Destination | null): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>({ status: 'loading' })
  const lat = destination?.lat
  const lon = destination?.lon
  const displayName = destination?.displayName

  useEffect(() => {
    if (lat === undefined || lon === undefined) return
    let cancelled = false
    const done = (next: AvailabilityState) => {
      if (!cancelled) setState(next)
    }
    ;(async () => {
      try {
        const [data, towns] = await Promise.all([loadAvailability(), suggestionDeps.loadTowns()])
        const counts = countsNear({ lat, lon, displayName }, data, towns)
        done({ status: 'ready', counts: counts ?? (await liveActivityCounts({ lat, lon })) })
      } catch {
        done({ status: 'unknown' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lat, lon, displayName])

  return state
}
