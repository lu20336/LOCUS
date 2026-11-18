/**
 * ¿Te alcanza el presupuesto? Costo ESTIMADO del viaje a partir del
 * itinerario, las fechas, los viajeros y las habitaciones.
 *
 * Los mapas (OpenStreetMap, Geoapify) no traen precios, así que usamos
 * promedios de Colombia (pesos de 2026) según qué tan costoso es el destino:
 *   - Alojamiento: por habitación y por noche.
 *   - Comida: tres comidas por persona y por día.
 *   - Transporte: taxis y buses dentro de la ciudad; en los días de
 *     excursión, el bus ida y vuelta al pueblo (por kilómetro de carretera).
 *   - Entradas y actividades: según el tipo de cada lugar del plan
 *     (museo, castillo, parque temático…). Plazas, playas o miradores, gratis.
 * Son aproximaciones para orientar, y la app las muestra como "estimado".
 *
 * Funciones PURAS: no consultan nada.
 */
import type { TripDetails } from '../../types/flow'
import type { BudgetExtra, BudgetPlan, DayPlan, ExtraPart, ExtraVenue, Itinerary, Place, SpendStyle } from '../../types/itinerary'
import { isCoastal } from '../itinerary/coast'
import { quoteStay } from '../domain/pricing'
import { haversineKm } from '../itinerary/geo'
import { optimizeRoute } from '../itinerary/generateItinerary'
import { addStop, withDayPlaces } from './editItinerary'
import type { Listing } from '../domain/types'
import { formatCOP } from '../format'
import { normalizePlaceName } from './resolveDestination'

export type CostLevel = 'alto' | 'medio' | 'economico'

export const COST_LEVEL_LABELS: Record<CostLevel, string> = {
  alto: 'destino costoso',
  medio: 'ciudad o destino turístico',
  economico: 'pueblo o destino económico',
}

/** Destinos donde todo cuesta más (temporada turística casi todo el año). */
const HIGH_COST = ['cartagena', 'san andres', 'providencia', 'baru']
/** Ciudades grandes y pueblos muy turísticos. */
const MEDIUM_COST = [
  'bogota', 'medellin', 'cali', 'barranquilla', 'santa marta', 'bucaramanga', 'pereira', 'manizales', 'armenia',
  'villa de leyva', 'guatape', 'salento', 'villavicencio', 'cucuta', 'ibague', 'neiva', 'pasto', 'popayan',
  'tunja', 'valledupar', 'monteria', 'leticia', 'palomino', 'san gil', 'barichara', 'jardin', 'mompox',
  'santa cruz de mompox', 'filandia', 'capurgana', 'nuqui', 'bahia solano',
]

type PriceTable = Record<CostLevel, { roomNight: number; foodPerPersonDay: number; transportPerPersonDay: number }>

/** Precios promedio (COP) por nivel de costo: hotel, restaurantes y taxi. */
export const PRICES: PriceTable = {
  alto: { roomNight: 300_000, foodPerPersonDay: 130_000, transportPerPersonDay: 25_000 },
  medio: { roomNight: 200_000, foodPerPersonDay: 100_000, transportPerPersonDay: 20_000 },
  economico: { roomNight: 130_000, foodPerPersonDay: 70_000, transportPerPersonDay: 12_000 },
}

/** Viajando económico: hostal o casa de huéspedes, corrientazo y comida local, bus y a pie. */
export const ECONOMY_PRICES: PriceTable = {
  alto: { roomNight: 120_000, foodPerPersonDay: 60_000, transportPerPersonDay: 12_000 },
  medio: { roomNight: 80_000, foodPerPersonDay: 45_000, transportPerPersonDay: 10_000 },
  economico: { roomNight: 60_000, foodPerPersonDay: 35_000, transportPerPersonDay: 6_000 },
}

const priceFor = (style: SpendStyle | undefined, level: CostLevel) =>
  (style === 'economico' ? ECONOMY_PRICES : PRICES)[level]

/** Bus intermunicipal por persona y por kilómetro de carretera. */
export const BUS_COP_PER_KM = 220
/** La carretera es más larga que la línea recta. */
const ROAD_FACTOR = 1.3
const MIN_EXCURSION_FARE = 20_000

/** Entrada o gasto por persona según el tipo de lugar. Lo que no está aquí es gratis o ya va en comida. */
export const ENTRY_PRICES: Record<string, number> = {
  Museo: 20_000,
  Castillo: 30_000,
  Fuerte: 30_000,
  'Sitio arqueológico': 25_000,
  Teatro: 40_000,
  'Parque temático': 120_000,
  'Parque acuático': 80_000,
  'Reserva natural': 30_000,
  'Club de playa': 80_000,
  Imperdible: 25_000,
  // Salida de noche (consumo o cover). Se cobra una por noche: ver dayEntries.
  Bar: 40_000,
  Pub: 40_000,
  Discoteca: 50_000,
}

