/**
 * Genera src/data/featuredPlaces.json: lugares de OpenStreetMap precalculados
 * para los destinos destacados. Sirve de RESPALDO cuando los servidores
 * públicos de Overpass no responden (algo frecuente): así el itinerario de
 * los destinos destacados sigue funcionando.
 *
 *   npm run data:places
 *
 * Se ejecuta en Node (con User-Agent propio y esperas largas). Si Overpass
 * está saturado, reintenta con pausas; puedes volver a correrlo más tarde.
 * Datos © OpenStreetMap contributors (ODbL).
 */
import { writeFileSync } from 'node:fs'
import { FEATURED_DESTINATIONS } from '../src/lib/featuredDestinations'
import { CATEGORY_IDS } from '../src/lib/itinerary/categories'
import { createOsmClient } from '../src/lib/itinerary/osmClient'
import type { CategoryId, Place } from '../src/types/itinerary'

const OUTPUT = 'src/data/featuredPlaces.json'
const PER_CATEGORY = 25

const client = createOsmClient({
  userAgent: 'Locus/0.2 (proyecto academico, curso Ingenieria Aplicada)',
  overpassTimeoutMs: 90_000,
  overpassMaxAttempts: 3,
  overpassMinIntervalMs: 5_000,
  cache: null,
  failureMemory: null,
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetries<T>(label: string, task: () => Promise<T>, attempts = 8): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await task()
    } catch (error) {
      if (i >= attempts) throw error
      const wait = Math.min(120, 15 * i)
      console.log(`  ${label}: intento ${i} falló (${String(error).slice(0, 80)}); reintento en ${wait} s…`)
      await sleep(wait * 1000)
    }
  }
}

const out: Record<string, Place[]> = {}
for (const item of FEATURED_DESTINATIONS) {
  console.log(`▶ ${item.name}`)
  const places = await withRetries(item.name, () => client.findPlaces(item.destination, item.destination.radiusMeters, CATEGORY_IDS))
  const kept: Place[] = []
  for (const c of CATEGORY_IDS as CategoryId[]) {
    kept.push(...places.filter((p) => p.category === c).sort((a, b) => b.score - a.score).slice(0, PER_CATEGORY))
  }
  out[item.id] = kept.map((p) => ({ ...p, lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 }))
  console.log(`  ${kept.length} lugares`)
  await sleep(6000)
}

writeFileSync(
  OUTPUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), source: 'OpenStreetMap (Overpass API) © OpenStreetMap contributors, ODbL', destinations: out }, null, 1) + '\n',
)
console.log(`✔ ${OUTPUT}`)
