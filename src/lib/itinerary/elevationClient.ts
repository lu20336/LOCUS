/**
 * Cliente de Open-Elevation (https://open-elevation.com): altitud sobre el
 * nivel del mar de una lista de coordenadas. Gratuito y sin API key.
 *
 * Usamos la variante GET (`?locations=lat,lon|lat,lon`) porque es una
 * petición "simple" de CORS y el navegador no necesita un preflight.
 */
import type { GeoPoint } from '../../types/itinerary'
import { OsmHttpError } from './errors'
import { createThrottle } from './throttle'

export const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup'

/** Puntos por petición (mantiene la URL por debajo de ~4 KB). */
const BATCH_SIZE = 100

export type ElevationLookup = (points: GeoPoint[]) => Promise<(number | null)[]>

interface OpenElevationResponse {
  results: { latitude: number; longitude: number; elevation: number | null }[]
}

export function createElevationClient(
  options: { fetchFn?: typeof fetch; url?: string; timeoutMs?: number } = {},
): ElevationLookup {
  const { fetchFn = (...args) => fetch(...args), url = OPEN_ELEVATION_URL, timeoutMs = 30_000 } = options
  const throttle = createThrottle(1000)

  /** Devuelve la altitud en metros de cada punto, en el mismo orden (null si no hay dato). */
  return async function lookup(points) {
    const elevations: (number | null)[] = []
    for (let start = 0; start < points.length; start += BATCH_SIZE) {
      const batch = points.slice(start, start + BATCH_SIZE)
      const locations = batch.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|')
      const data = await throttle(async () => {
        const response = await fetchFn(`${url}?locations=${locations}`, { signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) throw new OsmHttpError(response.status, `Open-Elevation respondió ${response.status}`)
        return (await response.json()) as OpenElevationResponse
      })
      batch.forEach((_, i) => {
        const value = data.results?.[i]?.elevation
        elevations.push(typeof value === 'number' && Number.isFinite(value) ? value : null)
      })
    }
    return elevations
  }
}