const NIGHT_OUT = new Set(['Bar', 'Pub', 'Discoteca'])

/**
 * Entradas y actividades de un día, por persona. La vida nocturna cuenta una
 * sola vez por noche (la más cara): ir a dos bares no duplica el gasto.
 */
export function dayEntries(day: Pick<DayPlan, 'places'>): number {
  let paid = 0
  let nightOut = 0
  for (const place of day.places) {
    if (NIGHT_OUT.has(place.kind)) nightOut = Math.max(nightOut, entryPrice(place))
    else paid += entryPrice(place)
  }
  return paid + nightOut
}

export function costLevelFor(displayName: string): CostLevel {
  const name = normalizePlaceName(displayName.split(',')[0] ?? '').trim()
  const matches = (list: string[]) => list.some((city) => name === city || name.startsWith(`${city} `))
  if (matches(HIGH_COST)) return 'alto'
  if (matches(MEDIUM_COST)) return 'medio'
  return 'economico'
}

const roundTo = (value: number, step = 1000) => Math.round(value / step) * step

export function entryPrice(place: Pick<Place, 'kind'>): number {
  return ENTRY_PRICES[place.kind] ?? 0
}

/** Bus ida y vuelta al pueblo de la excursión, por persona. */
export function excursionFare(day: Pick<DayPlan, 'excursion'>): number {
  if (!day.excursion) return 0
  return Math.max(MIN_EXCURSION_FARE, roundTo(day.excursion.distanceKm * ROAD_FACTOR * 2 * BUS_COP_PER_KM))
}

export type BudgetLineId = 'alojamiento' | 'comida' | 'transporte' | 'entradas' | 'extras'

export interface BudgetLine {
  id: BudgetLineId
  label: string
  amount: number
  /** Cómo se calculó, ej. "3 noches × 1 habitación × $200.000". */
  detail: string
}

export interface BudgetTip {
  text: string
  /** Cuánto se ahorraría (aprox.). */
  saves?: number
}

export interface TripBudget {
  level: CostLevel
  days: number
  nights: number
  lines: BudgetLine[]
  total: number
  budget: number
  /** presupuesto − costo estimado (negativo si no alcanza). */
  difference: number
  /** 'holgado': sobra más del 15 %; 'justo': alcanza por poco; 'falta': no alcanza. */
  status: 'holgado' | 'justo' | 'falta'
  /**
   * Lo que queda para alojamiento después de comida, transporte y entradas
   * (todo el viaje, todas las habitaciones). Sirve para filtrar alojamientos.
   */
  lodgingAllowance: number
  /** Ideas para que alcance (solo si falta). */
  tips: BudgetTip[]
}

