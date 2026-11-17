import { describe, expect, it } from 'vitest'
import {
  CANDIDATE_MAX_KM,
  FALLBACK_MAX_KM,
  MAX_DRIVE_MINUTES,
  fallbackNearbyTowns,
  maxExcursions,
  nearbyCandidates,
  pickByDrivingTime,
} from '../nearbyTowns'
import { buildRouteMatrixBody, createTravelTimeClient, parseRouteMatrix } from '../../itinerary/travelTimes'

const medellin = { lat: 6.2442, lon: -75.5812, displayName: 'Medellín, Antioquia, Colombia' }
const villavicencio = { lat: 4.142, lon: -73.627, displayName: 'Villavicencio, Meta, Colombia' }

describe('pueblos cercanos por tiempo en carro', () => {
  it('cerca de Medellín los candidatos son pueblos turísticos, no municipios dormitorio', () => {
    const names = nearbyCandidates(medellin).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['Guatapé', 'Santa Fe de Antioquia', 'Jardín']))
    expect(names).not.toContain('Bello')
    expect(nearbyCandidates(medellin).every((t) => t.distanceKm <= CANDIDATE_MAX_KM)).toBe(true)
  })

  it('Villavicencio: Sopó y Zipaquirá quedan fuera porque por carretera pasan de 2 horas', () => {
    const candidates = nearbyCandidates(villavicencio)
    // Minutos tomados de Geoapify (Route Matrix) para estos pueblos.
    const real: Record<string, number> = { Choachí: 133, Sopó: 146, Zipaquirá: 153, 'Puerto López': 95, 'San Martín': 70 }
    const towns = pickByDrivingTime(candidates, candidates.map((t) => real[t.name] ?? 300))
    const names = towns.map((t) => t.name)
    expect(names).not.toContain('Sopó')
    expect(names).not.toContain('Zipaquirá')
    expect(names).toEqual(['San Martín', 'Puerto López']) // del más rápido al más lento
    expect(towns.every((t) => t.driveMinutes! <= MAX_DRIVE_MINUTES)).toBe(true)
  })

  it('un pueblo sin ruta en carro (null) no se ofrece', () => {
    const [a, b] = nearbyCandidates(medellin)
    expect(pickByDrivingTime([a, b], [null, 50]).map((t) => t.name)).toEqual([b.name])
  })

  it('sin tiempos en carro solo ofrece los muy cercanos en línea recta', () => {
    expect(fallbackNearbyTowns(villavicencio).every((t) => t.distanceKm <= FALLBACK_MAX_KM)).toBe(true)
    expect(fallbackNearbyTowns(villavicencio).map((t) => t.name)).not.toContain('Sopó')
  })

  it('nunca propone el propio destino', () => {
    const barichara = { lat: 6.6357, lon: -73.2234, displayName: 'Barichara, Santander, Colombia' }
    expect(nearbyCandidates(barichara).map((t) => t.name)).not.toContain('Barichara')
  })

  it('siempre deja al menos un día en el destino principal', () => {
    expect(maxExcursions(1)).toBe(0)
    expect(maxExcursions(4)).toBe(3)
  })
})

describe('travelTimes (Geoapify Route Matrix)', () => {
  it('arma el cuerpo con [lon, lat] y lee los minutos', () => {
    expect(buildRouteMatrixBody({ lat: 4, lon: -73 }, [{ lat: 5, lon: -74 }])).toEqual({
      mode: 'drive',
      sources: [{ location: [-73, 4] }],
      targets: [{ location: [-74, 5] }],
    })
    expect(parseRouteMatrix({ sources_to_targets: [[{ time: 5400, distance: 1 }, { time: null, distance: null }]] }, 2)).toEqual([90, null])
    expect(() => parseRouteMatrix({}, 2)).toThrow()
  })

  it('hace una sola petición POST y propaga los errores HTTP', async () => {
    const calls: RequestInit[] = []
    const ok = createTravelTimeClient({
      apiKey: 'k',
      fetchFn: (async (_url: string | URL | Request, init?: RequestInit) => {
        calls.push(init!)
        return new Response(JSON.stringify({ sources_to_targets: [[{ time: 600, distance: 1 }]] }), { status: 200 })
      }) as typeof fetch,
    })
    expect(await ok.drivingMinutes({ lat: 0, lon: 0 }, [{ lat: 1, lon: 1 }])).toEqual([10])
    expect(calls[0].method).toBe('POST')
    const bad = createTravelTimeClient({ apiKey: 'k', fetchFn: (async () => new Response('{}', { status: 401 })) as typeof fetch })
    await expect(bad.drivingMinutes({ lat: 0, lon: 0 }, [{ lat: 1, lon: 1 }])).rejects.toMatchObject({ status: 401 })
  })
})
