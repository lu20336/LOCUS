/**
 * Genera los datos de REFERENCIA precalculados de OpenStreetMap, usando
 * NOMINATIM (no Overpass, que suele estar saturado):
 *
 *   src/data/referenceLodging.json  → alojamientos (hoteles, hostales, casas de huéspedes,
 *                                      cabañas, apartamentos) de los destinos destacados y de
 *                                      las principales ciudades. Solo para VER (no reservables).
 *   src/data/featuredPlaces.json    → lugares de interés por categoría de los destinos
 *                                      destacados: respaldo del itinerario si Overpass falla.
 *
 *   npm run data:reference
 *
 * Es una ejecución ÚNICA y pequeña (~300 peticiones a 1 por segundo, como pide la
 * política de uso de Nominatim). No vuelvas a correrla sin necesidad.
 * Datos © OpenStreetMap contributors (ODbL).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { ExternalPlace } from '../src/lib/domain/types'
import { FEATURED_DESTINATIONS } from '../src/lib/featuredDestinations'
import { CATEGORY_IDS } from '../src/lib/itinerary/categories'
import { haversineKm } from '../src/lib/itinerary/geo'
import { lodgingViaNominatim, placesViaNominatim } from '../src/lib/itinerary/nominatimPlaces'
import { createOsmClient } from '../src/lib/itinerary/osmClient'
import type { Place } from '../src/types/itinerary'

const EXTRA_TOWNS = 30
const LODGING_PER_DESTINATION = 60
const PLACES_PER_CATEGORY = 25

const client = createOsmClient({
  userAgent: 'Locus/0.2 (proyecto academico, curso Ingenieria Aplicada)',
  email: process.env.NOMINATIM_EMAIL || undefined,
  cache: null,
  failureMemory: null,
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function retry<T>(label: string, task: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await task()
    } catch (error) {
      if (i >= attempts) throw error
      console.log(`  ${label}: intento ${i} falló (${String(error).slice(0, 70)}); reintento…`)
      await sleep(10_000 * i)
    }
  }
}

interface Target {
  key: string
  name: string
  lat: number
  lon: number
  radius: number
  featured: boolean
}

const targets: Target[] = FEATURED_DESTINATIONS.map((d) => ({
  key: d.id,
  name: d.name,
  lat: d.destination.lat,
  lon: d.destination.lon,
  radius: d.destination.radiusMeters,
  featured: true,
}))

// Ciudades más conocidas de la lista local que no estén a menos de 6 km de un destacado.
const towns = (JSON.parse(readFileSync('src/data/colombiaTowns.json', 'utf8')) as { towns: { id: string; name: string; lat: number; lon: number }[] }).towns
for (const t of towns) {
  if (targets.length >= FEATURED_DESTINATIONS.length + EXTRA_TOWNS) break
  if (targets.some((x) => haversineKm(x, t) < 6)) continue
  targets.push({ key: t.id.replace('/', '_'), name: t.name, lat: t.lat, lon: t.lon, radius: 6000, featured: false })
}

console.log(`Destinos a procesar: ${targets.length}`)
const lodging: Record<string, { name: string; lat: number; lon: number; lodging: ExternalPlace[] }> = {}
const featuredPlaces: Record<string, Place[]> = {}

for (const t of targets) {
  console.log(`▶ ${t.name}`)
  const found = await retry(`${t.name} alojamientos`, () => lodgingViaNominatim(client, t, t.radius, LODGING_PER_DESTINATION))
  lodging[t.key] = { name: t.name, lat: t.lat, lon: t.lon, lodging: found }
  console.log(`  ${found.length} alojamientos`)
  if (t.featured) {
    const places = await retry(`${t.name} lugares`, () => placesViaNominatim(client, t, t.radius, CATEGORY_IDS))
    const kept: Place[] = []
    for (const c of CATEGORY_IDS) kept.push(...places.filter((p) => p.category === c).sort((a, b) => b.score - a.score).slice(0, PLACES_PER_CATEGORY))
    featuredPlaces[t.key] = kept.map((p) => ({ ...p, lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 }))
    console.log(`  ${kept.length} lugares de interés`)
  }
}

const source = 'OpenStreetMap vía Nominatim © OpenStreetMap contributors (ODbL)'
const generatedAt = new Date().toISOString()
writeFileSync('src/data/referenceLodging.json', JSON.stringify({ generatedAt, source, destinations: lodging }) + '\n')
writeFileSync('src/data/featuredPlaces.json', JSON.stringify({ generatedAt, source, destinations: featuredPlaces }) + '\n')
console.log('✔ src/data/referenceLodging.json y src/data/featuredPlaces.json')
