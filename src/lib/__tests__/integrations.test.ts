import { describe, expect, it } from 'vitest'
import { availableListings, filterExperiences, filterListings, matchesPlace, EMPTY_LISTING_FILTERS } from '../catalog/search'
import { buildLodgingQuery, parseLodging, safeUrl } from '../catalog/osmLodging'
import { findAirport, flightLinks, nearestAirports } from '../flights/airports'
import { fitDimensions, validateImageFile } from '../images/compress'
import { CATEGORY_PHRASES, bboxAround, parseLodging as parseNominatimLodging, parsePlaces as parseNominatimPlaces } from '../itinerary/nominatimPlaces'
import type { NominatimSearchResult } from '../itinerary/osmClient'
import { movePlace, removePlace, setDayNote } from '../itinerary/itineraryStore'
import { parseWikiSummary } from '../places/wikipedia'
import { describeWeatherCode, forecastUrl, parseForecast, rainRisk } from '../weather/openMeteo'
import type { Experience, Listing } from '../domain/types'
import type { OverpassResponse } from '../itinerary/osm'
import type { DayPlan, Place } from '../../types/itinerary'

const L = (over: Partial<Listing>): Listing =>
  ({ id: 'a', title: 'Cabaña', municipality: 'Salento', department: 'Quindío', capacity: 4, pricePerNight: 200000, type: 'cabana', amenities: ['wifi'], ...over }) as Listing

describe('búsqueda en el catálogo', () => {
  it('encuentra por municipio sin importar tildes ni mayúsculas', () => {
    expect(matchesPlace('QUINDIO', L({}))).toBe(true)
    expect(matchesPlace('salento', L({}))).toBe(true)
    expect(matchesPlace('cartagena', L({}))).toBe(false)
    expect(matchesPlace('', L({}))).toBe(true)
  })
  it('filtra por huéspedes, precio, tipo y comodidades', () => {
    const list = [L({ id: '1' }), L({ id: '2', capacity: 2, pricePerNight: 90000, type: 'habitacion', amenities: [] })]
    const f = { ...EMPTY_LISTING_FILTERS }
    expect(filterListings(list, { ...f, guests: 3 }).map((l) => l.id)).toEqual(['1'])
    expect(filterListings(list, { ...f, maxPrice: 100000 }).map((l) => l.id)).toEqual(['2'])
    expect(filterListings(list, { ...f, types: ['habitacion'] }).map((l) => l.id)).toEqual(['2'])
    expect(filterListings(list, { ...f, amenities: ['wifi'] }).map((l) => l.id)).toEqual(['1'])
  })
  it('quita los alojamientos sin disponibilidad en las fechas', () => {
    const list = [L({ id: '1' }), L({ id: '2' })]
    const cals = { '1': { booked: { '2026-12-10': 'booking' }, hostBlocked: {} }, '2': { booked: {}, hostBlocked: {} } }
    expect(availableListings(list, cals, '2026-12-09', '2026-12-11').map((l) => l.id)).toEqual(['2'])
  })
  it('filtra experiencias', () => {
    const e = { municipality: 'Salento', department: 'Quindío', title: 'Tour', category: 'caminata', pricePerPerson: 80000 } as Experience
    expect(filterExperiences([e], { text: 'salento', categories: ['caminata'], maxPrice: 100000 })).toHaveLength(1)
    expect(filterExperiences([e], { text: '', categories: ['tour'], maxPrice: null })).toHaveLength(0)
  })
})

describe('alojamientos de referencia (OpenStreetMap)', () => {
  const response: OverpassResponse = {
    elements: [
      { type: 'node', id: 1, lat: 4.63, lon: -75.57, tags: { name: 'Hotel Café', tourism: 'hotel', website: 'hotelcafe.co', phone: '+57 1' } },
      { type: 'way', id: 2, center: { lat: 4.64, lon: -75.58 }, tags: { name: 'Hostal Palma', tourism: 'hostel', website: 'javascript:alert(1)' } },
      { type: 'node', id: 3, lat: 4.6, lon: -75.5, tags: { tourism: 'hotel' } },
      { type: 'node', id: 4, lat: 4.6, lon: -75.5, tags: { name: 'Museo', tourism: 'museum' } },
      { type: 'node', id: 5, lat: 4.63, lon: -75.57, tags: { name: 'Hotel Café', tourism: 'hotel' } },
    ],
  }
  it('conserva solo alojamientos con nombre y quita duplicados', () => {
    const places = parseLodging(response)
    expect(places.map((p) => p.name)).toEqual(['Hotel Café', 'Hostal Palma'])
    expect(places[0].kind).toBe('Hotel')
  })
  it('nunca deja pasar enlaces peligrosos', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('hotelcafe.co')).toBe('https://hotelcafe.co/')
    expect(parseLodging(response)[1].website).toBeUndefined()
  })
  it('construye una consulta Overpass acotada', () => {
    const q = buildLodgingQuery(4.6, -75.5, 8000, 20)
    expect(q).toContain('around:8000')
    expect(q).toContain('out center 20')
  })
})

