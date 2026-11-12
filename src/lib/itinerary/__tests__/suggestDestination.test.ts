import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { CategoryId } from '../../../types/itinerary'
import type { OverpassElement } from '../osm'
import { createOsmClient } from '../osmClient'
import {
  ACTIVITY_BATCH_SIZE,
  CANDIDATES_TO_CHECK,
  buildColombiaTownsQuery,
  clearTownsCache,
  climateForElevation,
  parseElevationTag,
  parseTownCandidates,
  popularityScore,
  suggestDestination,
  type SuggestionDeps,
  type SuggestionProgress,
} from '../suggestDestination'

// Pueblos de ejemplo (coordenadas y altitudes aproximadas).
const town = (id: number, name: string, ele: string | undefined, population: number, place = 'town'): OverpassElement => ({
  type: 'node',
  id,
  lat: 5 + id / 100,
  lon: -74 - id / 100,
  tags: { name, place, population: String(population), ...(ele ? { ele } : {}) },
})

const TOWNS: OverpassElement[] = [
  town(1, 'Bogotá', '2640', 7_900_000, 'city'),
  town(2, 'Tunja', '2810', 180_000, 'city'),
  town(3, 'Villa de Leyva', '2149', 17_000),
  town(4, 'Zipaquirá', undefined, 130_000), // sin `ele`: se consulta en Open-Elevation
  town(5, 'Girardot', '289', 110_000),
  town(6, 'Santa Marta', '2', 500_000, 'city'),
  town(7, 'Salento', '1895', 7_000),
  town(8, 'Sin altitud', undefined, 5_000),
]

/** Actividades que "existen" cerca de cada pueblo, por nombre. */
const ACTIVITIES: Record<string, CategoryId[]> = {
  Bogotá: ['cultura', 'gastronomia', 'vidaNocturna', 'compras'],
  Tunja: ['cultura'],
  'Villa de Leyva': ['cultura', 'gastronomia', 'aventura'],
  Zipaquirá: ['cultura', 'gastronomia'],
  'Santa Marta': ['playa', 'gastronomia'],
}

type CheckActivities = SuggestionDeps['checkActivities']

/** Respuesta falsa de checkActivities: las actividades de ACTIVITIES para cada punto. */
const fakeCheck: CheckActivities = async (centers, _radius, categories) =>
  centers.map((center) => {
    const name = TOWNS.find((t) => t.lat === center.lat)?.tags?.name ?? ''
    return (ACTIVITIES[name] ?? []).filter((c) => categories.includes(c))
  })

function makeDeps(overrides: Partial<SuggestionDeps> = {}): SuggestionDeps & { checkActivities: Mock<CheckActivities> } {
  return {
    loadTowns: async () => parseTownCandidates({ elements: TOWNS }),
    // Zipaquirá → 2650 m; "Sin altitud" → Open-Elevation tampoco sabe.
    elevation: async (points) => points.map((p) => (p.lat === TOWNS[3].lat ? 2650 : null)),
    ...overrides,
    checkActivities: vi.fn<CheckActivities>(overrides.checkActivities ?? fakeCheck),
  }
}

beforeEach(() => clearTownsCache())

describe('piezas puras', () => {
  it('asigna clima por altitud (pisos térmicos)', () => {
    expect(climateForElevation(2)).toBe('calido')
    expect(climateForElevation(999)).toBe('calido')
    expect(climateForElevation(1000)).toBe('templado')
    expect(climateForElevation(2640)).toBe('frio')
    expect(climateForElevation(4000)).toBeNull() // páramo / nieve
  })

  it('lee la etiqueta ele en sus formatos comunes', () => {
    expect(parseElevationTag('2640')).toBe(2640)
    expect(parseElevationTag('2149 m')).toBe(2149)
    expect(parseElevationTag('12,5')).toBe(12.5)
    expect(parseElevationTag('alto')).toBeNull()
    expect(parseElevationTag(undefined)).toBeNull()
  })

  it('popularidad: ciudad grande > pueblo pequeño', () => {
    expect(popularityScore({ place: 'city', population: '7900000' })).toBeGreaterThan(
      popularityScore({ place: 'town', population: '17000' }),
    )
  })

  it('la consulta de Overpass busca ciudades, pueblos y veredas con Wikidata en Colombia', () => {
    const q = buildColombiaTownsQuery()
    expect(q).toContain('area["ISO3166-1"="CO"][admin_level=2]')
    expect(q).toContain('node["place"~"^(city|town)$"]')
    expect(q).toContain('node["place"="village"]["name"]["wikidata"]')
  })

  it('ordena los candidatos por popularidad', () => {
    const names = parseTownCandidates({ elements: TOWNS }).map((c) => c.name)
    expect(names[0]).toBe('Bogotá')
  })
})

