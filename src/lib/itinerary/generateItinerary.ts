/**
 * ============================================================================
 *  MOTOR DE ITINERARIOS DE LOCUS
 * ============================================================================
 *
 * El "motor de IA" de Locus no es un modelo de lenguaje: es un algoritmo
 * propio de optimización de rutas. A partir de un destino, unas fechas y unas
 * categorías, arma un itinerario día por día así:
 *
 *   1. geocodeDestination()  → convierte "Cartagena" en coordenadas (Nominatim).
 *   2. searchPlaces()        → busca lugares reales cerca (Overpass / OSM).
 *   3. selectPlaces()        → elige los más relevantes, equilibrando categorías.
 *   4. optimizeRoute()       → ordena lugares con la heurística del VECINO MÁS
 *                              CERCANO para minimizar la distancia recorrida.
 *   5. buildDailyPlan()      → reparte los lugares entre los días del viaje y
 *                              optimiza la ruta de cada día (la vida nocturna
 *                              va al final del día).
 *
 * generateItinerary() encadena los cinco pasos. planItinerary() hace los pasos
 * 2 a 5 para un destino que ya tiene coordenadas (el de la app, que se
 * resolvió en el Paso 1).
 *
 * Todas las funciones de optimización (3, 4 y 5) son PURAS: con la misma
 * entrada siempre dan la misma salida y no hacen peticiones de red. Por eso se
 * pueden probar con datos de ejemplo (ver __tests__/generateItinerary.test.ts).
 * ============================================================================
 */
import type {
  CategoryId,
  DayPlan,
  Destination,
  GeoPoint,
  Itinerary,
  ItineraryStats,
  Place,
  TripInput,
} from '../../types/itinerary'
import { CATEGORIES } from './categories'
import { ItineraryError, toItineraryError } from './errors'
import { haversineKm } from './geo'
import type { OsmClient } from './osmClient'

/** Actividades por día (un ritmo de viaje cómodo). */
export const DEFAULT_ACTIVITIES_PER_DAY = 4

/** Máximo de días que planificamos, para mantener la consulta razonable. */
export const MAX_TRIP_DAYS = 14

// ---------------------------------------------------------------------------
// Utilidades de fechas
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lista de fechas del viaje, ambos extremos incluidos.
 * Ej. ("2026-12-01", "2026-12-03") → ["2026-12-01", "2026-12-02", "2026-12-03"] = 3 días.
 * Se calcula en UTC para que la zona horaria del usuario no corra un día.
 */
export function tripDates(startDate: string, endDate: string): string[] {
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    throw new ItineraryError('INVALID_INPUT', 'Elige una fecha de inicio y una de regreso.')
  }
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new ItineraryError('INVALID_INPUT', 'Alguna de las fechas no es válida.')
  }
  if (end < start) {
    throw new ItineraryError('INVALID_INPUT', 'La fecha de regreso debe ser igual o posterior a la de salida.')
  }
  const DAY_MS = 24 * 60 * 60 * 1000
  const totalDays = Math.round((end - start) / DAY_MS) + 1
  if (totalDays > MAX_TRIP_DAYS) {
    throw new ItineraryError('INVALID_INPUT', `Por ahora planificamos viajes de hasta ${MAX_TRIP_DAYS} días.`)
  }
  return Array.from({ length: totalDays }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10))
}

// ---------------------------------------------------------------------------
// Paso 1 · Geocodificar el destino
// ---------------------------------------------------------------------------

/**
 * Convierte el texto que escribió el usuario (ej. "Cartagena") en coordenadas
 * usando Nominatim, el buscador de OpenStreetMap.
 */
export async function geocodeDestination(query: string, client: OsmClient): Promise<Destination> {
  const cleanQuery = query.trim()
  if (cleanQuery.length < 2) {
    throw new ItineraryError('INVALID_INPUT', 'Escribe el nombre de tu destino.')
  }

  let destination: Destination | null
  try {
    destination = await client.geocode(cleanQuery)
  } catch (error) {
    throw toItineraryError(error, 'el servicio de mapas (Nominatim)')
  }

  if (!destination) {
    throw new ItineraryError(
      'DESTINATION_NOT_FOUND',
      `No encontramos "${cleanQuery}" en el mapa. Prueba con el nombre de la ciudad y el país, ej. "Cartagena, Colombia".`,
    )
  }
  return destination
}

// ---------------------------------------------------------------------------
// Paso 2 · Buscar lugares reales
// ---------------------------------------------------------------------------

export interface PlaceSearchResult {
  /** Lugares agrupados por categoría, del más al menos relevante. */
  byCategory: Partial<Record<CategoryId, Place[]>>
  /** Categorías elegidas sin ningún resultado (se avisan al usuario). */
  missingCategories: CategoryId[]
}

