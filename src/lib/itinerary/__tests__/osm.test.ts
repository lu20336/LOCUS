import { describe, expect, it } from 'vitest'
import { haversineKm } from '../geo'
import {
  MAX_RADIUS_METERS,
  MIN_RADIUS_METERS,
  buildActivityCountQuery,
  buildNominatimUrl,
  buildOverpassQuery,
  parseActivityCounts,
  type OverpassElement,
  parseNominatimResponse,
  parseOverpassResponse,
  radiusFromBoundingBox,
} from '../osm'
import { createThrottle } from '../throttle'
import { nominatimCartagena, overpassCartagena } from './fixtures/cartagena'

describe('haversineKm', () => {
  it('Bogotá–Medellín está a unos 240 km en línea recta', () => {
    const bogota = { lat: 4.711, lon: -74.0721 }
    const medellin = { lat: 6.2442, lon: -75.5812 }
    const d = haversineKm(bogota, medellin)
    expect(d).toBeGreaterThan(235)
    expect(d).toBeLessThan(245)
  })

  it('la distancia de un punto a sí mismo es 0 y es simétrica', () => {
    const a = { lat: 10.42, lon: -75.55 }
    const b = { lat: 10.4, lon: -75.56 }
    expect(haversineKm(a, a)).toBe(0)
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10)
  })
})

describe('Nominatim', () => {
  it('convierte la respuesta en un Destination con radio acotado', () => {
    const destination = parseNominatimResponse('Cartagena', nominatimCartagena)
    expect(destination).toMatchObject({
      query: 'Cartagena',
      displayName: 'Cartagena de Indias, Bolívar, Colombia',
      lat: 10.4265566,
      lon: -75.5441671,
    })
    // El bbox de Cartagena mide ~25 km de diagonal → se acota al máximo.
    expect(destination?.radiusMeters).toBe(MAX_RADIUS_METERS)
  })

  it('devuelve null si no hay resultados', () => {
    expect(parseNominatimResponse('Xyzzy', [])).toBeNull()
  })

  it('limita la búsqueda a Colombia y agrega el correo de contacto', () => {
    const url = new URL(buildNominatimUrl('https://nominatim.example', 'Salento', 'equipo@example.com'))
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('q')).toBe('Salento')
    expect(url.searchParams.get('countrycodes')).toBe('co')
    expect(url.searchParams.get('email')).toBe('equipo@example.com')
  })

  it('un pueblo pequeño recibe el radio mínimo', () => {
    expect(radiusFromBoundingBox(['5.0', '5.001', '-75.0', '-74.999'])).toBe(MIN_RADIUS_METERS)
  })
})

describe('Overpass', () => {
  it('arma una sola consulta con un bloque por categoría', () => {
    const query = buildOverpassQuery({ lat: 10.4265566, lon: -75.5441671 }, 5000, ['cultura', 'gastronomia'])
    expect(query).toContain('[out:json]')
    expect(query).toContain('nwr["tourism"~"^(museum|gallery)$"]["name"](around:5000,10.426557,-75.544167);')
    expect(query).toContain('->.cultura;')
    expect(query).toContain('.cultura out center 60;')
    expect(query).toContain('nwr["amenity"~"^(restaurant|cafe)$"]')
    expect(query).not.toContain('beach')
  })

  it('descarta lugares sin nombre/coordenadas, elimina duplicados y clasifica', () => {
    const places = parseOverpassResponse(overpassCartagena, ['cultura', 'gastronomia', 'playa', 'vidaNocturna'])
    const names = places.map((p) => p.name)

    expect(names.filter((n) => n === 'Museo del Oro Zenú')).toHaveLength(1)
    expect(names).not.toContain('Relación sin centro')
    expect(places).toHaveLength(13)

    const castillo = places.find((p) => p.name === 'Castillo San Felipe de Barajas')
    expect(castillo).toMatchObject({ id: 'way/1004', category: 'cultura', kind: 'Castillo', lat: 10.4227 })

    const cevicheria = places.find((p) => p.name === 'La Cevichería')
    expect(cevicheria?.score).toBe(3) // base 1 + sitio web + horario
    expect(castillo?.score).toBe(4) // base 1 + Wikidata
  })

  it('ignora lugares de categorías que el usuario no eligió', () => {
    const places = parseOverpassResponse(overpassCartagena, ['playa'])
    expect(places.map((p) => p.category)).toEqual(['playa', 'playa'])
  })
})

describe('createThrottle', () => {
  it('espera el intervalo mínimo entre tareas consecutivas', async () => {
    let clock = 0
    const sleeps: number[] = []
    const schedule = createThrottle(
      1000,
      () => clock,
      async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
    )
    const starts: number[] = []
    const task = async () => {
      starts.push(clock)
      clock += 200 // la petición tarda 200 ms
    }
    await Promise.all([schedule(task), schedule(task), schedule(task)])
    expect(starts).toEqual([0, 1000, 2000])
    expect(sleeps).toEqual([800, 800])
  })

  it('una tarea fallida no bloquea las siguientes', async () => {
    const schedule = createThrottle(0)
    await expect(schedule(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(schedule(async () => 'ok')).resolves.toBe('ok')
  })
})

describe('conteo de actividades por lotes (out count)', () => {
  const points = [
    { lat: 4.6097, lon: -74.0817 },
    { lat: 5.5353, lon: -73.3678 },
  ]

  it('arma un bloque "out count" por cada punto y categoría, en orden', () => {
    const q = buildActivityCountQuery(points, 7000, ['cultura', 'playa'])
    expect(q.startsWith('[out:json][timeout:5];')).toBe(true)
    expect(q.match(/out count;/g)).toHaveLength(4)
    // El orden importa: (punto 1: cultura, playa), (punto 2: cultura, playa).
    const order = [...q.matchAll(/"(tourism|natural)".*?around:7000,([\d.-]+),/g)].map((m) => `${m[1]}@${m[2]}`)
    expect(order[0]).toBe('tourism@4.609700')
    expect(order.at(-1)).toBe('natural@5.535300')
  })

  it('lee los conteos y devuelve las categorías con al menos un lugar por punto', () => {
    const count = (total: number) => ({ type: 'count', id: 0, tags: { total: String(total) } }) as unknown as OverpassElement
    const response = { elements: [count(59), count(0), count(5), count(0)] }
    expect(parseActivityCounts(response, 2, ['cultura', 'playa'])).toEqual([['cultura'], ['cultura']])
  })

  it('una respuesta incompleta es un error, no "sin actividades"', () => {
    expect(() => parseActivityCounts({ elements: [] }, 2, ['cultura'])).toThrow(/conteos/)
  })
})
