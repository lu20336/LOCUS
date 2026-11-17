/**
 * Pueblos cercanos al destino para el Paso 2, filtrados por tiempo en carro
 * (ver nearbyTowns.ts). Se guardan en sessionStorage por destino.
 */
import { useEffect, useState } from 'react'
import type { Destination, Excursion } from '../../types/itinerary'
import { travelTimes } from '../itinerary/browserClient'
import { fallbackNearbyTowns, nearbyCandidates, pickByDrivingTime } from './nearbyTowns'

export type NearbyTownsState =
  | { status: 'loading' }
  /** byRoad: true si se filtró por tiempo en carro; false si por línea recta (respaldo). */
  | { status: 'ready'; towns: Excursion[]; byRoad: boolean }

const CACHE_PREFIX = 'locus:nearby-towns:v1:'

function readCache(key: string): { towns: Excursion[]; byRoad: boolean } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: { towns: Excursion[]; byRoad: boolean }) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value))
  } catch {
    // Sin caché: se vuelve a calcular la próxima vez.
  }
}

/** Calcula los pueblos cercanos (tiempo en carro o, si no se puede, línea recta). */
export async function findNearbyTowns(destination: Destination): Promise<{ towns: Excursion[]; byRoad: boolean }> {
  const candidates = nearbyCandidates(destination)
  if (!travelTimes || candidates.length === 0) return { towns: fallbackNearbyTowns(destination), byRoad: false }
  try {
    const minutes = await travelTimes.drivingMinutes(destination, candidates)
    return { towns: pickByDrivingTime(candidates, minutes), byRoad: true }
  } catch {
    return { towns: fallbackNearbyTowns(destination), byRoad: false }
  }
}

export function useNearbyTowns(destination: Destination | null): NearbyTownsState {
  const key = destination ? `${destination.lat.toFixed(4)},${destination.lon.toFixed(4)}` : ''
  const [result, setResult] = useState<{ key: string; towns: Excursion[]; byRoad: boolean } | null>(null)
  const cached = key ? readCache(key) : null

  useEffect(() => {
    if (!destination || !key || readCache(key)) return
    let cancelled = false
    findNearbyTowns(destination).then((value) => {
      if (value.byRoad) writeCache(key, value) // el respaldo no se guarda: se reintenta luego
      if (!cancelled) setResult({ key, ...value })
    })
    return () => {
      cancelled = true
    }
    // `key` resume las coordenadas del destino.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (cached) return { status: 'ready', ...cached }
  if (result?.key === key) return { status: 'ready', towns: result.towns, byRoad: result.byRoad }
  return { status: 'loading' }
}