const money = (value: number) => formatCOP(Math.round(value))
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function estimateTripBudget(
  itinerary: Pick<Itinerary, 'days' | 'destination' | 'budgetPlan'>,
  trip: Pick<TripDetails, 'travelers' | 'rooms' | 'budgetCOP'>,
): TripBudget {
  const level = costLevelFor(itinerary.destination.displayName)
  const style = itinerary.budgetPlan
  const price = {
    roomNight: priceFor(style?.lodging, level).roomNight,
    foodPerPersonDay: priceFor(style?.food, level).foodPerPersonDay,
    transportPerPersonDay: priceFor(style?.transport, level).transportPerPersonDay,
  }
  const people = Math.max(1, trip.travelers)
  const rooms = Math.max(1, trip.rooms)
  const days = itinerary.days.length
  const nights = Math.max(0, days - 1)
  const excursionDays = itinerary.days.filter((d) => d.excursion)
  const cityDays = days - excursionDays.length

  const lodging = nights * rooms * price.roomNight
  const food = days * people * price.foodPerPersonDay
  const busFares = excursionDays.reduce((sum, d) => sum + excursionFare(d), 0)
  const transport = cityDays * people * price.transportPerPersonDay + busFares * people
  const entriesPerPerson = itinerary.days.reduce((sum, d) => sum + dayEntries(d), 0)
  const entries = entriesPerPerson * people

  const lines: BudgetLine[] = [
    {
      id: 'alojamiento',
      label: 'Alojamiento',
      amount: lodging,
      detail:
        nights === 0
          ? 'Viaje de un día: sin noches'
          : `${plural(nights, 'noche', 'noches')} × ${plural(rooms, 'habitación', 'habitaciones')} × ${money(price.roomNight)}` +
            (style?.lodging === 'economico' ? ' · hostal o casa de huéspedes' : ''),
    },
    {
      id: 'comida',
      label: 'Comida',
      amount: food,
      detail:
        `${plural(days, 'día', 'días')} × ${plural(people, 'persona', 'personas')} × ${money(price.foodPerPersonDay)}` +
        (style?.food === 'economico' ? ' · corrientazo y comida local' : ''),
    },
    {
      id: 'transporte',
      label: 'Transporte',
      amount: transport,
      detail:
        (style?.transport === 'economico' ? 'Bus y a pie' : 'Taxis y buses') +
        (excursionDays.length > 0
          ? ` en la ciudad, más el bus a ${excursionDays.map((d) => d.excursion!.name).join(' y ')}`
          : `: ${money(price.transportPerPersonDay)} por persona al día`),
    },
    {
      id: 'entradas',
      label: 'Entradas y actividades',
      amount: entries,
      detail:
        entries === 0
          ? 'Los lugares del plan son gratis (plazas, playas, miradores…)'
          : `${money(entriesPerPerson)} por persona en museos, parques y salidas`,
    },
  ]
  const extras = style?.extras ?? []
  const extrasAmount = extras.reduce((sum, e) => sum + e.amount, 0)
  if (extras.length > 0) {
    lines.push({ id: 'extras', label: 'Planes extra', amount: extrasAmount, detail: listNames(extras.map((e) => e.title)) })
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const budget = Math.max(0, trip.budgetCOP)
  const difference = budget - total
  const status = difference < 0 ? 'falta' : difference >= total * 0.15 ? 'holgado' : 'justo'
  const lodgingAllowance = Math.max(0, budget - (food + transport + entries + extrasAmount))

  const tips: BudgetTip[] = []
  if (status === 'falta') {
    for (const day of excursionDays) {
      const saves =
        (excursionFare(day) - price.transportPerPersonDay) * people +
        dayEntries(day) * people
      if (saves > 0) tips.push({ text: `Quitar la excursión a ${day.excursion!.name}`, saves })
    }
    if (days > 1) {
      tips.push({
        text: 'Un día menos de viaje',
        saves: price.roomNight * rooms + (price.foodPerPersonDay + price.transportPerPersonDay) * people,
      })
    }
    if (nights > 0) {
      const perNight = Math.floor(lodgingAllowance / nights / rooms / 1000) * 1000
      tips.push({
        text:
          perNight > 0
            ? `Buscar alojamiento de hasta ${money(perNight)} por noche${rooms > 1 ? ' por habitación' : ''}`
            : 'Aun sin pagar alojamiento no alcanza: prueba con menos días o menos actividades pagas',
      })
    }
    const paid = entries > 0 && tips.length < 4
    if (paid) tips.push({ text: 'Cambiar algunas paradas pagas por gratis (botón «Cambiar» en cada parada)' })
  }

  return { level, days, nights, lines, total, budget, difference, status, lodgingAllowance, tips }
}

export interface StayFit {
  /** Costo total de la estadía (noches, limpieza y huéspedes extra). */
  total: number
  fits: boolean
  /** Cuánto se pasa del presupuesto para alojamiento (0 si cabe). */
  over: number
}

/**
 * ¿Este alojamiento cabe en lo que queda para hospedarse? Usa el mismo
 * cálculo de tarifa que la reserva (quoteStay), así que el precio es real.
 */
export function stayFit(
  listing: Pick<
    Listing,
    'pricePerNight' | 'cleaningFee' | 'includedGuests' | 'extraGuestFee' | 'capacity' | 'minNights' | 'maxNights'
  >,
  stay: { checkIn: string; checkOut: string; guests: number },
  lodgingAllowance: number,
): StayFit {
  const { total } = quoteStay(listing, stay)
  return { total, fits: total <= lodgingAllowance, over: Math.max(0, total - lodgingAllowance) }
}

// ---------------------------------------------------------------------------
// Ajustar el plan para que SIEMPRE cumpla el presupuesto
// ---------------------------------------------------------------------------

/**
 * Lo mínimo para el viaje: hospedaje económico, comida sencilla, bus y a pie,
 * y solo planes gratis. Si el presupuesto no llega a esto, el Paso 1 no deja
 * seguir (no hay forma de armar un plan que lo cumpla).
 */
export function minimumBudget(
  displayName: string,
  trip: Pick<TripDetails, 'travelers' | 'rooms'> & { days: number },
): number {
  const price = ECONOMY_PRICES[costLevelFor(displayName)]
  const people = Math.max(1, trip.travelers)
  const nights = Math.max(0, trip.days - 1)
  return (
    nights * Math.max(1, trip.rooms) * price.roomNight +
    trip.days * people * (price.foodPerPersonDay + price.transportPerPersonDay)
  )
}

const STEPS: { key: 'lodging' | 'food' | 'transport'; text: (level: CostLevel) => string }[] = [
  {
    key: 'lodging',
    text: (level) =>
      `Hospedaje económico (hostal o casa de huéspedes) de unos ${money(ECONOMY_PRICES[level].roomNight)} por noche`,
  },
  {
    key: 'food',
    text: (level) =>
      `Comida sencilla y local (corrientazo, mercados) de unos ${money(ECONOMY_PRICES[level].foodPerPersonDay)} por persona al día`,
  },
  { key: 'transport', text: () => 'Moverse en bus y a pie en vez de taxi' },
]

/** "A, B, C y 2 más": listas cortas para los avisos. */
function listNames(names: string[], max = 3): string {
  if (names.length <= max) return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0]
  return `${names.slice(0, max).join(', ')} y ${names.length - max} más`
}

