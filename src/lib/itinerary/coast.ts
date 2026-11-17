/**
 * ¿Está un destino junto al mar?
 *
 * OpenStreetMap también marca como "playa" (natural=beach) orillas de ríos,
 * lagunas y embalses. Por eso Pasto, Cúcuta o Girón aparecían con "Playa".
 * En Locus "Playa" significa playa de mar, así que solo se ofrece si el
 * destino está a menos de COAST_KM de la costa.
 *
 * La costa es un trazado simplificado (puntos cada 20–60 km) del Caribe, del
 * Pacífico y de San Andrés y Providencia. Entre cada par de puntos se mide la
 * distancia al segmento, así que la precisión es de unos pocos kilómetros:
 * suficiente para separar la costa del interior.
 */
import type { CategoryId, GeoPoint } from '../../types/itinerary'
import { haversineKm } from './geo'

/** Distancia máxima al mar para ofrecer "Playa". */
export const COAST_KM = 20

type Line = ReadonlyArray<readonly [number, number]> // [lat, lon]

/** Costa del Pacífico, de la frontera con Ecuador a la de Panamá. */
const PACIFIC: Line = [
  [1.43, -78.88], [1.6, -78.97], [1.82, -78.78], [2.05, -78.65], [2.3, -78.45],
  [2.6, -78.15], [2.85, -77.75], [3.1, -77.55], [3.45, -77.35], [3.75, -77.2],
  [3.88, -77.07], [4.1, -77.3], [4.4, -77.38], [4.8, -77.38], [5.2, -77.42],
  [5.5, -77.5], [5.71, -77.29], [5.95, -77.36], [6.2, -77.42], [6.55, -77.38], [6.85, -77.65],
  [7.1, -77.85], [7.25, -77.9],
]

/** Costa del Caribe, de la frontera con Panamá a la de Venezuela (La Guajira). */
const CARIBBEAN: Line = [
  [8.68, -77.37], [8.5, -77.25], [8.3, -77.0], [8.1, -76.75], [7.9, -76.75],
  [8.1, -76.85], [8.4, -76.8], [8.65, -76.6], [8.87, -76.42], [9.1, -76.15],
  [9.35, -75.85], [9.45, -75.7], [9.55, -75.6], [9.9, -75.65], [10.2, -75.6],
  [10.42, -75.55], [10.7, -75.4], [10.85, -75.15], [11.0, -74.95], [11.08, -74.7],
  [11.0, -74.45], [11.05, -74.25], [11.25, -74.22], [11.32, -73.9], [11.28, -73.5],
  [11.35, -73.2], [11.55, -72.9], [11.75, -72.55], [12.0, -72.25], [12.25, -72.0],
  [12.45, -71.7], [12.3, -71.4], [12.0, -71.3], [11.85, -71.32],
]

/** San Andrés y Providencia (cada isla es un punto con algunos km de margen). */
const ISLANDS: Line[] = [
  [[12.48, -81.73], [12.6, -81.7]],
  [[13.33, -81.37], [13.4, -81.36]],
]

const COASTLINES: Line[] = [PACIFIC, CARIBBEAN, ...ISLANDS]

/**
 * Distancia aproximada de un punto al segmento a–b, en km. Se proyecta sobre
 * un plano local (válido a estas escalas) y se mide con Haversine.
 */
function kmToSegment(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const cos = Math.cos((p.lat * Math.PI) / 180)
  const ax = a.lon * cos, ay = a.lat
  const bx = b.lon * cos, by = b.lat
  const px = p.lon * cos, py = p.lat
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return haversineKm(p, { lat: ay + t * dy, lon: (ax + t * dx) / cos })
}

/** Kilómetros desde el punto hasta el mar (según el trazado simplificado). */
export function kmToCoast(point: GeoPoint): number {
  let best = Infinity
  for (const line of COASTLINES) {
    for (let i = 1; i < line.length; i++) {
      const [aLat, aLon] = line[i - 1]
      const [bLat, bLon] = line[i]
      best = Math.min(best, kmToSegment(point, { lat: aLat, lon: aLon }, { lat: bLat, lon: bLon }))
    }
  }
  return best
}

export function isCoastal(point: GeoPoint): boolean {
  return kmToCoast(point) <= COAST_KM
}

/** Quita "Playa" de unos conteos si el destino no está junto al mar. */
export function withoutInlandBeaches<T extends Partial<Record<CategoryId, number>>>(point: GeoPoint, counts: T): T {
  if (!counts.playa || isCoastal(point)) return counts
  return { ...counts, playa: 0 }
}
