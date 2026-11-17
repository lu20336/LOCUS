/**
 * Genera src/data/activityAvailability.json: cuántos lugares de cada
 * actividad (playa, cultura…) hay a menos de ACTIVITY_RADIUS_METERS de cada
 * pueblo de colombiaTowns.json y de cada destino destacado.
 *
 *   npm run data:activities                          (Overpass)
 *   GEOAPIFY_KEY=tu_clave npm run data:activities    (Geoapify, ~1.850 consultas)
 *   ONLY_CATEGORIES=playa ... npm run data:activities  (recalcula solo esas
 *       actividades sobre el JSON existente)
 *   BATCH_SIZE=25 ...  (puntos por consulta a Overpass; más si son pocas actividades)
 *
 * Nota: Geoapify no incluye lugares sin nombre. Para la PLAYA conviene
 * Overpass (muchas playas de OSM no tienen nombre y aun así hay playa):
 *   ONLY_CATEGORIES=playa BATCH_SIZE=25 npm run data:activities
 *
 * Con estos datos la app sabe, SIN consultar servicios en vivo:
 *   - qué actividades ofrecer en el Paso 2 (en Bogotá no hay "Playa"),
 *   - qué pueblos sugerir en el Modo B según las actividades elegidas.
 *
 * Es reanudable: guarda el avance tras cada grupo en
 * node_modules/.cache/locus-activities.partial.json y, si se corta, al
 * volver a correrlo continúa donde iba.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { FEATURED_DESTINATIONS } from '../src/lib/featuredDestinations'
import { CATEGORY_IDS } from '../src/lib/itinerary/categories'
import { createGeoapifyClient } from '../src/lib/itinerary/geoapifyClient'
import { buildActivityCountQuery, parseActivityTotals } from '../src/lib/itinerary/osm'
import { OVERPASS_URLS, createOsmClient } from '../src/lib/itinerary/osmClient'
import { ACTIVITY_RADIUS_METERS, type TownCandidate } from '../src/lib/itinerary/suggestDestination'
import type { CategoryId, GeoPoint } from '../src/types/itinerary'

const OUTPUT = 'src/data/activityAvailability.json'
const PARTIAL = 'node_modules/.cache/locus-activities.partial.json'
/** Puntos por consulta a Overpass: pocos para que el servidor alcance a responder. */
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 5)
const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY
/** Actividades a calcular (todas, o solo las de ONLY_CATEGORIES). */
const ONLY = process.env.ONLY_CATEGORIES?.split(',').map((c) => c.trim()).filter(Boolean)
const TARGET: CategoryId[] = ONLY ? CATEGORY_IDS.filter((c) => ONLY.includes(c)) : CATEGORY_IDS
if (ONLY && TARGET.length !== ONLY.length) throw new Error(`ONLY_CATEGORIES tiene actividades desconocidas: ${ONLY.join(',')}`)
if (ONLY && !existsSync(OUTPUT)) throw new Error(`ONLY_CATEGORIES necesita un ${OUTPUT} existente para completarlo`)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const osm = createOsmClient({
  userAgent: 'Locus/0.1 (prototipo academico, curso Ingenieria Aplicada)',
  // El servidor de OSM Francia suele responder cuando los demás están saturados.
  overpassUrls: ['https://overpass.openstreetmap.fr/api/interpreter', ...OVERPASS_URLS],
  overpassTimeoutMs: 120_000,
  overpassMaxAttempts: 4,
  overpassMinIntervalMs: 5_000,
  cache: null,
  failureMemory: null,
})
const geoapify = GEOAPIFY_KEY ? createGeoapifyClient({ apiKey: GEOAPIFY_KEY, timeoutMs: 20_000 }) : null

async function withRetries<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= 4) throw error
      console.log(`    intento ${attempt} falló (${String(error)}); reintento en 30 s…`)
      await sleep(30_000)
    }
  }
}

