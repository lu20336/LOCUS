import { describe, expect, it } from 'vitest'
import type { CategoryId, Itinerary, Place } from '../../../types/itinerary'
import { icsEscape, icsFileName, icsFold, itineraryToIcs, itineraryToText, stopsByPart } from '../exportItinerary'

const place = (name: string, category: CategoryId): Place => ({ id: name, name, category, kind: 'x', score: 1, lat: 10.42, lon: -75.55 })

const plan: Itinerary = {
  input: { destination: 'Cartagena', startDate: '2026-12-10', endDate: '2026-12-11', budgetCOP: 1, categories: ['cultura'] },
  destination: { query: 'c', displayName: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 8000 },
  days: [
    { day: 1, date: '2026-12-10', places: [place('Museo del Oro', 'cultura'), place('Bocagrande', 'playa'), place('Café Havana', 'vidaNocturna')], distanceKm: 3 },
    {
      day: 2,
      date: '2026-12-11',
      places: [place('Jardín Botánico', 'aventura')],
      distanceKm: 1,
      excursion: { id: 'turbaco', name: 'Turbaco', region: 'Bolívar', tagline: 'x', lat: 10.33, lon: -75.41, distanceKm: 18 },
    },
  ],
  missingCategories: [],
  stats: { optimizedKm: 3, unoptimizedKm: 4, savingPercent: 25 },
  generatedAt: '2026-11-17T00:00:00.000Z',
}

describe('exportar el itinerario', () => {
  it('agrupa las paradas por momento del día', () => {
    expect(stopsByPart(plan.days[0])).toEqual([
      ['Mañana', ['Museo del Oro']],
      ['Tarde', ['Bocagrande']],
      ['Noche', ['Café Havana']],
    ])
  })

  it('texto para compartir: título, días, excursión y enlace de la ruta', () => {
    const text = itineraryToText(plan)
    expect(text.split('\n')[0]).toBe('Mi viaje a Cartagena de Indias · 10–11 de dic de 2026 (2 días)')
    expect(text).toContain('Día 1 · jue 10 dic')
    expect(text).toContain('  Mañana: Museo del Oro')
    expect(text).toContain('Día 2 · vie 11 dic · Excursión a Turbaco')
    expect(text).toContain('Ruta: https://www.google.com/maps/dir/')
  })

  it('calendario: un evento de día completo por día, con texto escapado', () => {
    const ics = itineraryToIcs(plan, new Date('2026-11-17T12:00:00Z'))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261210')
    expect(ics).toContain('DTEND;VALUE=DATE:20261211')
    expect(ics).toContain('SUMMARY:Excursión a Turbaco')
    expect(ics).toContain('LOCATION:Cartagena de Indias\\, Bolívar\\, Colombia')
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })

  it('escapa y corta líneas como pide el estándar', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    const folded = icsFold('X'.repeat(160))
    expect(folded.split('\r\n').map((l) => l.length)).toEqual([60, 60, 42])
    expect(folded.replace(/\r\n /g, '')).toBe('X'.repeat(160))
  })

  it('nombre del archivo sin tildes ni espacios', () => {
    expect(icsFileName(plan)).toBe('viaje-cartagena-de-indias-2026-12-10.ics')
  })
})

describe('planes extra en el texto y el calendario', () => {
  it('salen dentro de su día, con el momento', async () => {
    const { itineraryToText, extraLines } = await import('../exportItinerary')
    const it = {
      input: { destination: 'x', startDate: '2026-12-10', endDate: '2026-12-11', budgetCOP: 1, categories: [] },
      destination: { query: 'x', displayName: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 1 },
      days: [
        { day: 1, date: '2026-12-10', distanceKm: 0, places: [] },
        { day: 2, date: '2026-12-11', distanceKm: 0, places: [] },
      ],
      missingCategories: [],
      stats: { optimizedKm: 0, unoptimizedKm: 0, savingPercent: 0 },
      generatedAt: 'x',
      budgetPlan: {
        lodging: 'estandar', food: 'estandar', transport: 'estandar', adjustments: [], fits: true,
        extras: [{ id: 'cena', title: 'Una cena especial', amount: 1, dayIndex: 1, part: 'noche' }],
      },
    } as const
    expect(extraLines(it as never, 1)).toEqual(['Plan extra (noche): Una cena especial'])
    const text = itineraryToText(it as never)
    const day2 = text.slice(text.indexOf('Día 2'))
    expect(day2).toContain('Plan extra (noche): Una cena especial')
    expect(day2).not.toContain('Día libre')
  })
})

describe('lugar del plan extra en el texto', () => {
  it('dice dónde es', async () => {
    const { extraLines } = await import('../exportItinerary')
    const it = {
      budgetPlan: {
        extras: [
          {
            id: 'cena',
            title: 'Una cena especial',
            amount: 1,
            dayIndex: 0,
            part: 'noche',
            venue: { id: 'node/1', name: 'Carmen', kind: 'Restaurante', role: 'Lugar', lat: 0, lon: 0 },
          },
        ],
      },
    }
    expect(extraLines(it as never, 0)).toEqual(['Plan extra (noche): Una cena especial · Lugar: Carmen'])
  })
})
