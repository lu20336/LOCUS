import { describe, expect, it } from 'vitest'
import type { DayPlan, Itinerary, Place } from '../../../types/itinerary'
import { formatCOP } from '../../format'
import {
  costLevelFor,
  dayEntries,
  ECONOMY_PRICES,
  estimateTripBudget,
  excursionFare,
  fitItineraryToBudget,
  minimumBudget,
  PRICES,
  stayFit,
} from '../tripBudget'

const place = (kind: string, i = 0): Place => ({
  id: `${kind}-${i}`,
  name: `${kind} ${i}`,
  category: 'cultura',
  kind,
  score: 1,
  lat: 10.42,
  lon: -75.55,
})

const day = (n: number, places: Place[], excursion?: DayPlan['excursion']): DayPlan => ({
  day: n,
  date: `2026-12-${String(9 + n).padStart(2, '0')}`,
  distanceKm: 2,
  places,
  ...(excursion ? { excursion } : {}),
})

const plan = (displayName: string, days: DayPlan[]): Pick<Itinerary, 'days' | 'destination'> => ({
  destination: { query: displayName, displayName, lat: 10.42, lon: -75.55, radiusMeters: 8000 },
  days,
})

const turbaco = { id: 't', name: 'Turbaco', region: 'Bolívar', tagline: '', lat: 10.33, lon: -75.41, distanceKm: 18 }

describe('presupuesto del viaje', () => {
  it('reconoce destinos costosos, ciudades y pueblos', () => {
    expect(costLevelFor('Cartagena de Indias, Bolívar, Colombia')).toBe('alto')
    expect(costLevelFor('San Andrés, Colombia')).toBe('alto')
    expect(costLevelFor('Medellín, Antioquia, Colombia')).toBe('medio')
    expect(costLevelFor('Villa de Leyva, Boyacá, Colombia')).toBe('medio')
    expect(costLevelFor('Mongua, Boyacá, Colombia')).toBe('economico')
  })

  it('suma alojamiento, comida, transporte y entradas con las cuentas a la vista', () => {
    // Medellín, 3 días (2 noches), 2 personas, 1 habitación, un museo (20.000) y un mirador (gratis).
    const estimate = estimateTripBudget(
      plan('Medellín, Antioquia, Colombia', [day(1, [place('Museo'), place('Mirador')]), day(2, []), day(3, [])]),
      { travelers: 2, rooms: 1, budgetCOP: 5_000_000 },
    )
    const p = PRICES.medio
    const byId = Object.fromEntries(estimate.lines.map((l) => [l.id, l.amount]))
    expect(estimate.nights).toBe(2)
    expect(byId.alojamiento).toBe(2 * p.roomNight)
    expect(byId.comida).toBe(3 * 2 * p.foodPerPersonDay)
    expect(byId.transporte).toBe(3 * 2 * p.transportPerPersonDay)
    expect(byId.entradas).toBe(2 * 20_000)
    expect(estimate.total).toBe(byId.alojamiento + byId.comida + byId.transporte + byId.entradas)
    expect(estimate.lines[0].detail).toBe(`2 noches × 1 habitación × ${formatCOP(200_000)}`)
    expect(estimate.status).toBe('holgado')
    expect(estimate.tips).toEqual([])
  })

  it('las excursiones cobran el bus ida y vuelta en vez del transporte de la ciudad', () => {
    // 40 km en línea recta ≈ 52 km de carretera, ida y vuelta, a $220/km → $22.880 ≈ $23.000.
    expect(excursionFare({ excursion: { ...turbaco, distanceKm: 40 } })).toBe(23_000)
    expect(excursionFare({ excursion: turbaco })).toBe(20_000) // pasaje mínimo
    const estimate = estimateTripBudget(
      plan('Cartagena de Indias, Bolívar, Colombia', [day(1, []), day(2, [], turbaco)]),
      { travelers: 1, rooms: 1, budgetCOP: 1_000_000 },
    )
    const transport = estimate.lines.find((l) => l.id === 'transporte')!
    expect(transport.amount).toBe(PRICES.alto.transportPerPersonDay + excursionFare({ excursion: turbaco }))
    expect(transport.detail).toContain('Turbaco')
  })

  it('si no alcanza, dice cuánto falta y da ideas con lo que se ahorraría', () => {
    const estimate = estimateTripBudget(
      plan('Cartagena de Indias, Bolívar, Colombia', [
        day(1, [place('Castillo'), place('Museo', 1)]),
        day(2, [place('Imperdible')], turbaco),
        day(3, [place('Discoteca')]),
      ]),
      { travelers: 2, rooms: 1, budgetCOP: 800_000 },
    )
    expect(estimate.status).toBe('falta')
    expect(estimate.difference).toBeLessThan(0)
    const texts = estimate.tips.map((t) => t.text)
    expect(texts).toContain('Quitar la excursión a Turbaco')
    expect(texts).toContain('Un día menos de viaje')
    expect(estimate.tips.find((t) => t.text === 'Un día menos de viaje')?.saves).toBeGreaterThan(0)
  })

  it('«justo» cuando sobra menos del 15 %', () => {
    const it1 = plan('Mongua, Boyacá, Colombia', [day(1, [])])
    const cost = estimateTripBudget(it1, { travelers: 1, rooms: 1, budgetCOP: 0 }).total
    expect(estimateTripBudget(it1, { travelers: 1, rooms: 1, budgetCOP: cost }).status).toBe('justo')
    expect(estimateTripBudget(it1, { travelers: 1, rooms: 1, budgetCOP: cost * 2 }).status).toBe('holgado')
    expect(estimateTripBudget(it1, { travelers: 1, rooms: 1, budgetCOP: cost - 1 }).status).toBe('falta')
  })

  it('la vida nocturna cuenta una vez por noche y las atracciones o plazas son gratis', () => {
    expect(dayEntries(day(1, [place('Bar'), place('Bar', 1), place('Pub', 2)]))).toBe(40_000)
    expect(dayEntries(day(1, [place('Bar'), place('Discoteca', 1), place('Museo', 2)]))).toBe(50_000 + 20_000)
    expect(dayEntries(day(1, [place('Atracción turística'), place('Plaza', 1), place('Playa', 2)]))).toBe(0)
  })

  it('lo que queda para alojamiento es el presupuesto menos comida, transporte y entradas', () => {
    const estimate = estimateTripBudget(plan('Medellín, Colombia', [day(1, []), day(2, [])]), {
      travelers: 1,
      rooms: 1,
      budgetCOP: 1_000_000,
    })
    const others = estimate.lines.filter((l) => l.id !== 'alojamiento').reduce((s, l) => s + l.amount, 0)
    expect(estimate.lodgingAllowance).toBe(1_000_000 - others)
  })
})