/** Conteos de cada actividad de TARGET (en ese orden) para cada punto. */
async function countAround(points: GeoPoint[]): Promise<number[][]> {
  if (geoapify) {
    const result: number[][] = []
    for (const point of points) {
      const counts = await withRetries(() => geoapify.countActivities(point, ACTIVITY_RADIUS_METERS, 100, TARGET))
      result.push(TARGET.map((c) => counts[c] ?? 0))
    }
    return result
  }
  const query = buildActivityCountQuery(points, ACTIVITY_RADIUS_METERS, TARGET, 90)
  return withRetries(async () => parseActivityTotals(await osm.queryOverpass(query), points.length, TARGET))
}

interface Progress {
  featured: Record<string, number[]>
  towns: Record<string, number[]>
}
const progress: Progress = existsSync(PARTIAL)
  ? (JSON.parse(readFileSync(PARTIAL, 'utf8')) as Progress)
  : { featured: {}, towns: {} }
function saveProgress() {
  mkdirSync(dirname(PARTIAL), { recursive: true })
  writeFileSync(PARTIAL, JSON.stringify(progress))
}

const towns = (JSON.parse(readFileSync('src/data/colombiaTowns.json', 'utf8')) as { towns: TownCandidate[] }).towns
console.log(`Fuente: ${geoapify ? 'Geoapify' : 'Overpass'} · radio ${ACTIVITY_RADIUS_METERS} m · actividades: ${TARGET.join(', ')}`)

const featured = FEATURED_DESTINATIONS.filter((d) => !progress.featured[d.id])
if (featured.length > 0) {
  console.log(`1/2 Destinos destacados (${featured.length})…`)
  for (let start = 0; start < featured.length; start += BATCH_SIZE) {
    const batch = featured.slice(start, start + BATCH_SIZE)
    const totals = await countAround(batch.map((d) => d.destination))
    batch.forEach((d, i) => (progress.featured[d.id] = totals[i]))
    saveProgress()
  }
}

const pending = towns.filter((t) => !progress.towns[t.id])
console.log(`2/2 Pueblos y ciudades: faltan ${pending.length} de ${towns.length}…`)
for (let start = 0; start < pending.length; start += BATCH_SIZE) {
  const batch = pending.slice(start, start + BATCH_SIZE)
  const totals = await countAround(batch)
  batch.forEach((t, i) => (progress.towns[t.id] = totals[i]))
  saveProgress()
  console.log(`    ${towns.length - pending.length + start + batch.length}/${towns.length}`)
}

/** Arma los números completos de un lugar: los recién calculados + (si ONLY) los que ya había. */
const previous = ONLY
  ? (JSON.parse(readFileSync(OUTPUT, 'utf8')) as { source: string; featured: Progress['featured']; towns: Progress['towns'] })
  : null
const via = geoapify ? 'Geoapify Places' : 'Overpass API'
// Si solo se recalcularon algunas actividades, se anota de dónde salió cada parte.
const source = previous
  ? `${previous.source.split(' · ')[0]} · ${TARGET.join(', ')} vía ${via}`
  : `OpenStreetMap © OpenStreetMap contributors, vía ${via}`
function merge(fresh: number[], old: number[] | undefined): number[] {
  return CATEGORY_IDS.map((c, i) => {
    const t = TARGET.indexOf(c)
    return t >= 0 ? fresh[t] : (old?.[i] ?? 0)
  })
}

writeFileSync(
  OUTPUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source,
    radiusMeters: ACTIVITY_RADIUS_METERS,
    /** Orden de los números de cada lugar. */
    categories: CATEGORY_IDS,
    featured: Object.fromEntries(
      FEATURED_DESTINATIONS.map((d) => [d.id, merge(progress.featured[d.id], previous?.featured[d.id])]),
    ),
    towns: Object.fromEntries(towns.map((t) => [t.id, merge(progress.towns[t.id], previous?.towns[t.id])])),
  }) + '\n',
)
rmSync(PARTIAL, { force: true })
console.log(`Listo: ${OUTPUT}`)
