import { describe, expect, it } from 'vitest'
import type { CategoryId, Itinerary, Place } from '../../../types/itinerary'
import { alternativeFor, dayParts, removeStop, replaceStop } from '../editItinerary'

const place = (id: string, category: CategoryId, lat = 10.42, lon = -75.55): Place => ({
  id,
  name: id,
  category,
  kind: 'x',
  score: 1,
  lat,
  lon,
})

const itinerary = (): Itinerary => ({
  input: { destination: 'Cartagena', startDate: '2026-12-01', endDate: '2026-12-02', budgetCOP: 1, categories: ['cultura'] },
  destination: { query: 'c', displayName: 'Cartagena, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 8000 },
  days: [
    {
      day: 1,
      date: '2026-12-01',
      places: [place('museo', 'cultura', 10.43), place('fuerte', 'cultura', 10.44)],
      distanceKm: 2.2,
      alternatives: [place('lejos', 'cultura', 10.6), place('cerca', 'cultura', 10.431), place('bar', 'vidaNocturna')],
    },
    {
      day: 2,
      date: '2026-12-02',
      places: [place('cerca-usado', 'cultura', 10.4305)],
      distanceKm: 1,
      alternatives: [place('cerca-usado', 'cultura', 10.4305)],
    },
  ],
  missingCategories: [],
  stats: { optimizedKm: 3.2, unoptimizedKm: 5, savingPercent: 36 },
  generatedAt: '2026-11-17T00:00:00.000Z',
})

describe('dayParts', () => {
  it('mitad en la mañana, el resto en la tarde y la vida nocturna en la noche', () => {
    expect(dayParts([place('a', 'cultura'), place('b', 'playa'), place('c', 'gastronomia'), place('d', 'vidaNocturna')])).toEqual([
      'mañana',
      'mañana',
      'tarde',
      'noche',
    ])
    expect(dayParts([place('a', 'cultura')])).toEqual(['mañana'])
  })
})

describe('editar el itinerario', () => {
  it('quitar una parada recalcula la distancia y marca el plan como editado', () => {
    const original = itinerary()
    const edited = removeStop(original, 0, 1)
    expect(edited.days[0].places.map((p) => p.id)).toEqual(['museo'])
    expect(edited.days[0].distanceKm).toBeLessThan(original.days[0].distanceKm)
    expect(edited.edited).toBe(true)
    expect(edited.stats.savingPercent).toBe(0) // el "ahorro" ya no aplica
    expect(original.days[0].places).toHaveLength(2) // no modifica el original
  })

  it('cambiar elige la alternativa más cercana de la misma actividad que no esté ya en el plan', () => {
    const it = itinerary()
    expect(alternativeFor(it, 0, 0)?.id).toBe('cerca')
    const changed = replaceStop(it, 0, 0)!
    expect(changed.days[0].places.map((p) => p.id)).toEqual(['cerca', 'fuerte'])
    // Ya usada en el día 2: no se ofrece.
    expect(alternativeFor(it, 1, 0)).toBeNull()
    expect(replaceStop(it, 1, 0)).toBeNull()
  })
})