describe('alojamientos dentro del presupuesto', () => {
  const listing = {
    pricePerNight: 150_000,
    cleaningFee: 30_000,
    includedGuests: 2,
    extraGuestFee: 20_000,
    capacity: 4,
    minNights: 1,
    maxNights: 30,
  }
  const stay = { checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 3 }

  it('usa el precio real de la estadía (noches, limpieza y huésped extra)', () => {
    const total = 3 * 150_000 + 30_000 + 3 * 20_000
    expect(stayFit(listing, stay, total)).toEqual({ total, fits: true, over: 0 })
    expect(stayFit(listing, stay, total - 50_000)).toEqual({ total, fits: false, over: 50_000 })
  })
})

describe('el plan siempre cumple el presupuesto', () => {
  const free = (name: string, category: Place['category'] = 'cultura'): Place => ({ ...place('Plaza'), id: name, name, category })
  const full = (days: DayPlan[]): Itinerary => ({
    ...plan('Cartagena de Indias, Bolívar, Colombia', days),
    input: { destination: 'Cartagena', startDate: '2026-12-10', endDate: '2026-12-13', budgetCOP: 0, categories: ['cultura'] },
    missingCategories: [],
    stats: { optimizedKm: 5, unoptimizedKm: 6, savingPercent: 10 },
    generatedAt: '2026-11-17T00:00:00.000Z',
  })
  const trip = (budgetCOP: number) => ({ travelers: 2, rooms: 1, budgetCOP })
  const cost = (it: Itinerary, budgetCOP: number) => estimateTripBudget(it, trip(budgetCOP))

  const sample = () =>
    full([
      { ...day(1, [place('Castillo'), place('Museo', 1), { ...place('Bar', 2), category: 'vidaNocturna' }]), alternatives: [free('Plaza de Bolívar'), free('Muelle'), free('Parque del Centenario'), free('Camellón de los Mártires')] },
      { ...day(2, [place('Imperdible', 3), place('Playa', 4)], turbaco) },
      { ...day(3, [place('Museo', 5), free('Parque')]), alternatives: [free('Plaza Fernández de Madrid')] },
    ])

  it('si ya alcanza no cambia nada', () => {
    const result = fitItineraryToBudget(sample(), trip(20_000_000))
    expect(result.budgetPlan).toMatchObject({ lodging: 'estandar', food: 'estandar', adjustments: [], fits: true })
    expect(result.days).toEqual(sample().days)
  })

  it('primero baja el hospedaje, luego la comida y el transporte, y dice qué cambió', () => {
    const it0 = sample()
    const standard = cost(it0, 0).total
    const lodgingSaves = 2 * (PRICES.alto.roomNight - ECONOMY_PRICES.alto.roomNight)
    const result = fitItineraryToBudget(it0, trip(standard - lodgingSaves))
    expect(result.budgetPlan).toMatchObject({ lodging: 'economico', food: 'estandar', fits: true })
    expect(result.budgetPlan?.adjustments[0]).toContain('Hospedaje económico')
    expect(cost(result, standard - lodgingSaves).difference).toBeGreaterThanOrEqual(0)
  })

  it('después cambia paradas pagas por gratis (o las quita) y al final la excursión', () => {
    const it0 = sample()
    const economy = fitItineraryToBudget(it0, trip(1)) // lo más barato posible
    expect(economy.budgetPlan).toMatchObject({ lodging: 'economico', food: 'economico', transport: 'economico' })
    const texts = economy.budgetPlan!.adjustments.join(' | ')
    expect(texts).toContain('Cambiamos 3 paradas pagas por otras gratis: Castillo 0 por Plaza de Bolívar')
    expect(texts).not.toContain('Quitamos Castillo')
    expect(texts).toContain('Cambiamos la excursión a Turbaco')
    // Ningún día queda vacío y el día de excursión pasa a la ciudad.
    expect(economy.days.every((d) => d.places.length > 0)).toBe(true)
    expect(economy.days[1].excursion).toBeUndefined()
    // Con un presupuesto en el medio, se detiene apenas alcanza.
    const middle = fitItineraryToBudget(it0, trip(cost({ ...it0, budgetPlan: economy.budgetPlan }, 0).total + 60_000))
    expect(middle.budgetPlan?.fits).toBe(true)
    expect(middle.budgetPlan!.adjustments.length).toBeLessThan(economy.budgetPlan!.adjustments.length)
  })

  it('si ni así alcanza, lo marca para avisar', () => {
    expect(fitItineraryToBudget(sample(), trip(1)).budgetPlan?.fits).toBe(false)
  })

  it('el mínimo del Paso 1 es hospedaje económico, comida sencilla, bus y planes gratis', () => {
    const p = ECONOMY_PRICES.alto
    expect(minimumBudget('Cartagena de Indias, Bolívar, Colombia', { days: 4, travelers: 2, rooms: 1 })).toBe(
      3 * p.roomNight + 4 * 2 * (p.foodPerPersonDay + p.transportPerPersonDay),
    )
    // Con el mínimo el plan, sin entradas pagas, alcanza.
    const minimum = minimumBudget('Cartagena de Indias, Bolívar, Colombia', { days: 1, travelers: 1, rooms: 1 })
    const oneDay = full([{ ...day(1, [place('Museo')]), alternatives: [free('Plaza')] }])
    expect(fitItineraryToBudget(oneDay, { travelers: 1, rooms: 1, budgetCOP: minimum }).budgetPlan?.fits).toBe(true)
  })
})