/** Una alternativa gratis de la misma actividad, que no esté ya en el plan, la más cercana. */
function freeAlternative(itinerary: Itinerary, dayIndex: number, current: Place): Place | null {
  const used = new Set(itinerary.days.flatMap((d) => d.places.map((p) => p.id)))
  const pool = (itinerary.days[dayIndex].alternatives ?? []).filter(
    (p) => !used.has(p.id) && p.category === current.category && entryPrice(p) === 0,
  )
  return pool.reduce<Place | null>(
    (best, p) => (!best || haversineKm(current, p) < haversineKm(current, best) ? p : best),
    null,
  )
}

/**
 * Ajusta el itinerario hasta que el costo estimado quepa en el presupuesto,
 * cambiando primero lo que menos se nota en el viaje:
 *   1. Hospedaje económico.  2. Comida sencilla.  3. Bus y a pie.
 *   4. Paradas pagas (de la más cara a la más barata) por otras gratis de la
 *      misma actividad; si no hay, se quita (sin dejar un día vacío).
 *   5. Excursiones: el día pasa a la ciudad con planes gratis.
 * Devuelve el plan con `budgetPlan` (qué se cambió y si alcanzó). Función pura.
 */
export function fitItineraryToBudget(
  itinerary: Itinerary,
  trip: Pick<TripDetails, 'travelers' | 'rooms' | 'budgetCOP'>,
): Itinerary {
  const level = costLevelFor(itinerary.destination.displayName)
  let plan: BudgetPlan = { lodging: 'estandar', food: 'estandar', transport: 'estandar', adjustments: [], fits: true }
  // Ajustar empieza sin planes extra (y devuelve las paradas que un plan de todo el día había apartado).
  const withoutExtras = (itinerary.budgetPlan?.extras ?? []).reduce((it, e) => removeExtra(it, e.id), itinerary)
  let current: Itinerary = { ...withoutExtras, budgetPlan: plan }
  const fits = () => estimateTripBudget(current, trip).difference >= 0
  const note = (patch: Partial<BudgetPlan>, text: string) => {
    plan = { ...plan, ...patch, adjustments: [...plan.adjustments, text] }
    current = { ...current, budgetPlan: plan }
  }
  if (fits()) return current

  // 1 a 3: nivel de gasto.
  for (const step of STEPS) {
    note({ [step.key]: 'economico' }, step.text(level))
    if (fits()) return current
  }

  // 4: paradas pagas, de la más cara a la más barata. Primero se cambian por
  // otras gratis (se pierde poco); solo si no alcanza, se quitan.
  // Los cambios se resumen en una línea por tipo (no una por parada).
  const swaps: string[] = []
  const removed: Place[] = []
  const baseAdjustments = plan.adjustments
  const summarize = () => {
    const lines = [...baseAdjustments]
    if (swaps.length > 0) lines.push(`Cambiamos ${plural(swaps.length, 'parada paga', 'paradas pagas')} por otras gratis: ${listNames(swaps)}`)
    if (removed.length > 0) {
      const nightOnly = removed.every((p) => NIGHT_OUT.has(p.kind))
      lines.push(
        `Quitamos ${plural(removed.length, nightOnly ? 'salida de noche paga' : 'parada paga', nightOnly ? 'salidas de noche pagas' : 'paradas pagas')}: ` +
          listNames(removed.map((p) => p.name)),
      )
    }
    plan = { ...plan, adjustments: lines }
    current = { ...current, budgetPlan: plan }
  }
  const paidStops = () =>
    current.days
      .flatMap((day, dayIndex) => day.places.map((place) => ({ place, dayIndex })))
      .filter(({ place }) => entryPrice(place) > 0)
      .sort((a, b) => entryPrice(b.place) - entryPrice(a.place))

  for (const { place, dayIndex } of paidStops()) {
    const swap = freeAlternative(current, dayIndex, place)
    if (!swap) continue
    const places = current.days[dayIndex].places
    current = withDayPlaces(current, dayIndex, places.map((p) => (p.id === place.id ? swap : p)), { edited: false })
    swaps.push(`${place.name} por ${swap.name}`)
    summarize()
    if (fits()) return current
  }
  for (const { place, dayIndex } of paidStops()) {
    const places = current.days[dayIndex].places
    if (places.length <= 1) continue // sin dejar un día vacío
    current = withDayPlaces(current, dayIndex, places.filter((p) => p.id !== place.id), { edited: false })
    removed.push(place)
    summarize()
    if (fits()) return current
  }

  // 5: excursiones → un día en la ciudad con planes gratis que no entraron en el plan.
  for (let dayIndex = 0; dayIndex < current.days.length; dayIndex++) {
    const day = current.days[dayIndex]
    if (!day.excursion) continue
    const used = new Set(current.days.flatMap((d) => d.places.map((p) => p.id)))
    const seen = new Set<string>()
    const free = current.days
      .flatMap((d) => (d.excursion ? [] : (d.alternatives ?? [])))
      .filter((p) => !used.has(p.id) && entryPrice(p) === 0 && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => haversineKm(current.destination, a) - haversineKm(current.destination, b))
      .slice(0, Math.max(2, day.places.length))
    if (free.length === 0) continue
    const name = day.excursion.name
    current = withDayPlaces(current, dayIndex, optimizeRoute(current.destination, free), {
      edited: false,
      day: { excursion: undefined },
    })
    note({}, `Cambiamos la excursión a ${name} por un día en la ciudad con planes gratis`)
    if (fits()) return current
  }

  plan = { ...plan, fits: false }
  return { ...current, budgetPlan: plan }
}