/**
 * Busca puntos de interés alrededor del destino para las categorías elegidas
 * (Overpass API) y los ordena por relevancia dentro de cada categoría.
 * Empate en relevancia → gana el más cercano al centro.
 */
export async function searchPlaces(
  destination: Destination,
  categories: CategoryId[],
  client: Pick<OsmClient, 'findPlaces'>,
): Promise<PlaceSearchResult> {
  if (categories.length === 0) {
    throw new ItineraryError('INVALID_INPUT', 'Elige al menos una actividad.')
  }

  let places: Place[]
  try {
    places = await client.findPlaces(destination, destination.radiusMeters, categories)
  } catch (error) {
    throw toItineraryError(error, 'el servicio de lugares (Overpass)')
  }

  const byCategory: Partial<Record<CategoryId, Place[]>> = {}
  const missingCategories: CategoryId[] = []

  for (const categoryId of categories) {
    const inCategory = places
      .filter((p) => p.category === categoryId)
      .sort((a, b) => b.score - a.score || haversineKm(destination, a) - haversineKm(destination, b))
    if (inCategory.length === 0) missingCategories.push(categoryId)
    else byCategory[categoryId] = inCategory
  }

  if (missingCategories.length === categories.length) {
    const labels = categories.map((c) => CATEGORIES[c].label.toLowerCase()).join(', ')
    throw new ItineraryError(
      'NO_PLACES',
      `No encontramos lugares de ${labels} cerca de ${destination.displayName.split(',')[0]}. Prueba con otras actividades u otro destino.`,
    )
  }
  return { byCategory, missingCategories }
}

// ---------------------------------------------------------------------------
// Paso 3 · Elegir qué lugares visitar
// ---------------------------------------------------------------------------

/**
 * Elige `total` lugares repartidos de forma equilibrada entre categorías
 * ("round-robin"): toma el mejor de cada categoría por turnos, luego el
 * segundo mejor de cada una, y así hasta completar el cupo.
 * Así un viaje de Cultura + Gastronomía no termina con 12 restaurantes.
 */
export function selectPlaces(
  byCategory: Partial<Record<CategoryId, Place[]>>,
  categories: CategoryId[],
  total: number,
): Place[] {
  const selected: Place[] = []
  const lists = categories.map((c) => byCategory[c] ?? []).filter((list) => list.length > 0)

  for (let round = 0; selected.length < total; round++) {
    let addedThisRound = false
    for (const list of lists) {
      if (selected.length >= total) break
      if (round < list.length) {
        selected.push(list[round])
        addedThisRound = true
      }
    }
    if (!addedThisRound) break // se agotaron todas las listas
  }
  return selected
}

// ---------------------------------------------------------------------------
// Paso 4 · Optimizar la ruta: heurística del VECINO MÁS CERCANO
// ---------------------------------------------------------------------------

/**
 * Ordena los lugares para minimizar la distancia total recorrida.
 *
 * El problema de fondo es el Problema del Agente Viajero (TSP): encontrar el
 * orden de visita más corto entre n lugares. Probar todos los órdenes posibles
 * cuesta n! (factorial): con 10 lugares son 3.628.800 rutas, con 20 lugares
 * más de 2,4 × 10¹⁸. Es inviable, así que usamos una HEURÍSTICA: un método
 * rápido que da una ruta buena (no necesariamente la perfecta).
 *
 * Algoritmo del vecino más cercano (nearest neighbor):
 *
 *   1. Empezar en el punto de partida (el centro del destino / el hotel).
 *   2. De los lugares que faltan por visitar, ir al MÁS CERCANO a donde estoy
 *      (distancia calculada con la fórmula de Haversine).
 *   3. Marcar ese lugar como visitado y pararse en él.
 *   4. Repetir 2–3 hasta visitarlos todos.
 *
 * Complejidad: en cada paso revisamos los lugares que faltan →
 * n + (n−1) + … + 1 = n(n+1)/2 comparaciones ⇒ O(n²). Para 50 lugares son
 * ~1.275 cálculos: instantáneo.
 *
 * Es una estrategia "voraz" (greedy): siempre toma la mejor opción inmediata.
 * Por eso a veces deja un lugar lejano para el final, pero en la práctica
 * reduce mucho la distancia frente a un orden arbitrario.
 *
 * Función pura: no modifica el arreglo de entrada.
 */
