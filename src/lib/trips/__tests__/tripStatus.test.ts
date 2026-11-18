import { describe, expect, it } from 'vitest'
import { copyTitle, daysUntil, filterTrips, groupTrips, nextTrip, shareSummary, shiftedDates, tripDays, tripPlace, tripPlaces, tripStatus, type TripLike } from '../tripStatus'

const trip = (title: string, startDate: string, endDate: string, extra: Partial<TripLike> = {}): TripLike & { travelers: number } => ({
  title,
  startDate,
  endDate,
  destination: { displayName: 'Salento, Quindío, Colombia' },
  days: [{ places: [1, 2] }, { places: [3] }],
  updatedAt: null,
  travelers: 2,
  ...extra,
})

const TODAY = '2026-12-10'

describe('tripStatus', () => {
  it('antes, durante (incluye salida y regreso) y después', () => {
    expect(tripStatus({ startDate: '2026-12-11', endDate: '2026-12-13' }, TODAY)).toBe('upcoming')
    expect(tripStatus({ startDate: '2026-12-10', endDate: '2026-12-12' }, TODAY)).toBe('ongoing')
    expect(tripStatus({ startDate: '2026-12-08', endDate: '2026-12-10' }, TODAY)).toBe('ongoing')
    expect(tripStatus({ startDate: '2026-12-01', endDate: '2026-12-09' }, TODAY)).toBe('past')
  })
})

describe('medidas', () => {
  it('cuenta días (salida y regreso incluidos), lugares y días de espera', () => {
    const t = trip('x', '2026-12-12', '2026-12-14')
    expect(tripDays(t)).toBe(3)
    expect(tripPlaces(t)).toBe(3)
    expect(daysUntil('2026-12-12', TODAY)).toBe(2)
    expect(tripPlace(t)).toBe('Salento')
  })
})

describe('groupTrips / nextTrip', () => {
  const a = trip('A', '2026-12-20', '2026-12-22')
  const b = trip('B', '2026-12-11', '2026-12-12')
  const c = trip('C', '2026-11-01', '2026-11-03')
  const d = trip('D', '2026-10-01', '2026-10-03')

  it('separa próximos (el más cercano primero) y pasados (el más reciente primero)', () => {
    const g = groupTrips([a, c, b, d], TODAY)
    expect(g.upcoming.map((t) => t.title)).toEqual(['B', 'A'])
    expect(g.past.map((t) => t.title)).toEqual(['C', 'D'])
  })

  it('el próximo viaje es el más cercano que no ha terminado', () => {
    expect(nextTrip([a, b, c], TODAY)?.title).toBe('B')
    expect(nextTrip([c, d], TODAY)).toBeNull()
  })
})

describe('filterTrips', () => {
  it('busca por nombre o destino sin tildes ni mayúsculas', () => {
    const list = [
      trip('Viaje a Salento', '2026-12-20', '2026-12-22'),
      trip('Escapada Medellín', '2026-12-20', '2026-12-22', { destination: { displayName: 'Medellín, Antioquia, Colombia' } }),
    ]
    expect(filterTrips(list, 'medellin')).toHaveLength(1)
    expect(filterTrips(list, 'QUINDIO')).toHaveLength(1)
    expect(filterTrips(list, '  ')).toHaveLength(2)
    expect(filterTrips(list, 'zzz')).toHaveLength(0)
  })
})

describe('copias y compartir', () => {
  it('copyTitle no apila "(copia)"', () => {
    expect(copyTitle('Viaje a Salento')).toBe('Viaje a Salento (copia)')
    expect(copyTitle('Viaje a Salento (copia)')).toBe('Viaje a Salento (copia)')
    expect(copyTitle('x'.repeat(200)).length).toBeLessThanOrEqual(120)
  })

  it('shiftedDates conserva el número de noches', () => {
    expect(shiftedDates('2026-12-12', '2026-12-15', '2027-01-10')).toEqual({ startDate: '2027-01-10', endDate: '2027-01-13' })
  })

  it('shareSummary usa singular y plural', () => {
    const text = shareSummary(trip('Viaje a Salento', '2026-12-12', '2026-12-14'), (a, b) => `${a}→${b}`)
    expect(text).toContain('Viaje a Salento · 2026-12-12→2026-12-14')
    expect(text).toContain('3 días · 2 viajeros · 3 lugares')
    expect(text).toContain('Planeado con LOCUS')
    const one = { ...trip('x', '2026-12-12', '2026-12-12'), travelers: 1, days: [{ places: [1] }] }
    expect(shareSummary(one, () => 'r')).toContain('1 día · 1 viajero · 1 lugar')
  })
})
