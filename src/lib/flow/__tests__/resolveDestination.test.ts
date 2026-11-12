import { describe, expect, it, vi } from 'vitest'
import type { Destination } from '../../../types/itinerary'
import { ItineraryError } from '../../itinerary/errors'
import type { TownCandidate } from '../../itinerary/suggestDestination'
import {
  findFeaturedDestination,
  findTownDestination,
  normalizePlaceName,
  resolveDestination,
} from '../resolveDestination'

const towns: TownCandidate[] = [
  { id: 'node/1', name: 'Rionegro', lat: 6.15, lon: -75.37, place: 'city', elevation: 2125, popularity: 9 },
  { id: 'node/2', name: 'Rionegro', lat: 7.37, lon: -73.15, place: 'town', elevation: 500, popularity: 5 },
  { id: 'node/3', name: 'Jardín', lat: 5.6, lon: -75.82, place: 'town', elevation: 1750, popularity: 4 },
]

const online: Destination = { query: 'Pasto', displayName: 'Pasto, Nariño, Colombia', lat: 1.2, lon: -77.28, radiusMeters: 6000 }

describe('normalizePlaceName', () => {
  it('quita tildes, mayúsculas, puntuación y la palabra Colombia', () => {
    expect(normalizePlaceName('  Bogotá, Colombia ')).toBe('bogota')
    expect(normalizePlaceName('Salento, Quindío')).toBe('salento quindio')
  })
})

describe('findFeaturedDestination', () => {
  it('reconoce un destino destacado escrito de varias formas', () => {
    for (const text of ['Salento', 'salento', 'Salento, Quindío', 'SALENTO, COLOMBIA']) {
      const d = findFeaturedDestination(text)
      expect(d?.displayName).toBe('Salento, Quindío, Colombia')
      expect(d?.query).toBe(text.trim())
    }
    expect(findFeaturedDestination('Medellin')?.displayName).toBe('Medellín, Antioquia, Colombia')
  })

  it('no inventa coincidencias', () => {
    expect(findFeaturedDestination('Pasto')).toBeNull()
  })
})

describe('findTownDestination', () => {
  it('usa el pueblo más popular cuando hay nombres repetidos', () => {
    expect(findTownDestination('rionegro', towns)).toMatchObject({ lat: 6.15, radiusMeters: 8000 })
    expect(findTownDestination('Jardin, Antioquia', towns)).toMatchObject({ displayName: 'Jardín, Colombia', radiusMeters: 5000 })
    expect(findTownDestination('Narnia', towns)).toBeNull()
  })
})

describe('resolveDestination', () => {
  it('un destino destacado no consulta Nominatim', async () => {
    const geocode = vi.fn()
    const d = await resolveDestination('Cartagena', { geocode, loadTowns: async () => towns })
    expect(d.displayName).toBe('Cartagena de Indias, Bolívar, Colombia')
    expect(geocode).not.toHaveBeenCalled()
  })

  it('usa Nominatim cuando responde', async () => {
    const d = await resolveDestination('Pasto', { geocode: async () => online, loadTowns: async () => towns })
    expect(d).toBe(online)
  })

  it('si Nominatim está caído, usa la lista local de pueblos', async () => {
    const geocode = async () => {
      throw new ItineraryError('SERVICE_UNAVAILABLE', 'caído')
    }
    const d = await resolveDestination('Jardín', { geocode, loadTowns: async () => towns })
    expect(d).toMatchObject({ displayName: 'Jardín, Colombia', lat: 5.6 })
  })

  it('si Nominatim está caído y el pueblo no está en la lista, propaga el error del servicio', async () => {
    const failure = new ItineraryError('RATE_LIMITED', 'límite')
    await expect(
      resolveDestination('Narnia', {
        geocode: async () => {
          throw failure
        },
        loadTowns: async () => towns,
      }),
    ).rejects.toBe(failure)
  })

  it('"no encontrado" no se tapa con la lista local', async () => {
    const notFound = new ItineraryError('DESTINATION_NOT_FOUND', 'no existe')
    await expect(
      resolveDestination('Jardín', {
        geocode: async () => {
          throw notFound
        },
        loadTowns: async () => towns,
      }),
    ).rejects.toBe(notFound)
  })
})