export function optimizeRoute<T extends GeoPoint>(start: GeoPoint, places: readonly T[]): T[] {
  const pending = [...places] // lugares sin visitar
  const route: T[] = [] // ruta resultante, en orden de visita
  let current: GeoPoint = start // dónde estoy ahora

  while (pending.length > 0) {
    // Paso 2: buscar el índice del lugar pendiente más cercano a `current`.
    let nearestIndex = 0
    let nearestDistance = Infinity
    for (let i = 0; i < pending.length; i++) {
      const distance = haversineKm(current, pending[i])
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }
    // Paso 3: moverse a ese lugar y sacarlo de los pendientes.
    const [nearest] = pending.splice(nearestIndex, 1)
    route.push(nearest)
    current = nearest
  }
  return route
}

/**
 * Distancia total de una ruta: desde el punto de partida al primer lugar,
 * y luego de cada lugar al siguiente (suma de los tramos, en km).
 */
export function routeDistanceKm(start: GeoPoint, route: readonly GeoPoint[]): number {
  let total = 0
  let current = start
  for (const stop of route) {
    total += haversineKm(current, stop)
    current = stop
  }
  return total
}

// ---------------------------------------------------------------------------
// Paso 5 · Repartir los lugares entre los días
// ---------------------------------------------------------------------------

/**
 * Divide una lista en `parts` grupos consecutivos de tamaño lo más parecido
 * posible. Ej. 10 elementos en 3 días → 3, 3, 4.
 */
export function splitEvenly<T>(items: readonly T[], parts: number): T[][] {
  return Array.from({ length: parts }, (_, i) =>
    items.slice(Math.floor((i * items.length) / parts), Math.floor(((i + 1) * items.length) / parts)),
  )
}

/**
 * Algoritmo de BARRIDO (sweep), clásico en planificación de rutas: ordena los
 * lugares por el ángulo (rumbo) en que se ven desde el punto de partida.
 *
 *   1. Para cada lugar se calcula su ángulo con atan2 (0° = este, 90° = norte).
 *   2. Se ordenan por ángulo, como si una aguja girara alrededor del centro.
 *   3. El barrido empieza justo después del MAYOR hueco entre ángulos
 *      consecutivos, para no partir en dos un grupo de lugares vecinos.
 *
 * El vecino más cercano no sirve para esto: deja para el final los lugares
 * sueltos, que pueden estar en extremos opuestos de la ciudad. Con el barrido,
 * dos lugares en direcciones opuestas nunca quedan seguidos.
 * Complejidad: O(n log n) por el ordenamiento.
 */
export function sweepOrder<T extends GeoPoint>(start: GeoPoint, places: readonly T[]): T[] {
  if (places.length < 2) return [...places]
  const cosLat = Math.cos((start.lat * Math.PI) / 180) // 1° de longitud mide menos lejos del ecuador
  const withAngle = places
    .map((place) => ({ place, angle: Math.atan2(place.lat - start.lat, (place.lon - start.lon) * cosLat) }))
    .sort((a, b) => a.angle - b.angle)
  // Mayor hueco (circular) entre ángulos consecutivos.
  let startIndex = 0
  let biggestGap = -1
  for (let i = 0; i < withAngle.length; i++) {
    const previous = withAngle[(i - 1 + withAngle.length) % withAngle.length].angle
    const gap = (withAngle[i].angle - previous + 2 * Math.PI) % (2 * Math.PI)
    if (gap > biggestGap) {
      biggestGap = gap
      startIndex = i
    }
  }
  return [...withAngle.slice(startIndex), ...withAngle.slice(0, startIndex)].map((x) => x.place)
}

/**
 * Reparte una ruta entre `parts` días de modo que cada día reciba la misma
 * cantidad de cada categoría (±1), respetando el orden de la ruta dentro de
 * cada categoría. Los sobrantes de cada categoría van rotando de día, para
 * que todos los días queden con un número parecido de lugares.
 * Ej. 4 museos y 4 bares en 3 días → museos 2·1·1, bares 1·2·1.
 */
export function splitByCategory<T extends { category: CategoryId }>(route: readonly T[], parts: number): T[][] {
  const days: T[][] = Array.from({ length: parts }, () => [])
  const categories = [...new Set(route.map((p) => p.category))]
  let nextExtra = 0 // día que recibe el próximo sobrante
  for (const category of categories) {
    const items = route.filter((p) => p.category === category)
    const sizes = Array.from({ length: parts }, () => Math.floor(items.length / parts))
    for (let k = 0; k < items.length % parts; k++) sizes[(nextExtra + k) % parts]++
    nextExtra = (nextExtra + (items.length % parts)) % parts
    let from = 0
    sizes.forEach((size, day) => {
      days[day].push(...items.slice(from, from + size))
      from += size
    })
  }
  return days
}