// ---------------------------------------------------------------------------
// "Sugerir planes con lo que me sobra"
// ---------------------------------------------------------------------------

export interface SpareOption {
  id: string
  /**
   * 'mejora': volver a hotel, restaurantes o taxi; 'plan': una parada paga
   * que no entró en el itinerario; 'extra': un plan típico (tour, cena…).
   */
  type: 'mejora' | 'plan' | 'extra'
  title: string
  detail: string
  /** Cuánto sube el costo del viaje (para todos los viajeros). */
  cost: number
  /** El itinerario con el plan agregado (sigue dentro del presupuesto). */
  result: Itinerary
}

const UPGRADES: Record<'lodging' | 'food' | 'transport', { title: string; detail: (level: CostLevel) => string }> = {
  lodging: {
    title: 'Hotel en vez de hostal',
    detail: (level) => `Habitación de hotel de unos ${money(PRICES[level].roomNight)} por noche`,
  },
  food: {
    title: 'Comer en restaurantes',
    detail: (level) => `Unos ${money(PRICES[level].foodPerPersonDay)} por persona al día en comida`,
  },
  transport: { title: 'Moverse en taxi', detail: () => 'Taxis en vez de bus para ir de un lugar a otro' },
}

/**
 * Planes que caben en lo que sobra del presupuesto: volver a hotel,
 * restaurantes o taxi (si el ajuste los había bajado) y paradas pagas de las
 * actividades elegidas que no entraron en el plan (museos, castillos, bares…).
 * El costo de cada uno es lo que sube el total del viaje, así que la vida
 * nocturna de una noche que ya tiene salida no cuesta de más. Función pura.
 */
