/**
 * Prueba del motor de itinerarios desde la terminal, sin interfaz.
 *
 *   npm run demo:engine                                   → Cartagena, 3 días, datos EN VIVO
 *   npm run demo:engine -- "Medellín, Colombia" cultura,gastronomia 2
 *   npm run demo:engine -- --offline                      → con los datos de ejemplo (sin red)
 *
 * En vivo consulta Nominatim y Overpass directamente con el mismo cliente
 * que usa la app en el navegador (1 petición/segundo). Como Node no envía
 * Referer, se agrega un User-Agent propio. Correo de contacto opcional:
 *   NOMINATIM_EMAIL=correo@ejemplo.com npm run demo:engine
 */
import { CATEGORIES, isCategoryId } from '../src/lib/itinerary/categories'
import { ItineraryError } from '../src/lib/itinerary/errors'
import { generateItinerary } from '../src/lib/itinerary/generateItinerary'
import { parseNominatimResponse, parseOverpassResponse } from '../src/lib/itinerary/osm'
import { createOsmClient, type OsmClient } from '../src/lib/itinerary/osmClient'
import { nominatimCartagena, overpassCartagena } from '../src/lib/itinerary/__tests__/fixtures/cartagena'
import type { CategoryId } from '../src/types/itinerary'

const args = process.argv.slice(2)
const offline = args.includes('--offline')
const [destination = 'Cartagena, Colombia', categoriesArg = 'cultura,gastronomia,playa', daysArg = '3'] = args.filter(
  (a) => !a.startsWith('--'),
)

const categories = categoriesArg.split(',').filter(isCategoryId) as CategoryId[]
const days = Math.max(1, Number(daysArg) || 3)
const start = new Date(Date.UTC(2026, 11, 1))
const end = new Date(start.getTime() + (days - 1) * 86_400_000)

const client: OsmClient = offline
  ? {
      geocode: async (q) => parseNominatimResponse(q, nominatimCartagena),
      findPlaces: async (_c, _r, cats) => parseOverpassResponse(overpassCartagena, cats),
    }
  : createOsmClient({
      userAgent: 'Locus/0.1 (prototipo academico, curso Ingenieria Aplicada)',
      email: process.env.NOMINATIM_EMAIL || undefined,
    })

console.log(`\n▶ Motor Locus · ${offline ? 'datos de ejemplo (offline)' : 'datos en vivo de OpenStreetMap'}`)
console.log(`  Destino: ${destination} · ${days} día(s) · ${categories.map((c) => CATEGORIES[c].label).join(', ')}\n`)

const t0 = performance.now()
try {
  const itinerary = await generateItinerary(
    {
      destination,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      budgetCOP: 2_000_000,
      categories,
    },
    client,
  )

  const d = itinerary.destination
  console.log(`📍 ${d.displayName}`)
  console.log(`   (${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}) · radio de búsqueda ${d.radiusMeters} m\n`)
  for (const day of itinerary.days) {
    console.log(`Día ${day.day} · ${day.date} · ${day.distanceKm} km`)
    day.places.forEach((p, i) =>
      console.log(`  ${i + 1}. ${p.name}  [${p.kind} · ${CATEGORIES[p.category].label} · relevancia ${p.score}]`),
    )
  }
  if (itinerary.missingCategories.length) {
    console.log(`\n⚠ Sin resultados para: ${itinerary.missingCategories.map((c) => CATEGORIES[c].label).join(', ')}`)
  }
  const s = itinerary.stats
  console.log(`\nRecorrido optimizado: ${s.optimizedKm} km · sin optimizar: ${s.unoptimizedKm} km · ahorro ${s.savingPercent}%`)
  console.log(`Tiempo total: ${Math.round(performance.now() - t0)} ms`)
  console.log('Datos de mapas © OpenStreetMap contributors\n')
} catch (error) {
  if (error instanceof ItineraryError) {
    console.error(`✖ [${error.code}] ${error.message}`)
  } else {
    console.error('✖ Error inesperado:', error)
  }
  process.exitCode = 1
}
