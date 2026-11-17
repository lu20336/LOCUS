import { describe, expect, it } from 'vitest'
import { EXCURSION_MAX_KM, maxExcursions, nearbyTowns } from '../nearbyTowns'

const names = (point: { lat: number; lon: number; displayName?: string }) => nearbyTowns(point).map((t) => t.name)

describe('nearbyTowns', () => {
  it('cerca de Medellín propone pueblos turísticos, no municipios dormitorio', () => {
    const towns = names({ lat: 6.2442, lon: -75.5812, displayName: 'Medellín, Antioquia, Colombia' })
    expect(towns).toContain('Guatapé')
    expect(towns).toContain('Santa Fe de Antioquia')
    expect(towns).not.toContain('Bello')
  })

  it('cerca de Bogotá: Zipaquirá y Guatavita, ordenados del más cercano al más lejano', () => {
    const towns = nearbyTowns({ lat: 4.711, lon: -74.072, displayName: 'Bogotá, Colombia' })
    expect(towns.map((t) => t.name)).toEqual(expect.arrayContaining(['Zipaquirá', 'Guatavita']))
    const km = towns.map((t) => t.distanceKm)
    expect(km).toEqual([...km].sort((a, b) => a - b))
    expect(Math.max(...km)).toBeLessThanOrEqual(EXCURSION_MAX_KM)
  })

  it('nunca propone el propio destino', () => {
    expect(names({ lat: 6.6357, lon: -73.2234, displayName: 'Barichara, Santander, Colombia' })).not.toContain(
      'Barichara',
    )
    expect(names({ lat: 6.6357, lon: -73.2234, displayName: 'Barichara, Santander, Colombia' })).toContain('San Gil')
  })

  it('siempre deja al menos un día en el destino principal', () => {
    expect(maxExcursions(1)).toBe(0)
    expect(maxExcursions(4)).toBe(3)
  })
})
