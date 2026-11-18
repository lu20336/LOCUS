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
  daysForExtra,
  extrasForDay,
  moveExtra,
  pickVenue,
  removeExtra,
  spareSuggestions,
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

describe('"Sugerir planes con lo que me sobra"', () => {
  const free = (name: string): Place => ({ ...place('Plaza'), id: name, name })
  const bar = (name: string): Place => ({ ...place('Bar'), id: name, name, category: 'vidaNocturna' })
  const full = (days: DayPlan[]): Itinerary => ({
    ...plan('Medellín, Antioquia, Colombia', days),
    input: { destination: 'Medellín', startDate: '2026-12-10', endDate: '2026-12-12', budgetCOP: 0, categories: ['cultura'] },
    missingCategories: [],
    stats: { optimizedKm: 5, unoptimizedKm: 6, savingPercent: 10 },
    generatedAt: '2026-11-17T00:00:00.000Z',
  })
  const museo = { ...place('Museo', 9), id: 'museo-antioquia', name: 'Museo de Antioquia', score: 9 }
  const parque = { ...place('Parque temático', 8), id: 'parque-explora', name: 'Parque Explora', score: 5 }
  const sample = () =>
    full([
      { ...day(1, [free('Plaza Botero'), bar('Bar A')]), alternatives: [museo, parque, bar('Bar B'), free('Plaza Cisneros')] },
      { ...day(2, [free('Pueblito Paisa')]), alternatives: [museo] },
    ])
  const trip = (budgetCOP: number) => ({ travelers: 2, rooms: 1, budgetCOP })

  it('ofrece paradas pagas que no entraron, con lo que sube el viaje, y todas caben', () => {
    const it0 = sample()
    const spare = trip(estimateTripBudget(it0, trip(0)).total + 300_000)
    const options = spareSuggestions(it0, spare)
    const byTitle = Object.fromEntries(options.map((o) => [o.title, o]))
    expect(byTitle['Museo de Antioquia'].cost).toBe(2 * 20_000)
    expect(byTitle['Parque Explora'].cost).toBe(2 * 120_000)
    // Un segundo bar la misma noche no sube el gasto: no se ofrece como plan.
    expect(byTitle['Bar B']).toBeUndefined()
    // Gratis no se ofrece (ya se podría agregar sin plata).
    expect(byTitle['Plaza Cisneros']).toBeUndefined()
    // El museo se ofrece una vez, en el día con menos paradas.
    expect(options.filter((o) => o.title === 'Museo de Antioquia')).toHaveLength(1)
    expect(byTitle['Museo de Antioquia'].detail).toContain('Día 2')
    // Agregarlo deja el plan dentro del presupuesto.
    expect(estimateTripBudget(byTitle['Museo de Antioquia'].result, spare).difference).toBeGreaterThanOrEqual(0)
    expect(byTitle['Museo de Antioquia'].result.days[1].places.map((p) => p.name)).toContain('Museo de Antioquia')
    // Los más valorados primero.
    expect(options.map((o) => o.title).indexOf('Museo de Antioquia')).toBeLessThan(
      options.map((o) => o.title).indexOf('Parque Explora'),
    )
  })

  it('no ofrece lo que no cabe, ni nada si no sobra', () => {
    const it0 = sample()
    const base = estimateTripBudget(it0, trip(0)).total
    const titles = spareSuggestions(it0, trip(base + 100_000)).map((o) => o.title)
    expect(titles).toContain('Museo de Antioquia')
    expect(titles).not.toContain('Parque Explora') // $240.000: no cabe en $100.000
    expect(titles).not.toContain('Una cena especial') // $300.000 para dos
    // Lugares reales antes que los planes típicos.
    expect(titles[0]).toBe('Museo de Antioquia')
    expect(spareSuggestions(it0, trip(base))).toEqual([])
  })

  it('si el ajuste bajó el hospedaje, ofrece volver a hotel y quita el aviso del ajuste', () => {
    const fitted = fitItineraryToBudget(sample(), trip(600_000))
    expect(fitted.budgetPlan?.lodging).toBe('economico')
    const hotel = spareSuggestions(fitted, trip(600_000)).find((o) => o.type === 'mejora')
    expect(hotel?.title).toBe('Hotel en vez de hostal')
    expect(hotel?.result.budgetPlan?.lodging).toBe('estandar')
    expect(hotel?.result.budgetPlan?.adjustments.some((a) => a.startsWith('Hospedaje'))).toBe(false)
  })
})

