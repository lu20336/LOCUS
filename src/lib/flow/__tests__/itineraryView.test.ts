import { describe, expect, it } from 'vitest'
import { formatDayTab, formatDistance, googleMapsRouteUrl, legDistancesKm, osmPlaceUrl } from '../itineraryView'

const start = { lat: 10.42, lon: -75.55 }

describe('itineraryView', () => {
  it('distancia de cada tramo: la primera desde el centro', () => {
    const legs = legDistancesKm(start, [{ lat: 10.43, lon: -75.55 }, { lat: 10.43, lon: -75.54 }])
    expect(legs[0]).toBeCloseTo(1.11, 1)
    expect(legs[1]).toBeCloseTo(1.09, 1)
  })

  it('formatea metros y kilómetros', () => {
    expect(formatDistance(0.347)).toBe('350 m')
    expect(formatDistance(2.345)).toBe('2,3 km')
  })

  it('enlaza el lugar en OpenStreetMap', () => {
    expect(osmPlaceUrl({ id: 'node/123', lat: 1, lon: 2 })).toBe('https://www.openstreetmap.org/node/123')
    expect(osmPlaceUrl({ id: 'geoapify:abc', lat: 1, lon: 2 })).toContain('mlat=1&mlon=2')
  })

  it('ruta de Google Maps: centro → paradas en orden → última', () => {
    const url = new URL(googleMapsRouteUrl(start, [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }])!)
    expect(url.searchParams.get('origin')).toBe('10.420000,-75.550000')
    expect(url.searchParams.get('destination')).toBe('5.000000,6.000000')
    expect(url.searchParams.get('waypoints')).toBe('1.000000,2.000000|3.000000,4.000000')
    expect(googleMapsRouteUrl(start, [])).toBeNull()
  })

  it('pestaña del día con día de la semana', () => {
    expect(formatDayTab('2026-12-10')).toMatch(/^jue 10 dic$/)
  })
})
