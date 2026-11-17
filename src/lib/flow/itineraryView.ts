/**
 * Utilidades de la vista del itinerario (Paso 3): distancias entre paradas y
 * enlaces para abrir los lugares y la ruta del día en un mapa.
 */
import type { GeoPoint, Place } from '../../types/itinerary'
import { haversineKm } from '../itinerary/geo'

const coord = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`

/** Km en línea recta hasta cada parada desde la anterior (la primera, desde el centro). */
export function legDistancesKm(start: GeoPoint, places: readonly GeoPoint[]): number[] {
  return places.map((place, i) => haversineKm(i === 0 ? start : places[i - 1], place))
}

/** 0,35 → "350 m"; 2,345 → "2,3 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  return `${km.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`
}

/** Página del lugar en OpenStreetMap (id "node/123" → openstreetmap.org/node/123). */
export function osmPlaceUrl(place: Pick<Place, 'id' | 'lat' | 'lon'>): string {
  if (/^(node|way|relation)\/\d+$/.test(place.id)) return `https://www.openstreetmap.org/${place.id}`
  return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`
}

/**
 * Ruta del día en Google Maps (enlace público, sin clave): sale del centro,
 * pasa por los lugares en orden y termina en el último.
 * Google admite hasta 9 paradas intermedias en estos enlaces.
 */
export function googleMapsRouteUrl(
  start: GeoPoint,
  places: readonly GeoPoint[],
  travelmode: 'walking' | 'driving' = 'walking',
): string | null {
  if (places.length === 0) return null
  const stops = places.slice(0, 10)
  const params = new URLSearchParams({
    api: '1',
    origin: coord(start),
    destination: coord(stops[stops.length - 1]),
    travelmode,
  })
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map(coord).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}

/** "2026-12-10" → "jue 10 dic" (para las pestañas de los días). */
export function formatDayTab(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const parts = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .formatToParts(new Date(Date.UTC(year, month - 1, day)))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return `${part('weekday')} ${part('day')} ${part('month')}`
}