describe('planes típicos con lo que sobra', () => {
  const it0 = (displayName: string, lat = 6.25, lon = -75.57): Itinerary => ({
    destination: { query: displayName, displayName, lat, lon, radiusMeters: 8000 },
    days: [day(1, [place('Plaza')]), day(2, [place('Plaza', 1)])],
    input: { destination: displayName, startDate: '2026-12-10', endDate: '2026-12-11', budgetCOP: 0, categories: ['cultura'] },
    missingCategories: [],
    stats: { optimizedKm: 1, unoptimizedKm: 1, savingPercent: 0 },
    generatedAt: '2026-11-17T00:00:00.000Z',
  })
  const trip = { travelers: 2, rooms: 1, budgetCOP: 5_000_000 }

  it('ofrece planes según el destino: lancha en la costa, finca cafetera en el Eje', () => {
    const titles = (it: Itinerary) => spareSuggestions(it, trip).map((o) => o.title)
    expect(titles(it0('Cartagena de Indias, Bolívar, Colombia', 10.42, -75.55))).toContain('Paseo en lancha a las islas o playas cercanas')
    expect(titles(it0('Medellín, Antioquia, Colombia'))).not.toContain('Paseo en lancha a las islas o playas cercanas')
    expect(titles(it0('Salento, Quindío, Colombia', 4.64, -75.57))).toContain('Tour en una finca cafetera')
  })

  it('al agregarlo suma una línea "Planes extra" y se puede quitar', () => {
    const tour = spareSuggestions(it0('Medellín, Antioquia, Colombia'), trip).find((o) => o.title === 'Tour guiado a pie')!
    expect(tour.cost).toBe(2 * 60_000)
    const extraLine = estimateTripBudget(tour.result, trip).lines.find((l) => l.id === 'extras')
    expect(extraLine).toMatchObject({ amount: 120_000, detail: 'Tour guiado a pie' })
    // Ya agregado: no se vuelve a ofrecer.
    expect(spareSuggestions(tour.result, trip).some((o) => o.title === 'Tour guiado a pie')).toBe(false)
    const back = removeExtra(tour.result, 'tour-guiado')
    expect(estimateTripBudget(back, trip).lines.some((l) => l.id === 'extras')).toBe(false)
  })
})

describe('los planes extra van dentro del itinerario', () => {
  const cartagena = (): Itinerary => ({
    destination: { query: 'c', displayName: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 8000 },
    days: [
      day(1, [place('Plaza'), place('Museo', 1), place('Plaza', 2)]),
      day(2, [place('Plaza', 3)], turbaco),
      day(3, [place('Plaza', 4)]),
    ],
    input: { destination: 'c', startDate: '2026-12-10', endDate: '2026-12-12', budgetCOP: 0, categories: ['cultura'] },
    missingCategories: [],
    stats: { optimizedKm: 1, unoptimizedKm: 1, savingPercent: 0 },
    generatedAt: '2026-11-17T00:00:00.000Z',
  })
  const trip = { travelers: 2, rooms: 1, budgetCOP: 9_000_000 }
  const add = (it: Itinerary, title: string) => spareSuggestions(it, trip, 50).find((o) => o.title === title)!

  it('cada plan va en un día y momento lógicos, y el detalle lo dice', () => {
    const it0 = cartagena()
    const tour = add(it0, 'Tour guiado a pie')
    // Mañana: no en el día de excursión, y en el día con menos paradas (Día 3).
    expect(tour.result.budgetPlan?.extras?.[0]).toMatchObject({ dayIndex: 2, part: 'mañana' })
    expect(tour.detail).toContain('Día 3, en la mañana')
    // La noche sí puede ir en el día de excursión (el de menos paradas).
    const cena = add(it0, 'Una cena especial')
    expect(cena.result.budgetPlan?.extras?.[0]).toMatchObject({ part: 'noche' })
    expect(daysForExtra(it0, 'noche')).toEqual([0, 1, 2])
    expect(daysForExtra(it0, 'mañana')).toEqual([0, 2])
  })

  it('un plan de todo el día aparta las paradas de ese día y las devuelve al quitarlo o moverlo', () => {
    const it0 = cartagena()
    const lancha = add(it0, 'Paseo en lancha a las islas o playas cercanas').result
    const extra = lancha.budgetPlan!.extras![0]
    expect(extra).toMatchObject({ dayIndex: 2, part: 'todo el día' })
    expect(lancha.days[2].places).toEqual([])
    expect(extra.replaced?.map((p) => p.name)).toEqual(['Plaza 4'])
    expect(extrasForDay(lancha, 2).map((e) => e.title)).toEqual(['Paseo en lancha a las islas o playas cercanas'])
    // Otro plan de mañana ya no puede ir en ese día, ni un museo.
    expect(daysForExtra(lancha, 'mañana')).toEqual([0])
    const withMuseum: Itinerary = {
      ...lancha,
      days: lancha.days.map((d, i) => (i === 2 ? { ...d, alternatives: [{ ...place('Museo', 7), name: 'Museo Naval' }] } : d)),
    }
    expect(spareSuggestions(withMuseum, trip, 50).some((o) => o.title === 'Museo Naval')).toBe(false)

    const moved = moveExtra(lancha, extra.id, 0)
    expect(moved.days[2].places.map((p) => p.name)).toEqual(['Plaza 4'])
    expect(moved.days[0].places).toEqual([])
    expect(moved.budgetPlan!.extras![0].replaced?.map((p) => p.name)).toEqual(['Plaza 0', 'Museo 1', 'Plaza 2'])

    const back = removeExtra(moved, extra.id)
    expect(back.days.map((d) => d.places.length)).toEqual([3, 1, 1])
    expect(back.budgetPlan?.extras).toEqual([])
  })

  it('"Ajustar a mi presupuesto" quita los planes extra y devuelve las paradas', () => {
    const lancha = add(cartagena(), 'Paseo en lancha a las islas o playas cercanas').result
    const fitted = fitItineraryToBudget(lancha, trip)
    expect(fitted.budgetPlan?.extras ?? []).toEqual([])
    expect(fitted.days[2].places.map((p) => p.name)).toEqual(['Plaza 4'])
  })
})