describe('clima (Open-Meteo)', () => {
  it('traduce códigos WMO', () => {
    expect(describeWeatherCode(0)).toBe('Despejado')
    expect(describeWeatherCode(63)).toBe('Lluvia')
    expect(describeWeatherCode(95)).toBe('Tormenta eléctrica')
  })
  it('interpreta la respuesta y distingue ahora de pronóstico', () => {
    const f = parseForecast(4.6, -75.5, {
      elevation: 1900,
      current: { temperature_2m: 18, relative_humidity_2m: 80, apparent_temperature: 17, precipitation: 0, weather_code: 3 },
      daily: { time: ['2026-12-01'], weather_code: [61], temperature_2m_max: [22], temperature_2m_min: [12], apparent_temperature_max: [21], precipitation_sum: [8], precipitation_probability_max: [75] },
    })
    expect(f.current?.description).toBe('Nublado')
    expect(f.daily[0].description).toBe('Lluvia')
    expect(rainRisk(f.daily[0])).toBe('alto')
  })
  it('el riesgo de lluvia se gradúa', () => {
    expect(rainRisk({ precipitationMm: 0, precipitationProbability: 10 })).toBe('bajo')
    expect(rainRisk({ precipitationMm: 4, precipitationProbability: 20 })).toBe('medio')
  })
  it('limita los días de pronóstico a 16', () => {
    expect(forecastUrl(4.6, -75.5, 99)).toContain('forecast_days=16')
  })
})

describe('vuelos (solo descubrimiento)', () => {
  it('encuentra aeropuertos por código o ciudad', () => {
    expect(findAirport('ctg')?.iata).toBe('CTG')
    expect(findAirport('Cartagena')?.iata).toBe('CTG')
    expect(findAirport('San Andrés')?.iata).toBe('ADZ')
    expect(findAirport('Narnia')).toBeNull()
  })
  it('sugiere los aeropuertos más cercanos a Salento (Pereira y Armenia)', () => {
    expect(nearestAirports({ lat: 4.637, lon: -75.57 }, 2).map((a) => a.iata).sort()).toEqual(['AXM', 'PEI'])
  })
  it('arma enlaces de búsqueda sin precios', () => {
    const links = flightLinks('BOG', 'CTG', '2026-12-10', '2026-12-15', 2)
    expect(links.map((l) => l.provider)).toEqual(['Google Flights', 'Skyscanner'])
    expect(links[1].url).toContain('/bog/ctg/261210/261215/')
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true)
  })
})

