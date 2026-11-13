/**
 * Alojamientos de REFERENCIA tomados de OpenStreetMap (Overpass). Son
 * establecimientos reales, pero NO son reservables en LOCUS ni traen precio,
 * fotos o disponibilidad: sirven para que un destino nunca aparezca vacío y
 * para dirigir al usuario al sitio del propio establecimiento.
 * Datos © OpenStreetMap contributors (licencia ODbL: atribución obligatoria).
 */
import type { ExternalPlace } from '../domain/types'
import type { OverpassResponse } from '../itinerary/osm'
import { haversineKm } from '../itinerary/geo'

const KIND_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  hostel: 'Hostal',
  guest_house: 'Casa de huéspedes',
  apartment: 'Apartamentos',
  chalet: 'Cabaña',
  camp_site: 'Camping',
  motel: 'Motel',
}

export const LODGING_TAGS = Object.keys(KIND_LABELS)

export function buildLodgingQuery(lat: number, lon: number, radiusMeters: number, limit = 40): string {
  return `[out:json][timeout:20];\nnwr["tourism"~"^(${LODGING_TAGS.join('|')})$"]["name"](around:${Math.round(radiusMeters)},${lat.toFixed(6)},${lon.toFixed(6)});\nout center ${limit};`
}

/** Solo se aceptan enlaces http(s): el dato viene de OSM y no debe poder ejecutar código. */
export function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function parseLodging(response: OverpassResponse, origin?: { lat: number; lon: number }): ExternalPlace[] {
  const seen = new Set<string>()
  const places: ExternalPlace[] = []
  for (const el of response.elements ?? []) {
    const tags = el.tags ?? {}
    const name = tags.name?.trim()
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (!name || lat === undefined || lon === undefined || !(tags.tourism in KIND_LABELS)) continue
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
    places.push({
      source: 'osm',
      id: `${el.type}/${el.id}`,
      name,
      kind: KIND_LABELS[tags.tourism],
      lat,
      lon,
      website: safeUrl(tags.website ?? tags['contact:website']),
      phone: (tags.phone ?? tags['contact:phone'])?.slice(0, 40),
      address: address || undefined,
    })
  }
  if (origin) places.sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b))
  return places
}