describe('cada plan extra con su lugar real', () => {
  const at = (name: string, kind: string, category: Place['category'], score = 1, i = 0): Place => ({
    id: `node/${name.length}${i}${score}`,
    name,
    kind,
    category,
    score,
    lat: 10.42 + i * 0.01,
    lon: -75.55,
  })
  const it0 = (): Itinerary => ({
    destination: { query: 'c', displayName: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.42, lon: -75.55, radiusMeters: 8000 },
    days: [day(1, [at('Plaza de la Aduana', 'Monumento', 'cultura', 5)]), day(2, [at('Museo del Oro', 'Museo', 'cultura')])],
    input: { destination: 'c', startDate: '2026-12-10', endDate: '2026-12-11', budgetCOP: 0, categories: ['cultura'] },
    missingCategories: [],
    stats: { optimizedKm: 1, unoptimizedKm: 1, savingPercent: 0 },
    generatedAt: '2026-11-17T00:00:00.000Z',
  })
  const pool: Place[] = [
    at('Café del Mar', 'Bar', 'vidaNocturna', 3),
    at('Café Havana Salsa', 'Bar', 'vidaNocturna', 1),
    at('La Cevichería', 'Restaurante', 'gastronomia', 4),
    at('Carmen', 'Restaurante', 'gastronomia', 6),
    at('Juan Valdez', 'Café', 'gastronomia', 9),
    at('Plaza de Bolívar', 'Monumento', 'cultura', 2),
    at('Muelle de los Pegasos', 'Atracción turística', 'cultura', 2),
    at('Plaza de la Aduana', 'Monumento', 'cultura', 5), // ya es parada del plan
  ]

  it('elige un lugar que sirva para cada plan, el mejor valorado o el que mejor encaja', () => {
    expect(pickVenue('cena-especial', it0(), pool)).toMatchObject({ name: 'Carmen', role: 'Lugar' }) // restaurante, no café
    expect(pickVenue('clase-baile', it0(), pool)?.name).toBe('Café Havana Salsa') // prefiere salsa aunque valga menos
    expect(pickVenue('tour-guiado', it0(), pool)).toMatchObject({ name: 'Plaza de Bolívar', role: 'Punto de encuentro' })
    expect(pickVenue('lancha-islas', it0(), pool)).toMatchObject({ name: 'Muelle de los Pegasos', role: 'Sale de' })
  })

  it('no inventa: sin un lugar que sirva, el plan queda sin lugar', () => {
    expect(pickVenue('spa', it0(), pool)).toBeNull()
    expect(pickVenue('finca-cafetera', it0(), pool)).toBeNull()
    // El desembarcadero de la isla no sirve como salida de la lancha.
    expect(pickVenue('lancha-islas', it0(), [at('Desembarcadero Tierra Bomba', 'Playa', 'playa')])).toBeNull()
  })

  it('la sugerencia y el plan agregado traen el lugar', () => {
    const trip = { travelers: 2, rooms: 1, budgetCOP: 9_000_000 }
    const cena = spareSuggestions(it0(), trip, 50, pool).find((o) => o.title === 'Una cena especial')!
    expect(cena.detail).toContain('Lugar: Carmen')
    expect(cena.result.budgetPlan?.extras?.[0].venue?.name).toBe('Carmen')
  })
})
