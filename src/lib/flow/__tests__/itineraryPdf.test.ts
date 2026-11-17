import { describe, expect, it } from 'vitest'
import type { TripDetails } from '../../../types/flow'
import type { CategoryId, Itinerary, Place } from '../../../types/itinerary'
import { googleCalendarUrl } from '../exportItinerary'
import { buildItineraryPdf, pdfSafe } from '../itineraryPdf'
import { detectPlatform } from '../phoneCalendar'

const place = (name: string, category: CategoryId, i: number): Place => ({
  id: `${name}-${i}`,
  name,
  category,
  kind: 'Museo',
  score: 1,
  lat: 10.42 + i * 0.001,
  lon: -75.55,
})

const trip: TripDetails = {
  mode: 'known',
  destination: { query: 'c', displayName: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 8000 },
  startDate: '2026-12-10',
  endDate: '2026-12-13',
  budgetCOP: 2_500_000,
  travelers: 2,
  rooms: 1,
}

const plan = (stopsPerDay: number): Itinerary => ({
  input: { destination: 'Cartagena', startDate: '2026-12-10', endDate: '2026-12-13', budgetCOP: 1, categories: ['cultura'] },
  destination: trip.destination,
  days: ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'].map((date, d) => ({
    day: d + 1,
    date,
    distanceKm: 3,
    places: Array.from({ length: stopsPerDay }, (_, i) => place(i === 0 ? 'Museo del Oro' : `Lugar ${i}`, i === stopsPerDay - 1 ? 'vidaNocturna' : 'cultura', i)),
    ...(d === 1 ? { excursion: { id: 't', name: 'Turbaco', region: 'Bolívar', tagline: 'Jardín Botánico', lat: 10.33, lon: -75.41, distanceKm: 18, driveMinutes: 28 } } : {}),
  })),
  missingCategories: [],
  stats: { optimizedKm: 12, unoptimizedKm: 15, savingPercent: 20 },
  generatedAt: '2026-11-17T00:00:00.000Z',
})

describe('PDF del itinerario', () => {
  it('quita los caracteres que la fuente del PDF no tiene, pero conserva tildes y ñ', () => {
    expect(pdfSafe('Mañana: A → B ≈ 2 km')).toBe('Mañana: A › B ~ 2 km')
  })

  it('arma el PDF con el título, los días y las paradas', async () => {
    const doc = await buildItineraryPdf(plan(4), trip, new Date('2026-11-17T12:00:00Z'))
    const raw = doc.output()
    expect(raw.startsWith('%PDF-')).toBe(true)
    expect(raw).toContain('Tu plan en Cartagena de Indias')
    expect(raw).toContain('Excursi')
    expect(raw).toContain('Museo del Oro')
    expect(raw).toContain('Página 1 de')
  })

  it('pasa a otra página cuando el plan es largo, con número en cada una', async () => {
    const doc = await buildItineraryPdf(plan(9), trip)
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    expect(doc.output()).toContain(`Página ${doc.getNumberOfPages()} de ${doc.getNumberOfPages()}`)
  })
})

describe('calendario', () => {
  it('Google Calendar: un evento de todo el viaje con el plan en la descripción', () => {
    const url = new URL(googleCalendarUrl(plan(2)))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Viaje a Cartagena de Indias')
    expect(url.searchParams.get('dates')).toBe('20261210/20261214') // el fin es exclusivo
    expect(url.searchParams.get('details')).toContain('Día 2 · vie 11 dic · Excursión a Turbaco')
  })

  it('reconoce iPhone, iPad, Android y computador', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios') // iPad
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; SM-S918B)', 5)).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('desktop')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop')
  })
})
