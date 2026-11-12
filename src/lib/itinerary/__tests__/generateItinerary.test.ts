import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CategoryId, GeoPoint, Place, TripInput } from '../../../types/itinerary'
import { ItineraryError, OsmHttpError } from '../errors'
import {
  buildDailyPlan,
  generateItinerary,
  geocodeDestination,
  optimizeRoute,
  routeDistanceKm,
  searchPlaces,
  selectPlaces,
  splitEvenly,
  tripDates,
} from '../generateItinerary'
import { haversineKm } from '../geo'
import { parseNominatimResponse, parseOverpassResponse } from '../osm'
import {
  OVERPASS_ATTEMPT_TIMEOUT_MS,
  OVERPASS_MAX_ATTEMPTS,
  OVERPASS_MIN_INTERVAL_MS,
  createOsmClient,
  type OsmClient,
  type OsmClientOptions,
} from '../osmClient'
import { CACHE_TTL_MS, FAILURE_MEMORY_MS, createStorageCache, createStorageFailureMemory } from '../overpassCache'
import { nominatimCartagena, overpassCartagena } from './fixtures/cartagena'

/** Cliente real con fetch falso: sin throttle, sin caché y sin memoria de fallos. */
const testOsmClient = (options: OsmClientOptions = {}) =>
  createOsmClient({ overpassMinIntervalMs: 0, cache: null, failureMemory: null, ...options })

/** Cliente falso que responde con los fixtures de Cartagena, sin red. */
const fixtureClient: OsmClient = {
  geocode: async (query) => parseNominatimResponse(query, nominatimCartagena),
  findPlaces: async (_center, _radius, categories) => parseOverpassResponse(overpassCartagena, categories),
}

const place = (id: string, lat: number, lon: number, category: CategoryId = 'cultura', score = 1): Place => ({
  id,
  name: id,
  lat,
  lon,
  category,
  kind: 'Museo',
  score,
})

// Puntos sobre el ecuador: 0,01° de longitud ≈ 1,11 km.
const origin: GeoPoint = { lat: 0, lon: 0 }

