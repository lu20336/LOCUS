import type { GeoPoint } from '../../types/itinerary'

/** Radio medio de la Tierra en kilómetros. */
const EARTH_RADIUS_KM = 6371

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Distancia entre dos puntos sobre la superficie terrestre (fórmula de Haversine).
 *
 * La Tierra no es plana, así que no podemos usar Pitágoras con latitud/longitud.
 * Haversine calcula la distancia del "círculo máximo" (el camino más corto sobre
 * una esfera):
 *
 *   a = sen²(Δlat/2) + cos(lat1) · cos(lat2) · sen²(Δlon/2)
 *   d = 2 · R · atan2(√a, √(1−a))
 *
 * Es una distancia en línea recta (no sigue calles), suficiente para comparar
 * qué lugar está más cerca de otro, que es lo que necesita el algoritmo de rutas.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