export function spareSuggestions(
  itinerary: Itinerary,
  trip: Pick<TripDetails, 'travelers' | 'rooms' | 'budgetCOP'>,
  limit = 12,
  /** Lugares de todas las actividades cerca del destino, para darle un lugar real a cada plan extra. */
  pool: readonly Place[] = [],
): SpareOption[] {
  const before = estimateTripBudget(itinerary, trip)
  if (before.difference <= 0) return []
  const level = before.level
  const options: SpareOption[] = []
  const consider = (option: Omit<SpareOption, 'cost'>) => {
    const cost = estimateTripBudget(option.result, trip).total - before.total
    if (cost > 0 && cost <= before.difference) options.push({ ...option, cost })
  }

  const plan = itinerary.budgetPlan
  for (const key of ['lodging', 'food', 'transport'] as const) {
    if (plan?.[key] !== 'economico') continue
    const prefix = STEPS.find((s) => s.key === key)!.text(level).split(' ')[0]
    consider({
      id: `mejora:${key}`,
      type: 'mejora',
      title: UPGRADES[key].title,
      detail: UPGRADES[key].detail(level),
      result: {
        ...itinerary,
        budgetPlan: { ...plan, [key]: 'estandar', adjustments: plan.adjustments.filter((a) => !a.startsWith(prefix)) },
      },
    })
  }

  // Paradas pagas que no entraron: cada lugar una vez, en el día con menos paradas.
  // Las paradas apartadas por un plan de todo el día también cuentan como usadas.
  const used = new Set([
    ...itinerary.days.flatMap((d) => d.places.map((p) => p.id)),
    ...(plan?.extras ?? []).flatMap((e) => (e.replaced ?? []).map((p) => p.id)),
  ])
  const best = new Map<string, { place: Place; dayIndex: number }>()
  itinerary.days.forEach((day, dayIndex) => {
    // Un día ocupado por un plan de todo el día solo admite salidas de noche.
    const busy = hasFullDay(itinerary, dayIndex)
    for (const place of day.alternatives ?? []) {
      if (used.has(place.id) || entryPrice(place) === 0) continue
      if (busy && place.category !== 'vidaNocturna') continue
      const current = best.get(place.id)
      if (!current || day.places.length < itinerary.days[current.dayIndex].places.length) {
        best.set(place.id, { place, dayIndex })
      }
    }
  })
  // A lo sumo 3 por actividad (los mejor valorados), para que la lista no se llene de bares iguales.
  const perCategory = new Map<string, number>()
  const candidates = [...best.values()]
    .sort((a, b) => b.place.score - a.place.score)
    .filter(({ place }) => {
      const n = perCategory.get(place.category) ?? 0
      perCategory.set(place.category, n + 1)
      return n < 3
    })
  for (const { place, dayIndex } of candidates) {
    const day = itinerary.days[dayIndex]
    consider({
      id: `plan:${place.id}`,
      type: 'plan',
      title: place.name,
      detail: `${place.kind} · Día ${day.day}${day.excursion ? ` (${day.excursion.name})` : ''}`,
      result: addStop(itinerary, dayIndex, place),
    })
  }

  // Planes típicos del destino (precio promedio según qué tan costoso es).
  const added = new Set((plan?.extras ?? []).map((e) => e.id))
  const people = Math.max(1, trip.travelers)
  const name = normalizePlaceName(itinerary.destination.displayName.split(',')[0] ?? '')
  for (const extra of EXTRA_PLANS) {
    if (added.has(extra.id) || !extra.when(itinerary, name)) continue
    const perPerson = roundTo(extra.perPerson * LEVEL_FACTOR[level], 5000)
    const venue = pickVenue(extra.id, itinerary, pool)
    const entry: BudgetExtra = {
      id: extra.id,
      title: extra.title,
      amount: perPerson * people,
      part: extra.part,
      ...(venue ? { venue } : {}),
    }
    const dayIndex = bestDayForExtra(itinerary, extra.part)
    consider({
      id: `extra:${extra.id}`,
      type: 'extra',
      title: extra.title,
      detail:
        `${extra.detail}${venue ? ` · ${venueText(venue)}` : ''} · unos ${money(perPerson)} por persona · ` +
        `Día ${dayIndex + 1}, ${extra.part === 'todo el día' ? 'todo el día' : `en la ${extra.part}`}`,
      result: placeExtra(itinerary, entry, dayIndex),
    })
  }

  // Primero las mejoras, luego los lugares reales (los más valorados primero) y al final los planes típicos.
  const rank = (o: SpareOption) =>
    o.type === 'mejora' ? 3 : o.type === 'plan' ? 2 + Math.min(0.99, (best.get(o.id.slice(5))?.place.score ?? 0) / 1000) : 1
  return options.sort((a, b) => rank(b) - rank(a)).slice(0, limit)
}

const LEVEL_FACTOR: Record<CostLevel, number> = { alto: 1.25, medio: 1, economico: 0.75 }

const COFFEE_REGION = ['salento', 'filandia', 'manizales', 'pereira', 'armenia', 'jardin', 'chinchina', 'montenegro']

