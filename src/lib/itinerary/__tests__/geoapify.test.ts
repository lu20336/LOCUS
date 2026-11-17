import { describe, expect, it, vi } from 'vitest'
import {
  GEOAPIFY_CATEGORIES,
  buildGeoapifyUrl,
  classifyGeoapify,
  createGeoapifyClient,
  parseGeoapifyPlaces,
  type GeoapifyResponse,
} from '../geoapifyClient'
import { CATEGORY_IDS } from '../categories'

const feature = (name: string | undefined, categories: string[], extra: Record<string, unknown> = {}) => ({
  properties: { name, lat: 10.42, lon: -75.55, categories, place_id: `p-${name}`, ...extra },
})

describe('buildGeoapifyUrl', () => {
  it('usa circle:lon,lat,radio y limita a 500', () => {
    const url = new URL(buildGeoapifyUrl({ lat: 4.6097, lon: -74.0817 }, 7000, ['beach'], 'clave', 900))
    expect(url.origin + url.pathname).toBe('https://api.geoapify.com/v2/places')
    expect(url.searchParams.get('filter')).toBe('circle:-74.081700,4.609700,7000')
    expect(url.searchParams.get('categories')).toBe('beach')
    expect(url.searchParams.get('limit')).toBe('500')
    expect(url.searchParams.get('apiKey')).toBe('clave')
  })
})

describe('classifyGeoapify', () => {
  it('reconoce subcategorías y devuelve el tipo general', () => {
    expect(classifyGeoapify(['catering', 'catering.restaurant', 'catering.restaurant.pizza'], CATEGORY_IDS)).toEqual({
      category: 'gastronomia',
      tagValue: 'restaurant',
    })
    expect(classifyGeoapify(['tourism', 'tourism.sights', 'tourism.sights.fort'], CATEGORY_IDS)?.category).toBe('cultura')
    expect(classifyGeoapify(['adult.nightclub'], CATEGORY_IDS)?.category).toBe('vidaNocturna')
  })

  it('no confunde prefijos parecidos ni categorías ajenas', () => {
    expect(classifyGeoapify(['beachfront'], CATEGORY_IDS)).toBeNull()
    expect(classifyGeoapify(['service.vehicle.fuel'], CATEGORY_IDS)).toBeNull()
  })

  it('todas las actividades de Locus tienen categorías de Geoapify', () => {
    for (const id of CATEGORY_IDS) expect(GEOAPIFY_CATEGORIES[id].length).toBeGreaterThan(0)
  })
})

describe('parseGeoapifyPlaces', () => {
  const response: GeoapifyResponse = {
    features: [
      feature('Castillo San Felipe de Barajas', ['tourism.sights.castle'], {
        datasource: { sourcename: 'openstreetmap', raw: { osm_type: 'w', osm_id: 123, wikidata: 'Q1', website: 'x' } },
      }),
      feature('Castillo San Felipe de Barajas', ['tourism.sights.castle']), // repetido por nombre
      feature(undefined, ['catering.restaurant']), // sin nombre
      feature('La Cevichería', ['catering.restaurant', 'catering.restaurant.seafood']),
    ],
  }

  it('convierte a lugares de Locus, sin repetidos ni lugares sin nombre', () => {
    const places = parseGeoapifyPlaces(response, ['cultura', 'gastronomia'])
    expect(places.map((p) => p.name)).toEqual(['Castillo San Felipe de Barajas', 'La Cevichería'])
    expect(places[0]).toMatchObject({ id: 'way/123', category: 'cultura', kind: 'Castillo', score: 5 })
    expect(places[1]).toMatchObject({ category: 'gastronomia', kind: 'Restaurante', score: 1 })
  })

  it('acepta nombres que llegan como número y descarta los vacíos', () => {
    const odd: GeoapifyResponse = {
      features: [
        { properties: { name: 7 as unknown as string, lat: 4.6, lon: -74.08, categories: ['catering.bar'], place_id: 'a' } },
        { properties: { name: null as unknown as string, lat: 4.6, lon: -74.08, categories: ['catering.bar'], place_id: 'b' } },
        { properties: { name: '   ', lat: 4.6, lon: -74.08, categories: ['catering.bar'], place_id: 'c' } },
      ],
    }
    expect(parseGeoapifyPlaces(odd, ['vidaNocturna']).map((p) => p.name)).toEqual(['7'])
  })

  it('solo incluye las actividades pedidas', () => {
    expect(parseGeoapifyPlaces(response, ['playa'])).toEqual([])
  })
})

describe('createGeoapifyClient', () => {
  it('cuenta actividades con una petición por actividad', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const categories = new URL(String(url)).searchParams.get('categories')!
      const features = categories.startsWith('beach') ? [] : [feature('Lugar A', categories.split(',')), feature('Lugar B', categories.split(','))]
      return new Response(JSON.stringify({ features }), { status: 200 })
    })
    const client = createGeoapifyClient({ apiKey: 'clave', fetchFn: fetchFn as typeof fetch })
    const counts = await client.countActivities({ lat: 4.6, lon: -74.08 }, 7000)
    expect(fetchFn).toHaveBeenCalledTimes(CATEGORY_IDS.length)
    expect(counts.playa).toBe(0)
    expect(counts.cultura).toBe(2)
  })

  it('un error HTTP se propaga (para que la app pruebe otra fuente o avise)', async () => {
    const client = createGeoapifyClient({
      apiKey: 'mala',
      fetchFn: (async () => new Response('{}', { status: 401 })) as typeof fetch,
    })
    await expect(client.findPlaces({ lat: 4.6, lon: -74.08 }, 7000, ['cultura'])).rejects.toMatchObject({ status: 401 })
  })
})
