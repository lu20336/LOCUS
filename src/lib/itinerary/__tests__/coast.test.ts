import { describe, expect, it } from 'vitest'
import { COAST_KM, isCoastal, kmToCoast, withoutInlandBeaches } from '../coast'

describe('coast', () => {
  it.each([
    ['Cartagena', 10.39, -75.51],
    ['Santa Marta', 11.24, -74.2],
    ['Riohacha', 11.54, -72.91],
    ['Tolú', 9.52, -75.58],
    ['Necoclí', 8.42, -76.78],
    ['Capurganá', 8.63, -77.35],
    ['Tumaco', 1.8, -78.78],
    ['Buenaventura', 3.88, -77.03],
    ['Nuquí', 5.71, -77.27],
    ['Bahía Solano', 6.22, -77.4],
    ['San Andrés', 12.58, -81.7],
    ['Providencia', 13.35, -81.37],
  ])('%s está junto al mar', (_name, lat, lon) => {
    expect(isCoastal({ lat, lon })).toBe(true)
  })

  it.each([
    ['Pasto', 1.21, -77.28],
    ['Cúcuta', 7.89, -72.5],
    ['Girón', 7.07, -73.17],
    ['Calamar', 10.25, -74.92],
    ['Montería', 8.75, -75.88],
    ['Medellín', 6.25, -75.56],
    ['Bogotá', 4.71, -74.07],
  ])('%s NO está junto al mar', (_name, lat, lon) => {
    expect(kmToCoast({ lat, lon })).toBeGreaterThan(COAST_KM)
  })

  it('quita la playa solo en el interior', () => {
    expect(withoutInlandBeaches({ lat: 1.21, lon: -77.28 }, { playa: 1, cultura: 7 })).toEqual({ playa: 0, cultura: 7 })
    expect(withoutInlandBeaches({ lat: 10.39, lon: -75.51 }, { playa: 9 })).toEqual({ playa: 9 })
  })
})