/** Planes típicos de viaje en Colombia, con precio promedio por persona en una ciudad media. */
const EXTRA_PLANS: {
  id: string
  title: string
  detail: string
  perPerson: number
  /** Cuándo se hace: en la mañana, la tarde, la noche o todo el día. */
  part: ExtraPart
  when: (itinerary: Itinerary, name: string) => boolean
}[] = [
  { id: 'tour-guiado', title: 'Tour guiado a pie', detail: 'Unas 3 horas con un guía local', perPerson: 60_000, part: 'mañana', when: () => true },
  {
    id: 'lancha-islas',
    title: 'Paseo en lancha a las islas o playas cercanas',
    detail: 'Día completo con almuerzo',
    perPerson: 220_000,
    part: 'todo el día',
    when: (it) => isCoastal(it.destination),
  },
  {
    id: 'club-playa',
    title: 'Día en un club de playa',
    detail: 'Asoleadoras, piscina y almuerzo',
    perPerson: 120_000,
    part: 'todo el día',
    when: (it) => isCoastal(it.destination),
  },
  {
    id: 'finca-cafetera',
    title: 'Tour en una finca cafetera',
    detail: 'Recorrido, cata y almuerzo',
    perPerson: 90_000,
    part: 'mañana',
    when: (_, name) => COFFEE_REGION.some((town) => name.startsWith(town)),
  },
  { id: 'clase-baile', title: 'Clase de baile (salsa o champeta)', detail: 'Una hora y media, en grupo', perPerson: 50_000, part: 'noche', when: () => true },
  { id: 'cena-especial', title: 'Una cena especial', detail: 'En un restaurante reconocido del destino', perPerson: 150_000, part: 'noche', when: () => true },
  { id: 'clase-cocina', title: 'Clase de cocina colombiana', detail: 'Mercado, cocina y almuerzo', perPerson: 140_000, part: 'mañana', when: () => true },
  { id: 'spa', title: 'Una tarde de spa o masajes', detail: 'Masaje de una hora', perPerson: 150_000, part: 'tarde', when: () => true },
]

// ---------------------------------------------------------------------------
// Planes extra dentro del itinerario: en qué día y momento van
// ---------------------------------------------------------------------------

export const EXTRA_PART_ORDER: ExtraPart[] = ['todo el día', 'mañana', 'tarde', 'noche']

/** Planes extra de un día, en orden: todo el día, mañana, tarde, noche. */
export function extrasForDay(itinerary: Pick<Itinerary, 'budgetPlan'>, dayIndex: number): BudgetExtra[] {
  return (itinerary.budgetPlan?.extras ?? [])
    .filter((e) => e.dayIndex === dayIndex)
    .sort((a, b) => EXTRA_PART_ORDER.indexOf(a.part ?? 'tarde') - EXTRA_PART_ORDER.indexOf(b.part ?? 'tarde'))
}

const hasFullDay = (itinerary: Itinerary, dayIndex: number, exceptId?: string) =>
  extrasForDay(itinerary, dayIndex).some((e) => e.part === 'todo el día' && e.id !== exceptId)

/**
 * Días donde puede ir un plan: los de todo el día, en un día en la ciudad sin
 * otro plan de todo el día; los de mañana o tarde, en un día que no sea de
 * excursión ni esté ocupado todo el día; los de noche, en cualquier día.
 */
export function daysForExtra(itinerary: Itinerary, part: ExtraPart, exceptId?: string): number[] {
  const all = itinerary.days.map((_, i) => i)
  const ok = all.filter((i) => {
    const day = itinerary.days[i]
    if (part === 'noche') return true
    return !day.excursion && !hasFullDay(itinerary, i, exceptId)
  })
  return ok.length > 0 ? ok : all
}

/** El mejor día para un plan: el que tiene menos paradas y menos planes extra. */
export function bestDayForExtra(itinerary: Itinerary, part: ExtraPart): number {
  // Un plan de todo el día cuenta como un día lleno, así los demás se reparten en otros días.
  const load = (i: number) =>
    itinerary.days[i].places.length +
    extrasForDay(itinerary, i).reduce((sum, e) => sum + (e.part === 'todo el día' ? 10 : 2), 0)
  return daysForExtra(itinerary, part).reduce((best, i) => (load(i) < load(best) ? i : best))
}

/**
 * Pone el plan en un día. Si es de todo el día, las paradas de ese día se
 * apartan (quedan guardadas en el plan y vuelven si se mueve o se quita).
 */
export function placeExtra(itinerary: Itinerary, extra: BudgetExtra, dayIndex: number): Itinerary {
  const plan = itinerary.budgetPlan ?? { lodging: 'estandar', food: 'estandar', transport: 'estandar', adjustments: [], fits: true }
  let next = itinerary
  let placed: BudgetExtra = { ...extra, dayIndex, replaced: undefined }
  if (extra.part === 'todo el día' && itinerary.days[dayIndex].places.length > 0) {
    placed = { ...placed, replaced: itinerary.days[dayIndex].places }
    next = withDayPlaces(itinerary, dayIndex, [], { edited: false })
  }
  return { ...next, budgetPlan: { ...plan, extras: [...(plan.extras ?? []).filter((e) => e.id !== extra.id), placed] } }
}

