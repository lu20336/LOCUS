/**
 * Prueba de la sugerencia de destino (Modo B) desde la terminal, EN VIVO.
 *
 *   npm run demo:suggest                              → frío + cultura,gastronomia,aventura
 *   npm run demo:suggest -- calido playa,gastronomia
 *   npm run demo:suggest -- frio playa                → combinación imposible
 */
import { CATEGORIES, isCategoryId } from '../src/lib/itinerary/categories'
import { createElevationClient } from '../src/lib/itinerary/elevationClient'
import { ItineraryError } from '../src/lib/itinerary/errors'
import { createOsmClient } from '../src/lib/itinerary/osmClient'
import {
  CLIMATE_IDS,
  fetchTownsFromOverpass,
  suggestDestination,
  type ClimateId,
} from '../src/lib/itinerary/suggestDestination'
import type { CategoryId } from '../src/types/itinerary'

const [climateArg = 'frio', categoriesArg = 'cultura,gastronomia,aventura'] = process.argv.slice(2)
const climate = (CLIMATE_IDS as string[]).includes(climateArg) ? (climateArg as ClimateId) : 'frio'
const categories = categoriesArg.split(',').filter(isCategoryId) as CategoryId[]

const osm = createOsmClient({
  userAgent: 'Locus/0.1 (prototipo academico, curso Ingenieria Aplicada)',
  email: process.env.NOMINATIM_EMAIL || undefined,
})

console.log(`\n▶ Sugerencia Locus · clima ${climate} · ${categories.map((c) => CATEGORIES[c].label).join(', ')}\n`)
const t0 = performance.now()
try {
  const result = await suggestDestination(
    climate,
    categories,
    // En la terminal consultamos los pueblos en vivo (la app usa la lista precalculada).
    {
      loadTowns: () => fetchTownsFromOverpass((q) => osm.queryOverpass(q)),
      checkActivities: (centers, radius, cats) => osm.checkActivities(centers, radius, cats),
      elevation: createElevationClient(),
    },
    { onProgress: (p) => console.log(`  … ${p.message}`) },
  )
  console.log()
  for (const s of result.suggestions) {
    const marks = result.categories
      .map((c) => `${CATEGORIES[c].label} ${s.matchedCategories.includes(c) ? '✓' : '✗'}`)
      .join('  ')
    console.log(`📍 ${s.candidate.name} (${Math.round(s.elevation)} m) — ${s.activitiesChecked ? marks : 'sin revisar'}`)
  }
  if (result.climateOnly) console.log('\n⚠ Solo por clima: ningún candidato tiene las actividades elegidas cerca.')
  if (result.failedChecks) console.log(`⚠ ${result.failedChecks} revisiones fallaron.`)
  console.log(`\nTiempo total: ${((performance.now() - t0) / 1000).toFixed(1)} s`)
  console.log('Datos de mapas © OpenStreetMap contributors · Altitud: Open-Elevation\n')
} catch (error) {
  console.error(error instanceof ItineraryError ? `✖ [${error.code}] ${error.message}` : error)
  process.exitCode = 1
}