describe('optimizeRoute (vecino más cercano)', () => {
  it('ordena puntos en línea recta de cerca a lejos', () => {
    const shuffled = [place('C', 0, 0.03), place('A', 0, 0.01), place('D', 0, 0.04), place('B', 0, 0.02)]
    expect(optimizeRoute(origin, shuffled).map((p) => p.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('en cada paso va al lugar pendiente más cercano', () => {
    // Nube de puntos pseudoaleatoria y determinista.
    let seed = 42
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const points = Array.from({ length: 25 }, (_, i) => place(`P${i}`, random() * 0.1, random() * 0.1))

    const route = optimizeRoute(origin, points)
    expect(route).toHaveLength(points.length)
    expect(new Set(route.map((p) => p.id)).size).toBe(points.length)

    let current: GeoPoint = origin
    for (let k = 0; k < route.length; k++) {
      const remaining = route.slice(k)
      const best = Math.min(...remaining.map((p) => haversineKm(current, p)))
      expect(haversineKm(current, route[k])).toBeCloseTo(best, 10)
      current = route[k]
    }
  })

  it('reduce la distancia frente al orden original', () => {
    const zigzag = [place('1', 0, 0.04), place('2', 0, 0.01), place('3', 0, 0.03), place('4', 0, 0.02)]
    const before = routeDistanceKm(origin, zigzag)
    const after = routeDistanceKm(origin, optimizeRoute(origin, zigzag))
    expect(after).toBeLessThan(before)
    expect(after).toBeCloseTo(haversineKm(origin, { lat: 0, lon: 0.04 }), 6)
  })

  it('no modifica el arreglo original y acepta listas vacías', () => {
    const input = [place('B', 0, 0.02), place('A', 0, 0.01)]
    optimizeRoute(origin, input)
    expect(input.map((p) => p.id)).toEqual(['B', 'A'])
    expect(optimizeRoute(origin, [])).toEqual([])
  })
})

describe('tripDates', () => {
  it('incluye ambos extremos', () => {
    expect(tripDates('2026-12-30', '2027-01-01')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
    expect(tripDates('2026-12-01', '2026-12-01')).toEqual(['2026-12-01'])
  })

  it('rechaza rangos inválidos', () => {
    expect(() => tripDates('2026-12-05', '2026-12-01')).toThrow(ItineraryError)
    expect(() => tripDates('', '2026-12-01')).toThrow(/fecha/)
    expect(() => tripDates('2026-01-01', '2026-02-01')).toThrow(/14 días/)
  })
})

describe('splitEvenly y selectPlaces', () => {
  it('reparte en grupos de tamaño parecido', () => {
    expect(splitEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3).map((g) => g.length)).toEqual([3, 3, 4])
    expect(splitEvenly([1], 3)).toEqual([[], [], [1]])
  })

  it('alterna categorías por turnos', () => {
    const byCategory = {
      cultura: [place('c1', 0, 0), place('c2', 0, 0), place('c3', 0, 0)],
      gastronomia: [place('g1', 0, 0, 'gastronomia')],
    }
    const ids = selectPlaces(byCategory, ['cultura', 'gastronomia'], 4).map((p) => p.id)
    expect(ids).toEqual(['c1', 'g1', 'c2', 'c3'])
  })

  it('se detiene si no hay suficientes lugares', () => {
    expect(selectPlaces({ cultura: [place('c1', 0, 0)] }, ['cultura'], 10)).toHaveLength(1)
  })
})

describe('buildDailyPlan', () => {
  it('agrupa por zonas: cada día recibe los lugares cercanos entre sí', () => {
    // Dos zonas: una al este y otra al oeste del hotel.
    const east = [place('E1', 0, 0.05), place('E2', 0, 0.06)]
    const west = [place('W1', 0, -0.05), place('W2', 0, -0.06)]
    const days = buildDailyPlan(origin, [east[0], west[0], east[1], west[1]], ['2026-12-01', '2026-12-02'])

    // Cada día queda en una sola zona (todo E o todo W) y los dos días son zonas distintas.
    const zones = days.map((d) => [...new Set(d.places.map((p) => p.id[0]))])
    expect(zones.every((z) => z.length === 1)).toBe(true)
    expect(zones.flat().sort()).toEqual(['E', 'W'])
    expect(days.map((d) => d.date)).toEqual(['2026-12-01', '2026-12-02'])
    expect(days[0].distanceKm).toBeGreaterThan(0)
  })
})

describe('geocodeDestination y searchPlaces', () => {
  it('geocodifica con el cliente', async () => {
    const destination = await geocodeDestination('  Cartagena ', fixtureClient)
    expect(destination.query).toBe('Cartagena')
    expect(destination.lat).toBeCloseTo(10.4266, 3)
  })

  it('destino inexistente → DESTINATION_NOT_FOUND', async () => {
    const client: OsmClient = { ...fixtureClient, geocode: async () => null }
    await expect(geocodeDestination('Xyzzy', client)).rejects.toMatchObject({ code: 'DESTINATION_NOT_FOUND' })
  })

  it('límite de peticiones → RATE_LIMITED; caída → SERVICE_UNAVAILABLE', async () => {
    const limited: OsmClient = { ...fixtureClient, geocode: async () => Promise.reject(new OsmHttpError(429, '')) }
    await expect(geocodeDestination('Cartagena', limited)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    const down: OsmClient = { ...fixtureClient, geocode: async () => Promise.reject(new TypeError('fetch failed')) }
    await expect(geocodeDestination('Cartagena', down)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })

  it('ordena por relevancia y reporta categorías sin resultados', async () => {
    const destination = await geocodeDestination('Cartagena', fixtureClient)
    const result = await searchPlaces(destination, ['cultura', 'compras'], fixtureClient)
    expect(result.missingCategories).toEqual(['compras'])
    const scores = result.byCategory.cultura!.map((p) => p.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(result.byCategory.cultura![0].name).toBe('Palacio de la Inquisición') // Wikidata + web
  })

  it('ninguna categoría con resultados → NO_PLACES', async () => {
    const destination = await geocodeDestination('Cartagena', fixtureClient)
    await expect(searchPlaces(destination, ['compras'], fixtureClient)).rejects.toMatchObject({ code: 'NO_PLACES' })
  })
})

describe('generateItinerary (flujo completo con datos de ejemplo)', () => {
  const input: TripInput = {
    destination: 'Cartagena, Colombia',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    budgetCOP: 2_500_000,
    categories: ['cultura', 'gastronomia', 'playa', 'vidaNocturna', 'compras'],
  }

  it('genera 3 días con lugares reales, ordenados y sin repetir', async () => {
    const itinerary = await generateItinerary(input, fixtureClient, { now: () => new Date('2026-10-02T12:00:00Z') })

    expect(itinerary.days).toHaveLength(3)
    expect(itinerary.missingCategories).toEqual(['compras'])
    expect(itinerary.generatedAt).toBe('2026-10-02T12:00:00.000Z')

    const all = itinerary.days.flatMap((d) => d.places)
    expect(all).toHaveLength(12) // 3 días × 4 actividades
    expect(new Set(all.map((p) => p.id)).size).toBe(12)
    for (const day of itinerary.days) {
      expect(day.places.length).toBeGreaterThan(0)
      // Cada día está en el orden del vecino más cercano desde el centro.
      expect(day.places).toEqual(optimizeRoute(itinerary.destination, day.places))
    }

    expect(itinerary.stats.optimizedKm).toBeLessThanOrEqual(itinerary.stats.unoptimizedKm)
    expect(itinerary.stats.savingPercent).toBeGreaterThanOrEqual(0)
  })

  it('valida antes de usar la red', async () => {
    const spy = vi.fn(fixtureClient.geocode)
    const client = { ...fixtureClient, geocode: spy }
    await expect(generateItinerary({ ...input, categories: [] }, client)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(generateItinerary({ ...input, budgetCOP: -1 }, client)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('cliente de OSM (con fetch falso)', () => {
  const fixtureFetch = (calls: { url: string; init: RequestInit }[]) =>
    (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const body = url.includes('nominatim') ? nominatimCartagena : overpassCartagena
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch

  it('modo navegador: llama directo a Nominatim con email y sin User-Agent; Overpass por POST', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = testOsmClient({ email: 'equipo@locus.test', fetchFn: fixtureFetch(calls) })
    const destination = await client.geocode('Cartagena')
    const places = await client.findPlaces(destination!, 5000, ['playa'])

    expect(calls[0].url).toBe(
      'https://nominatim.openstreetmap.org/search?q=Cartagena&format=jsonv2&limit=1&accept-language=es&countrycodes=co&email=equipo%40locus.test',
    )
    expect(calls[0].init.headers).not.toHaveProperty('User-Agent')
    expect(calls[1].url).toBe('https://overpass-api.de/api/interpreter')
    expect(calls[1].init.method).toBe('POST')
    expect(String(calls[1].init.body)).toMatch(/^data=/)
    expect(places.map((p) => p.name)).toEqual(['Playa de Bocagrande', 'Playa del Laguito'])
  })

  it('modo Node: envía User-Agent y omite email si no se configuró', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = testOsmClient({ userAgent: 'Locus-test/1.0', fetchFn: fixtureFetch(calls) })
    await client.geocode('Cartagena')
    expect(calls[0].url).not.toContain('email=')
    expect((calls[0].init.headers as Record<string, string>)['User-Agent']).toBe('Locus-test/1.0')
  })

  it('propaga errores HTTP (ej. 429) para que el motor muestre RATE_LIMITED', async () => {
    const fakeFetch = (async () => new Response('Too Many Requests', { status: 429 })) as unknown as typeof fetch
    const client = testOsmClient({ fetchFn: fakeFetch })
    await expect(client.findPlaces({ lat: 1, lon: 2 }, 3000, ['playa'])).rejects.toMatchObject({ status: 429 })
    await expect(geocodeDestination('Cartagena', client)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('Overpass: 2 intentos rápidos, sin esperas (sin red)', () => {
  const ok = () => new Response(JSON.stringify(overpassCartagena), { status: 200 })
  const status = (code: number) => () => new Response('', { status: code })
  const MAIN = 'overpass-api.de'
  const KUMI = 'overpass.kumi.systems'
  const COFFEE = 'overpass.private.coffee'

  /** fetch falso: cada servidor responde con su función; registra a quién se llamó. */
  function fakeServers(script: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
    const hosts: string[] = []
    const fn = (async (url: string, init: RequestInit) => {
      const host = new URL(url).host
      hosts.push(host)
      return (script[host] ?? ok)(init)
    }) as unknown as typeof fetch
    return { fn, hosts }
  }

  /** Servidor que nunca responde (como un ERR_CONNECTION_TIMED_OUT): solo termina si se aborta. */
  const neverResponds = (init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal!.reason)))

  afterEach(() => {
    vi.useRealTimers()
  })

  it('429: pasa DE INMEDIATO al siguiente servidor', async () => {
    const { fn, hosts } = fakeServers({ [MAIN]: status(429) })
    const places = await testOsmClient({ fetchFn: fn }).findPlaces({ lat: 10.42, lon: -75.54 }, 5000, ['playa'])
    expect(places).toHaveLength(2)
    expect(hosts).toEqual([MAIN, KUMI])
  })

  it('504, error de red y "runtime error" también pasan al siguiente', async () => {
    const cut = () => new Response(JSON.stringify({ elements: [], remark: 'runtime error: Query timed out' }), { status: 200 })
    for (const failure of [status(504), () => Promise.reject(new TypeError('Failed to fetch')), cut, status(406)]) {
      const { fn, hosts } = fakeServers({ [MAIN]: failure })
      await testOsmClient({ fetchFn: fn }).queryOverpass('[out:json];out;')
      expect(hosts).toEqual([MAIN, KUMI])
    }
  })

  it('máximo 2 intentos: si ambos fallan, no prueba un tercero y propaga el error', async () => {
    const { fn, hosts } = fakeServers({ [MAIN]: status(429), [KUMI]: status(429) })
    const destination = { query: 'X', displayName: 'X', lat: 1, lon: 2, radiusMeters: 3000 }
    await expect(searchPlaces(destination, ['playa'], testOsmClient({ fetchFn: fn }))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
    expect(hosts).toEqual([MAIN, KUMI])
    expect(hosts).not.toContain(COFFEE)
  })

  it('un 400 (consulta mal escrita) no se reintenta', async () => {
    const { fn, hosts } = fakeServers({ [MAIN]: status(400) })
    await expect(testOsmClient({ fetchFn: fn }).queryOverpass('mala')).rejects.toMatchObject({ status: 400 })
    expect(hosts).toEqual([MAIN])
  })

  it('timeout de 2500 ms por intento (AbortController): un servidor que no responde se abandona a tiempo', async () => {
    vi.useFakeTimers()
    const { fn, hosts } = fakeServers({ [MAIN]: neverResponds })
    const start = Date.now()
    let doneAt = 0
    const query = testOsmClient({ fetchFn: fn })
      .queryOverpass('[out:json];out;')
      .then(() => (doneAt = Date.now()))
    await vi.advanceTimersByTimeAsync(OVERPASS_ATTEMPT_TIMEOUT_MS)
    await query
    expect(hosts).toEqual([MAIN, KUMI])
    expect(doneAt - start).toBe(OVERPASS_ATTEMPT_TIMEOUT_MS)
  })

  it('recuerda 5 minutos el servidor que falló y no lo usa primero en la siguiente búsqueda', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    } as unknown as Storage
    let now = 0
    const failureMemory = createStorageFailureMemory(storage, FAILURE_MEMORY_MS, () => now)

    const first = fakeServers({ [MAIN]: status(429) })
    await testOsmClient({ fetchFn: first.fn, failureMemory }).queryOverpass('búsqueda 1')
    expect(first.hosts).toEqual([MAIN, KUMI])

    // Otra búsqueda (incluso con otro cliente, como tras recargar la página): kumi primero.
    const second = fakeServers({})
    await testOsmClient({ fetchFn: second.fn, failureMemory }).queryOverpass('búsqueda 2')
    expect(second.hosts).toEqual([KUMI])

    now = FAILURE_MEMORY_MS + 1 // pasaron 5 minutos: overpass-api.de vuelve a ser el primero
    const third = fakeServers({})
    await testOsmClient({ fetchFn: third.fn, failureMemory }).queryOverpass('búsqueda 3')
    expect(third.hosts).toEqual([MAIN])
  })

  it('caché: repetir la misma consulta no vuelve a llamar a Overpass; vence a las 24 h', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    } as unknown as Storage
    let now = 0
    const cache = createStorageCache(storage, CACHE_TTL_MS, () => now)
    const { fn, hosts } = fakeServers({})
    const client = testOsmClient({ fetchFn: fn, cache })

    await client.queryOverpass('[out:json];out;')
    await client.queryOverpass('[out:json];out;') // misma consulta → caché
    expect(hosts).toHaveLength(1)
    await client.queryOverpass('[out:json];node;out;') // otra consulta → Overpass
    expect(hosts).toHaveLength(2)

    now = CACHE_TTL_MS + 1 // pasaron 24 h
    await client.queryOverpass('[out:json];out;')
    expect(hosts).toHaveLength(3)
  })

  it('envía un "simple request": POST form-urlencoded con data= codificado', async () => {
    const calls: RequestInit[] = []
    const fn = (async (_url: string, init: RequestInit) => {
      calls.push(init)
      return ok()
    }) as unknown as typeof fetch
    await testOsmClient({ fetchFn: fn }).queryOverpass('[out:json];node["name"="Café & Bar"];out;')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(calls[0].body).toBe(`data=${encodeURIComponent('[out:json];node["name"="Café & Bar"];out;')}`)
  })

  it('parámetros: 2 intentos de 2,5 s (≤ 5 s) y throttle de 2,5 s por servidor', () => {
    expect(OVERPASS_MAX_ATTEMPTS).toBe(2)
    expect(OVERPASS_ATTEMPT_TIMEOUT_MS * OVERPASS_MAX_ATTEMPTS).toBeLessThanOrEqual(5000)
    expect(OVERPASS_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(2000)
  })
})