/** Quita un plan extra; si había apartado paradas, vuelven a su día. */
export function removeExtra(itinerary: Itinerary, id: string): Itinerary {
  const plan = itinerary.budgetPlan
  const extra = plan?.extras?.find((e) => e.id === id)
  if (!plan || !extra) return itinerary
  let next = itinerary
  if (extra.replaced?.length && extra.dayIndex !== undefined) {
    const day = itinerary.days[extra.dayIndex]
    next = withDayPlaces(itinerary, extra.dayIndex, [...extra.replaced, ...day.places], { edited: false })
  }
  return { ...next, budgetPlan: { ...plan, extras: (plan.extras ?? []).filter((e) => e.id !== id) } }
}

/** Cambia un plan extra de día (devuelve las paradas que había apartado). */
export function moveExtra(itinerary: Itinerary, id: string, dayIndex: number): Itinerary {
  const extra = itinerary.budgetPlan?.extras?.find((e) => e.id === id)
  if (!extra || extra.dayIndex === dayIndex) return itinerary
  return placeExtra(removeExtra(itinerary, id), extra, dayIndex)
}

// ---------------------------------------------------------------------------
// Lugar real de cada plan extra
// ---------------------------------------------------------------------------

interface VenueRule {
  role: string
  /** Qué lugares sirven. */
  accepts: (place: Place) => boolean
  /** Cuáles se prefieren entre los que sirven (ej. una salsoteca para la clase de baile). */
  prefers?: (place: Place) => boolean
}

const VENUE_RULES: Record<string, VenueRule> = {
  'cena-especial': { role: 'Lugar', accepts: (p) => p.category === 'gastronomia' && p.kind === 'Restaurante' },
  'clase-baile': {
    role: 'Lugar',
    accepts: (p) => p.category === 'vidaNocturna',
    prefers: (p) => /salsa|salsoteca|champeta|baile|son\b|rumba/i.test(p.name) || p.kind === 'Discoteca',
  },
  'tour-guiado': {
    role: 'Punto de encuentro',
    accepts: (p) => p.category === 'cultura' && /plaza|parque|catedral|centro hist|torre del reloj/i.test(p.name),
    prefers: (p) => /plaza/i.test(p.name),
  },
  'club-playa': {
    role: 'Lugar',
    accepts: (p) => p.category === 'playa',
    prefers: (p) => p.kind === 'Club de playa',
  },
  'lancha-islas': {
    role: 'Sale de',
    // Solo muelles, marinas o terminales: un "desembarcadero" suele estar en la isla (ahí se llega, no se sale).
    accepts: (p) => /\bmuelle|\bmarina\b|terminal mar/i.test(p.name),
  },
  'clase-cocina': { role: 'Lugar', accepts: (p) => p.kind === 'Mercado' || /mercado/i.test(p.name) },
  spa: { role: 'Lugar', accepts: (p) => /\bspa\b|masaj/i.test(p.name) },
  'finca-cafetera': { role: 'Lugar', accepts: (p) => /\bfinca\b|hacienda/i.test(p.name) },
}

/** "Lugar: Restaurante X" / "Punto de encuentro: Plaza de Bolívar". */
export function venueText(venue: Pick<ExtraVenue, 'role' | 'name'>): string {
  return `${venue.role}: ${venue.name}`
}

/**
 * El lugar real para un plan extra: de los lugares cerca del destino (y los
 * del propio itinerario), uno que sirva para ese plan y no sea ya una parada.
 * Se prefieren los que encajan mejor, luego los mejor valorados y luego los más
 * cercanos al centro. null si no hay ninguno (no se inventa).
 */
export function pickVenue(extraId: string, itinerary: Itinerary, pool: readonly Place[] = []): ExtraVenue | null {
  const rule = VENUE_RULES[extraId]
  if (!rule) return null
  const inPlan = new Set(itinerary.days.flatMap((d) => d.places.map((p) => p.id)))
  const takenByExtras = new Set((itinerary.budgetPlan?.extras ?? []).map((e) => e.venue?.id).filter(Boolean))
  const seen = new Set<string>()
  const candidates = [...pool, ...itinerary.days.flatMap((d) => d.alternatives ?? [])].filter((p) => {
    if (seen.has(p.id) || inPlan.has(p.id) || takenByExtras.has(p.id)) return false
    seen.add(p.id)
    return rule.accepts(p)
  })
  const prefers = rule.prefers ?? (() => false)
  const center = itinerary.destination
  const best = candidates.sort(
    (a, b) =>
      Number(prefers(b)) - Number(prefers(a)) ||
      b.score - a.score ||
      haversineKm(center, a) - haversineKm(center, b),
  )[0]
  return best ? { id: best.id, name: best.name, kind: best.kind, lat: best.lat, lon: best.lon, role: rule.role } : null
}