describe('suggestDestination', () => {
  it('Frío + Cultura/Gastronomía/Aventura: Villa de Leyva gana por actividades', async () => {
    const result = await suggestDestination('frio', ['cultura', 'gastronomia', 'aventura'], makeDeps())

    expect(result.climateOnly).toBe(false)
    expect(result.suggestions.map((s) => s.candidate.name)).toEqual(['Villa de Leyva', 'Bogotá', 'Zipaquirá'])
    expect(result.suggestions[0].matchedCategories).toEqual(['cultura', 'gastronomia', 'aventura'])
    // Zipaquirá no tenía `ele`: su clima salió de Open-Elevation.
    expect(result.suggestions[2].elevation).toBe(2650)
    // Todos cumplen el clima.
    expect(result.suggestions.every((s) => s.climate === 'frio')).toBe(true)
  })

  it('combinación imposible (Frío + Playa): no se rompe y cae al modo "solo clima"', async () => {
    const result = await suggestDestination('frio', ['playa'], makeDeps())
    expect(result.climateOnly).toBe(true)
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions.every((s) => s.matchedCategories.length === 0 && s.activitiesChecked)).toBe(true)
    // Sin coincidencias, se ordenan por popularidad.
    expect(result.suggestions[0].candidate.name).toBe('Bogotá')
  })

  it('Cálido + Playa encuentra Santa Marta', async () => {
    const result = await suggestDestination('calido', ['playa'], makeDeps())
    expect(result.suggestions[0].candidate.name).toBe('Santa Marta')
    expect(result.suggestions[0].matchedCategories).toEqual(['playa'])
  })

  it('reporta el progreso por fases', async () => {
    const progress: SuggestionProgress[] = []
    await suggestDestination('frio', ['cultura'], makeDeps(), { onProgress: (p) => progress.push(p) })
    expect(progress.map((p) => p.phase).slice(0, 2)).toEqual(['towns', 'elevation'])
    expect(progress[1].message).toBe('Revisando pueblos con clima frío…')
    const activityMessages = progress.filter((p) => p.phase === 'activities').map((p) => p.message)
    // 4 candidatos fríos → una sola consulta.
    expect(activityMessages).toEqual(['Comprobando actividades en 4 pueblos con clima frío…'])
  })

  it('si no se alcanzan a verificar las actividades, devuelve igual los 3 mejores por clima, con aviso', async () => {
    const deps = makeDeps({ checkActivities: async () => Promise.reject(new TypeError('Failed to fetch')) })
    const result = await suggestDestination('frio', ['cultura'], deps)
    expect(result.activitiesUnverified).toBe(true)
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions.every((s) => !s.activitiesChecked && s.climate === 'frio')).toBe(true)
    expect(result.suggestions[0].candidate.name).toBe('Bogotá') // sin datos de actividades: el más popular
  })

  it('si Open-Elevation falla, usa solo la altitud que trae OSM', async () => {
    const result = await suggestDestination('frio', ['cultura'], makeDeps({ elevation: async () => Promise.reject(new Error('down')) }))
    expect(result.suggestions.map((s) => s.candidate.name)).not.toContain('Zipaquirá')
  })

  it('si no se pueden cargar los pueblos, lanza un error claro (no se queda cargando)', async () => {
    const deps = makeDeps({ loadTowns: async () => Promise.reject(new Error('timeout')) })
    await expect(suggestDestination('frio', ['cultura'], deps)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })

  it('revisa como máximo CANDIDATES_TO_CHECK pueblos, todos en UNA consulta', async () => {
    const many = Array.from({ length: 40 }, (_, i) => town(100 + i, `Pueblo ${i}`, '2500', 10_000))
    const deps = makeDeps({ loadTowns: async () => parseTownCandidates({ elements: many }) })
    await suggestDestination('frio', ['cultura'], deps)
    const sizes = deps.checkActivities.mock.calls.map(([centers]) => centers.length)
    expect(sizes).toEqual([CANDIDATES_TO_CHECK])
    expect(ACTIVITY_BATCH_SIZE).toBe(CANDIDATES_TO_CHECK)
  })

  it('se puede cancelar', async () => {
    const many = Array.from({ length: 40 }, (_, i) => town(100 + i, `Pueblo ${i}`, '2500', 10_000))
    const controller = new AbortController()
    const deps = makeDeps({
      loadTowns: async () => parseTownCandidates({ elements: many }),
      checkActivities: async (centers) => {
        controller.abort()
        return centers.map(() => [])
      },
    })
    await expect(suggestDestination('frio', ['cultura'], deps, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(deps.checkActivities).toHaveBeenCalledTimes(1)
  })

  it('exige al menos una actividad', async () => {
    await expect(suggestDestination('frio', [], makeDeps())).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('nunca deja esperando: primer servidor Overpass sin respuesta (timers falsos)', () => {
  afterEach(() => vi.useRealTimers())

  /** Servidor que nunca responde (ERR_CONNECTION_TIMED_OUT): solo termina si se aborta. */
  const neverResponds = (init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal!.reason)))

  /** Servidor sano: responde un conteo (total 1) por cada bloque "out count" de la consulta. */
  const countsAll = (init: RequestInit) => {
    const query = decodeURIComponent(String(init.body).slice('data='.length))
    const blocks = query.match(/out count;/g)?.length ?? 0
    const elements = Array.from({ length: blocks }, () => ({ type: 'count', id: 0, tags: { total: '1' } }))
    return new Response(JSON.stringify({ elements }), { status: 200 })
  }

  async function runSuggestion(servers: Record<string, (init: RequestInit) => Promise<Response> | Response>) {
    vi.useFakeTimers()
    const hosts: string[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      const host = new URL(url).host
      hosts.push(host)
      return servers[host](init)
    }) as unknown as typeof fetch
    // Cliente REAL (timeouts con AbortController); solo la red es falsa.
    const client = createOsmClient({ fetchFn, cache: null, failureMemory: null })
    const deps = makeDeps({ checkActivities: (centers, radius, categories) => client.checkActivities(centers, radius, categories) })

    const start = Date.now()
    let doneAt = Number.POSITIVE_INFINITY
    const promise = suggestDestination('frio', ['cultura'], deps).then((r) => {
      doneAt = Date.now()
      return r
    })
    // Avanzamos el reloj de 100 en 100 ms hasta que termine (máximo 10 s).
    for (let t = 0; t < 10_000 && doneAt === Number.POSITIVE_INFINITY; t += 100) await vi.advanceTimersByTimeAsync(100)
    return { result: await promise, elapsed: doneAt - start, hosts }
  }

  it('el primero no responde → usa el segundo y termina en menos de 5000 ms', async () => {
    const { result, elapsed, hosts } = await runSuggestion({
      'overpass-api.de': neverResponds,
      'overpass.kumi.systems': countsAll,
    })
    expect(hosts).toEqual(['overpass-api.de', 'overpass.kumi.systems'])
    expect(elapsed).toBeLessThan(5000)
    expect(result.activitiesUnverified).toBe(false)
    expect(result.suggestions.every((s) => s.matchedCategories.includes('cultura'))).toBe(true)
  })

  it('ninguno responde → resultado por clima con aviso, dentro de los 5000 ms', async () => {
    const { result, elapsed, hosts } = await runSuggestion({
      'overpass-api.de': neverResponds,
      'overpass.kumi.systems': neverResponds,
    })
    expect(hosts).toEqual(['overpass-api.de', 'overpass.kumi.systems'])
    expect(elapsed).toBeLessThanOrEqual(5000)
    expect(result.activitiesUnverified).toBe(true)
    expect(result.suggestions).toHaveLength(3)
  })
})
