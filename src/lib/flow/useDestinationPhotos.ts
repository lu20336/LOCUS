/**
 * Fotos reales del destino (Wikidata + Commons, ver placePhotos.ts) para el
 * Paso 2. Se guardan en sessionStorage: volver al paso no repite las consultas.
 *
 * La búsqueda empieza ANTES del Paso 2: apenas se elige el destino en el
 * Paso 1 (prefetchDestinationPhotos), y las imágenes se descargan de una vez,
 * así al continuar las fotos ya están listas.
 */
import { useEffect, useState } from 'react'
import type { Destination } from '../../types/itinerary'
import { findDestinationPhotos, type DestinationPhotos } from '../itinerary/placePhotos'

export type PhotosState = { status: 'loading' } | { status: 'done'; photos: DestinationPhotos }

const CACHE_PREFIX = 'locus:photos:v2:'

function readCache(key: string): DestinationPhotos | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as DestinationPhotos) : null
  } catch {
    return null
  }
}

function writeCache(key: string, photos: DestinationPhotos) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(photos))
  } catch {
    // Almacenamiento lleno o bloqueado: solo perdemos la caché.
  }
}

/**
 * Una sola búsqueda a la vez por destino: si se pide de nuevo mientras está en
 * curso (ej. React monta el componente dos veces en desarrollo), se reutiliza.
 * Así no se mandan consultas repetidas a Wikidata, que las rechaza.
 * Los resultados incompletos (algún servicio falló) no se guardan en caché,
 * para volver a intentarlo la próxima vez.
 */
const inFlight = new Map<string, Promise<DestinationPhotos>>()

/** Descarga las imágenes en segundo plano para que el navegador las tenga en caché. */
function preloadImages(photos: DestinationPhotos) {
  if (typeof Image === 'undefined') return
  const urls = [photos.city, ...Object.values(photos.byCategory), ...(photos.extras ?? [])].map((p) => p?.url)
  for (const url of new Set(urls)) {
    if (!url) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}

function searchOnce(key: string, search: () => Promise<DestinationPhotos>): Promise<DestinationPhotos> {
  const running = inFlight.get(key)
  if (running) return running
  const promise = search()
    .catch((): DestinationPhotos => ({ byCategory: {}, incomplete: true }))
    .then((photos) => {
      if (!photos.incomplete) writeCache(key, photos)
      preloadImages(photos)
      return photos
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

/** "Pasto, Nariño, Colombia" → { name: "Pasto", region: "Nariño" }. */
export function nameAndRegion(displayName: string): { name: string; region?: string } {
  const [name = '', ...rest] = displayName.split(',').map((part) => part.trim())
  const region = rest.find((part) => part && part !== 'Colombia')
  return { name, region }
}

const keyOf = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`

function startSearch(key: string, lat: number, lon: number, displayName: string) {
  const { name, region } = nameAndRegion(displayName)
  return searchOnce(key, () => findDestinationPhotos({ lat, lon, name, region }))
}

/**
 * Empieza a buscar las fotos del destino sin esperar al Paso 2. Si ya están
 * en caché o la búsqueda ya está en curso, no hace nada.
 */
export function prefetchDestinationPhotos(destination: Destination | null | undefined): void {
  if (!destination) return
  const key = keyOf(destination.lat, destination.lon)
  if (readCache(key) || inFlight.has(key)) return
  void startSearch(key, destination.lat, destination.lon, destination.displayName)
}

export function useDestinationPhotos(destination: Destination | null): PhotosState {
  const lat = destination?.lat
  const lon = destination?.lon
  const displayName = destination?.displayName ?? ''
  const key = lat === undefined || lon === undefined ? '' : keyOf(lat, lon)
  // Resultado de la última búsqueda, con la clave del destino al que corresponde.
  const [result, setResult] = useState<{ key: string; photos: DestinationPhotos } | null>(null)
  const cached = key ? readCache(key) : null

  useEffect(() => {
    if (lat === undefined || lon === undefined || readCache(key)) return
    let cancelled = false
    startSearch(key, lat, lon, displayName).then((photos) => {
      if (!cancelled) setResult({ key, photos })
    })
    return () => {
      cancelled = true
    }
  }, [key, lat, lon, displayName])

  if (cached) return { status: 'done', photos: cached }
  if (result?.key === key) return { status: 'done', photos: result.photos }
  return { status: 'loading' }
}