/**
 * Arma el plan día por día:
 *
 *   a) Ordena TODOS los lugares con el algoritmo de BARRIDO (sweepOrder): por
 *      su dirección vista desde el centro, como la aguja de un reloj. Lugares
 *      seguidos en ese orden están en la misma "tajada" de la ciudad.
 *   b) Reparte cada actividad por separado siguiendo ese orden
 *      (splitByCategory): el día 1 recibe los primeros museos del barrido, los
 *      primeros restaurantes, etc. Así cada día tiene de TODO lo elegido (no
 *      un día solo de restaurantes) y sus lugares quedan en la misma zona.
 *   c) Vuelve a optimizar cada día por separado, saliendo del punto de partida
 *      (cada mañana se sale del hotel). Los lugares de vida nocturna (bares,
 *      discotecas) van al final del día: la ruta de día se optimiza primero y
 *      la de la noche sigue desde el último lugar visitado.
 */
export function buildDailyPlan(start: GeoPoint, places: readonly Place[], dates: readonly string[]): DayPlan[] {
  const sweep = sweepOrder(start, places) // (a)
  const chunks = splitByCategory(sweep, dates.length) // (b)

  return chunks.map((chunk, i) => {
    const daytime = optimizeRoute(start, chunk.filter((p) => !isNightPlace(p))) // (c)
    const lastStop = daytime[daytime.length - 1] ?? start
    const dayRoute = [...daytime, ...optimizeRoute(lastStop, chunk.filter(isNightPlace))]
    return {
      day: i + 1,
      date: dates[i],
      places: dayRoute,
      distanceKm: round1(routeDistanceKm(start, dayRoute)),
    }
  })
}

/**
 * Compara la ruta optimizada contra la "ingenua": repartir los lugares entre
 * los días en el orden en que fueron elegidos, sin optimizar.
 * Esto permite mostrar cuánto ahorra el algoritmo.
 */
export function computeStats(start: GeoPoint, selected: readonly Place[], days: readonly DayPlan[]): ItineraryStats {
  const optimizedKm = days.reduce((sum, d) => sum + routeDistanceKm(start, d.places), 0)
  const unoptimizedKm = splitEvenly(selected, days.length).reduce(
    (sum, chunk) => sum + routeDistanceKm(start, chunk),
    0,
  )
  const savingPercent = unoptimizedKm > 0 ? ((unoptimizedKm - optimizedKm) / unoptimizedKm) * 100 : 0
  return {
    optimizedKm: round1(optimizedKm),
    unoptimizedKm: round1(unoptimizedKm),
    savingPercent: Math.max(0, Math.round(savingPercent)),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Bares y discotecas: se visitan de noche, al final del día. */
const isNightPlace = (place: Place) => place.category === 'vidaNocturna'

// ---------------------------------------------------------------------------
// Orquestador: los cinco pasos juntos
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  activitiesPerDay?: number
  /** Inyectable para tests (fecha de generación fija). */
  now?: () => Date
}

export async function generateItinerary(
  input: TripInput,
  client: OsmClient,
  options: GenerateOptions = {},
): Promise<Itinerary> {
  // Validaciones baratas primero, antes de gastar peticiones de red.
  tripDates(input.startDate, input.endDate)
  if (input.categories.length === 0) {
    throw new ItineraryError('INVALID_INPUT', 'Elige al menos una actividad.')
  }
  if (!Number.isFinite(input.budgetCOP) || input.budgetCOP < 0) {
    throw new ItineraryError('INVALID_INPUT', 'El presupuesto debe ser un valor positivo en pesos.')
  }

  const destination = await geocodeDestination(input.destination, client) // Paso 1
  return planItinerary(destination, input, client, options) // Pasos 2 a 5
}

/**
 * Pasos 2 a 5 para un destino que ya tiene coordenadas (en la app, el que se
 * eligió en el Paso 1): no vuelve a consultar Nominatim.
 */
export async function planItinerary(
  destination: Destination,
  input: TripInput,
  client: Pick<OsmClient, 'findPlaces'>,
  options: GenerateOptions = {},
): Promise<Itinerary> {
  const { activitiesPerDay = DEFAULT_ACTIVITIES_PER_DAY, now = () => new Date() } = options
  const dates = tripDates(input.startDate, input.endDate)
  if (input.categories.length === 0) {
    throw new ItineraryError('INVALID_INPUT', 'Elige al menos una actividad.')
  }

  const { byCategory, missingCategories } = await searchPlaces(destination, input.categories, client) // Paso 2
  const selected = selectPlaces(byCategory, input.categories, dates.length * activitiesPerDay) // Paso 3
  const days = buildDailyPlan(destination, selected, dates) // Pasos 4 y 5

  return {
    input,
    destination,
    days,
    missingCategories,
    stats: computeStats(destination, selected, days),
    generatedAt: now().toISOString(),
  }
}
