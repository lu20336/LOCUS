/**
 * Lugares y alojamientos de OpenStreetMap obtenidos por NOMINATIM (búsqueda por
 * categoría dentro de un rectángulo), como alternativa a Overpass cuando este
 * está saturado. Nominatim respondió de forma estable en las pruebas; su política
 * pide máx. 1 petición/s (el cliente ya lo respeta) y evitar el uso masivo, por
 * eso solo se usa por acción del usuario o en el script de datos de una sola vez.
 * Datos © OpenStreetMap contributors (ODbL).
 */
import { lodgingKindLabel, safeUrl } from '../catalog/osmLodging'
import type { ExternalPlace } from '../domain/types'
import type { CategoryId, GeoPoint, Place } from '../../types/itinerary'
import { kindLabel } from './categories'
import { haversineKm } from './geo'
import { classifyElement, scorePlace } from './osm'
import type { BoundingBox, FullOsmClient, NominatimSearchResult } from './osmClient'

/** Frases de Nominatim que devuelven cada categoría de LOCUS (verificadas contra la API). */
export const CATEGORY_PHRASES: Record<CategoryId, string[]> = {
  playa: ['beach'],
  cultura: ['museum', 'monument', 'fort'],
  gastronomia: ['restaurant', 'cafe'],
  aventura: ['viewpoint', 'nature reserve', 'peak'],
  vidaNocturna: ['bar', 'pub'],
  compras: ['mall', 'department store'],
}

export const LODGING_PHRASES = ['hotel', 'hostel', 'guest house', 'chalet', 'apartment']

/** Rectángulo aproximado que cubre `radiusMeters` alrededor de un punto. */
export function bboxAround(center: GeoPoint, radiusMeters: number): BoundingBox {
  const dLat = radiusMeters / 111_320
  const dLon = radiusMeters / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)))
  return { west: center.lon - dLon, east: center.lon + dLon, south: center.lat - dLat, north: center.lat + dLat }
}

const osmId = (r: NominatimSearchResult) => `${r.osm_type}/${r.osm_id}`
const nameOf = (r: NominatimSearchResult) => (r.name || r.display_name.split(',')[0] || '').trim()

/** Convierte resultados de Nominatim en lugares de LOCUS (mismas reglas de clasificación y relevancia que con Overpass). */
export function parsePlaces(results: NominatimSearchResult[], categories: CategoryId[]): Place[] {
  const seen = new Set<string>()
  const places: Place[] = []
  for (const r of results) {
    const name = nameOf(r)
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) continue
    const tags: Record<string, string> = { ...(r.extratags ?? {}), [r.category]: r.type, name }
    const match = classifyElement(tags, categories)
    if (!match) continue
    const id = osmId(r)
    const key = `${match.category}|${name.toLowerCase()}`
    if (seen.has(id) || seen.has(key)) continue
    seen.add(id)
    seen.add(key)
    places.push({ id, name, lat, lon, category: match.category, kind: kindLabel(match.tagValue), score: scorePlace(tags) })
  }
  return places
}

/** Convierte resultados de Nominatim en alojamientos de referencia (no reservables). */
export function parseLodging(results: NominatimSearchResult[], origin?: GeoPoint): ExternalPlace[] {
  const seen = new Set<string>()
  const out: ExternalPlace[] = []
  for (const r of results) {
    const kind = r.category === 'tourism' ? lodgingKindLabel(r.type) : null
    const name = nameOf(r)
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    if (!kind || !name || Number.isNaN(lat) || Number.isNaN(lon)) continue
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    const tags = r.extratags ?? {}
    out.push({
      source: 'osm',
      id: osmId(r),
      name,
      kind,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      website: safeUrl(tags.website ?? tags['contact:website']),
      phone: (tags.phone ?? tags['contact:phone'])?.slice(0, 40),
    })
  }
  // Primero los que tienen web o teléfono (más útiles), luego los más cercanos.
  return out.sort((a, b) => {
    const info = Number(Boolean(b.website || b.phone)) - Number(Boolean(a.website || a.phone))
    return info || (origin ? haversineKm(origin, a) - haversineKm(origin, b) : 0)
  })
}

async function searchAll(client: FullOsmClient, phrases: string[], box: BoundingBox, limit = 40): Promise<NominatimSearchResult[]> {
  const all: NominatimSearchResult[] = []
  for (const phrase of phrases) all.push(...(await client.nominatimSearch(phrase, box, limit)))
  return all
}

export async function placesViaNominatim(client: FullOsmClient, center: GeoPoint, radiusMeters: number, categories: CategoryId[]): Promise<Place[]> {
  const phrases = [...new Set(categories.flatMap((c) => CATEGORY_PHRASES[c]))]
  return parsePlaces(await searchAll(client, phrases, bboxAround(center, radiusMeters)), categories)
}

export async function lodgingViaNominatim(client: FullOsmClient, center: GeoPoint, radiusMeters: number, limit = 60): Promise<ExternalPlace[]> {
  const results = await searchAll(client, LODGING_PHRASES, bboxAround(center, radiusMeters))
  return parseLodging(results, center).slice(0, limit)
}