describe('fotos', () => {
  it('escala sin agrandar', () => {
    expect(fitDimensions(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
    expect(fitDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
  it('valida formato y tamaño', () => {
    expect(validateImageFile({ type: 'image/gif', size: 100 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImageFile({ type: 'image/png', size: 20 * 1024 * 1024 })).toMatch(/12 MB/)
    expect(validateImageFile({ type: 'image/jpeg', size: 5000 })).toBeNull()
    expect(validateImageFile({ type: 'application/pdf', size: 5000 })).not.toBeNull()
  })
})

describe('edición de itinerarios guardados', () => {
  const p = (id: string): Place => ({ id, name: id, lat: 0, lon: 0, category: 'cultura', kind: 'Museo', score: 1 })
  const base = {
    days: [
      { day: 1, date: '2026-12-01', distanceKm: 1, places: [p('a'), p('b'), p('c')] },
      { day: 2, date: '2026-12-02', distanceKm: 1, places: [p('d')] },
    ] as DayPlan[],
  }
  it('quita un lugar sin tocar los demás', () => {
    expect(removePlace(base, 0, 1).days[0].places.map((x) => x.id)).toEqual(['a', 'c'])
    expect(base.days[0].places).toHaveLength(3)
  })
  it('mueve dentro del día y entre días', () => {
    expect(movePlace(base, { day: 0, place: 0 }, { day: 0, place: 2 }).days[0].places.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    const moved = movePlace(base, { day: 0, place: 1 }, { day: 1 })
    expect(moved.days[0].places.map((x) => x.id)).toEqual(['a', 'c'])
    expect(moved.days[1].places.map((x) => x.id)).toEqual(['d', 'b'])
  })
  it('ignora movimientos inválidos y limita las notas', () => {
    expect(movePlace(base, { day: 5, place: 0 }, { day: 0 })).toBe(base)
    expect((setDayNote(base, 0, 'x'.repeat(900)).days[0] as { note?: string }).note).toHaveLength(500)
  })
})

describe('Wikipedia', () => {
  it('lee un resumen válido y exige HTTPS', () => {
    const s = parseWikiSummary({ type: 'standard', title: 'Salento', extract: 'Es un municipio…', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Salento' } } })
    expect(s?.title).toBe('Salento')
    expect(parseWikiSummary({ type: 'disambiguation', title: 'x', extract: 'y' })).toBeNull()
    expect(parseWikiSummary({ type: 'standard', title: 'x', extract: 'y', content_urls: { desktop: { page: 'http://evil.test' } } })).toBeNull()
  })
})

describe('respaldo con Nominatim (alojamientos y lugares)', () => {
  const r = (over: Partial<NominatimSearchResult>): NominatimSearchResult => ({
    osm_type: 'node', osm_id: 1, lat: '4.63', lon: '-75.57', name: 'Lugar', display_name: 'Lugar, Salento', category: 'tourism', type: 'hotel', extratags: null, ...over,
  })

  it('convierte hoteles en alojamientos de referencia y descarta lo que no es alojamiento', () => {
    const out = parseNominatimLodging([
      r({ osm_id: 1, name: 'Hotel Café', extratags: { website: 'hotelcafe.co' } }),
      r({ osm_id: 2, name: 'Hostal Palma', type: 'hostel', extratags: { phone: '+57 1' } }),
      r({ osm_id: 3, name: 'Sin datos', lat: '4.64' }),
      r({ osm_id: 4, name: 'Museo', type: 'museum' }),
      r({ osm_id: 5, name: 'Hotel Café', extratags: null }), // duplicado (mismo nombre y lugar)
      r({ osm_id: 6, name: 'Hotel Malo', lat: '4.65', extratags: { website: 'javascript:alert(1)' } }),
    ])
    expect(out.map((p) => p.name)).toEqual(['Hotel Café', 'Hostal Palma', 'Sin datos', 'Hotel Malo'])
    expect(out[0].website).toBe('https://hotelcafe.co/')
    expect(out[3].website).toBeUndefined()
    expect(out.every((p) => p.source === 'osm')).toBe(true)
  })

  it('ordena primero los que tienen contacto y luego los más cercanos', () => {
    const out = parseNominatimLodging(
      [r({ osm_id: 1, name: 'Lejos', lat: '4.9' }), r({ osm_id: 2, name: 'Cerca', lat: '4.631' }), r({ osm_id: 3, name: 'Con web', lat: '4.8', extratags: { website: 'https://a.co' } })],
      { lat: 4.63, lon: -75.57 },
    )
    expect(out.map((p) => p.name)).toEqual(['Con web', 'Cerca', 'Lejos'])
  })

  it('clasifica lugares con las mismas reglas del motor y descarta memoriales', () => {
    const places = parseNominatimPlaces(
      [
        r({ osm_id: 10, name: 'Museo del Oro', category: 'tourism', type: 'museum', extratags: { wikidata: 'Q1', website: 'x.co' } }),
        r({ osm_id: 11, name: 'Memorial', category: 'historic', type: 'memorial' }),
        r({ osm_id: 12, name: 'Fuerte', category: 'historic', type: 'fort' }),
        r({ osm_id: 13, name: 'Bar X', category: 'amenity', type: 'bar' }),
      ],
      ['cultura'],
    )
    expect(places.map((p) => p.name)).toEqual(['Museo del Oro', 'Fuerte'])
    expect(places[0].score).toBe(5) // 1 + wikidata(3) + website(1)
    expect(places[0].kind).toBe('Museo')
    expect(places[0].id).toBe('node/10')
  })

  it('el rectángulo de búsqueda cubre el radio pedido', () => {
    const box = bboxAround({ lat: 4.6, lon: -75.5 }, 8000)
    expect(box.north - box.south).toBeCloseTo(2 * (8000 / 111_320), 4)
    expect(box.west).toBeLessThan(-75.5)
    expect(box.east).toBeGreaterThan(-75.5)
  })

  it('cada categoría tiene al menos una frase de búsqueda', () => {
    for (const phrases of Object.values(CATEGORY_PHRASES)) expect(phrases.length).toBeGreaterThan(0)
  })
})
