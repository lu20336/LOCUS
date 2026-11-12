/**
 * Genera src/data/colombiaTowns.json: los pueblos y ciudades candidatos para
 * la sugerencia de destino (Modo B), ya ordenados por popularidad y con su
 * altitud resuelta.
 *
 *   npm run data:towns
 *
 * Usa la MISMA consulta Overpass que suggestDestination.ts (buildColombiaTownsQuery)
 * y Open-Elevation para los lugares sin etiqueta `ele`. Se ejecuta en Node
 * (con User-Agent propio), no en el navegador: es una consulta pesada que los
 * servidores públicos de Overpass no siempre atienden desde un sitio web.
 * Volver a correrlo solo hace falta si se quiere refrescar los datos.
 */
import { writeFileSync } from 'node:fs'
import { createElevationClient } from '../src/lib/itinerary/elevationClient'
import { createOsmClient } from '../src/lib/itinerary/osmClient'
import { fetchTownsFromOverpass, type TownCandidate } from '../src/lib/itinerary/suggestDestination'

/** Cuántos candidatos guardamos (los más populares). */
const TOWNS_TO_KEEP = 300
const OUTPUT = 'src/data/colombiaTowns.json'

const osm = createOsmClient({
  userAgent: 'Locus/0.1 (prototipo academico, curso Ingenieria Aplicada)',
  overpassTimeoutMs: 180_000, // consulta pesada: en Node sí podemos esperar
})

async function withRetries<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await task()
    } catch (error) {
      if (i >= attempts) throw error
      console.log(`  intento ${i} falló (${String(error)}); reintentando en 20 s…`)
      await new Promise((r) => setTimeout(r, 20_000))
    }
  }
}

console.log('1/3 Consultando pueblos y ciudades de Colombia en Overpass…')
const all = await withRetries(async () => {
  const result = await fetchTownsFromOverpass((q) => osm.queryOverpass(q))
  // Nunca guardar una lista vacía o recortada por un servidor saturado.
  if (result.length < 500) throw new Error(`solo llegaron ${result.length} lugares`)
  return result
})
const towns = all.slice(0, TOWNS_TO_KEEP)
console.log(`    ${all.length} lugares; guardamos los ${towns.length} más populares.`)

const missing = towns.filter((t) => t.elevation === null)
console.log(`2/3 Consultando la altitud de ${missing.length} lugares sin etiqueta "ele" en Open-Elevation…`)
const elevations = await withRetries(() => createElevationClient()(missing))
missing.forEach((town, i) => {
  town.elevation = elevations[i]
})

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
const output: TownCandidate[] = towns.map((t) => ({
  ...t,
  lat: round(t.lat, 5),
  lon: round(t.lon, 5),
  elevation: t.elevation === null ? null : Math.round(t.elevation),
  popularity: round(t.popularity, 3),
}))

writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'OpenStreetMap (Overpass API) © OpenStreetMap contributors; altitudes faltantes: Open-Elevation',
      towns: output,
    },
    null,
    1,
  ) + '\n',
)
console.log(`3/3 Listo: ${OUTPUT} (${output.filter((t) => t.elevation !== null).length}/${output.length} con altitud).`)
