/**
 * Alojamientos de REFERENCIA (solo para ver, NO reservables en LOCUS).
 * Son establecimientos reales de OpenStreetMap, sin precio, fotos ni
 * disponibilidad. Fuentes, en orden:
 *   1. Catálogo precalculado (src/data/referenceLodging.json, generado con
 *      `npm run data:reference`): instantáneo y sin depender de servicios caídos.
 *      Cubre los destinos destacados y las principales ciudades.
 *   2. Nominatim en vivo (lo que el usuario busca fuera de esa lista).
 * Datos © OpenStreetMap contributors (ODbL): la atribución es obligatoria.
 */
import type { ExternalPlace } from '../domain/types'
import { osmClient } from '../itinerary/browserClient'
import { haversineKm } from '../itinerary/geo'
import { lodgingViaNominatim } from '../itinerary/nominatimPlaces'
import type { GeoPoint } from '../../types/itinerary'

interface StaticDestination {
  name: string
  lat: number
  lon: number
  lodging: ExternalPlace[]
}
interface StaticReference {
  generatedAt: string
  destinations: Record<string, StaticDestination>
}

// import.meta.glob no rompe el build si el archivo todavía no se generó.
const loaders = import.meta.glob<{ default: StaticReference }>('../../data/referenceLodging.json')
let cache: Promise<StaticReference | null> | null = null

function loadStatic(): Promise<StaticReference | null> {
  const loader = Object.values(loaders)[0]
  if (!loader) return Promise.resolve(null)
  cache ??= loader().then((m) => m.default, () => null)
  return cache
}

export interface ReferenceLodgingResult {
  places: ExternalPlace[]
  source: 'static' | 'live'
  generatedAt?: string
}

/** Un punto cuenta como "el mismo destino" si está a menos de esta distancia del centro guardado. */
const SAME_DESTINATION_KM = 4

export async function staticLodgingFor(center: GeoPoint): Promise<ReferenceLodgingResult | null> {
  const data = await loadStatic()
  if (!data) return null
  const match = Object.values(data.destinations)
    .map((d) => ({ d, km: haversineKm(center, d) }))
    .filter((x) => x.km <= SAME_DESTINATION_KM && x.d.lodging.length > 0)
    .sort((a, b) => a.km - b.km)[0]
  return match ? { places: match.d.lodging, source: 'static', generatedAt: data.generatedAt } : null
}

export async function getReferenceLodging(center: GeoPoint, radiusMeters = 8000): Promise<ReferenceLodgingResult> {
  const cached = await staticLodgingFor(center)
  if (cached) return cached
  return { places: await lodgingViaNominatim(osmClient, center, radiusMeters), source: 'live' }
}
