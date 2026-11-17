/**
 * Tiempo en carro desde el destino hasta varios pueblos, con la Route Matrix
 * API de Geoapify (misma clave que Places; una sola petición para todos).
 * https://apidocs.geoapify.com/docs/route-matrix/
 *
 * Sirve para no ofrecer como "cercano" un pueblo que en línea recta está a
 * 70 km pero por carretera queda a 4 horas (cruzar la cordillera).
 * Los tiempos son sin tráfico: la app lo dice al mostrarlos.
 */
import type { GeoPoint } from '../../types/itinerary'
import { OsmHttpError } from './errors'

export const ROUTE_MATRIX_URL = 'https://api.geoapify.com/v1/routematrix'

export interface RouteMatrixResponse {
  sources_to_targets?: { time: number | null; distance: number | null }[][]
}

/** Cuerpo de la petición: Geoapify usa [lon, lat]. */
export function buildRouteMatrixBody(origin: GeoPoint, targets: readonly GeoPoint[]) {
  return {
    mode: 'drive',
    sources: [{ location: [origin.lon, origin.lat] }],
    targets: targets.map((t) => ({ location: [t.lon, t.lat] })),
  }
}

/** Minutos en carro hasta cada destino (null si no hay ruta). */
export function parseRouteMatrix(response: RouteMatrixResponse, count: number): (number | null)[] {
  const row = response.sources_to_targets?.[0]
  if (!row || row.length !== count) throw new Error('Respuesta incompleta de la matriz de rutas')
  return row.map((cell) => (cell.time === null || cell.time === undefined ? null : Math.round(cell.time / 60)))
}

export interface TravelTimeClient {
  drivingMinutes(origin: GeoPoint, targets: readonly GeoPoint[]): Promise<(number | null)[]>
}

export function createTravelTimeClient(options: {
  apiKey: string
  fetchFn?: typeof fetch
  timeoutMs?: number
}): TravelTimeClient {
  const { apiKey, fetchFn = (...args) => fetch(...args), timeoutMs = 8000 } = options
  return {
    async drivingMinutes(origin, targets) {
      if (targets.length === 0) return []
      const response = await fetchFn(`${ROUTE_MATRIX_URL}?apiKey=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRouteMatrixBody(origin, targets)),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new OsmHttpError(response.status, `Geoapify (rutas) respondió ${response.status}`)
      return parseRouteMatrix((await response.json()) as RouteMatrixResponse, targets.length)
    },
  }
}
