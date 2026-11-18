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
import type { DayPlan, Itinerary, Place } from '../../types/itinerary'
import { quoteStay } from '../domain/pricing'
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

/** Precios promedio (COP) por nivel de costo. */
export const PRICES: Record<CostLevel, { roomNight: number; foodPerPersonDay: number; transportPerPersonDay: number }> = {
  alto: { roomNight: 300_000, foodPerPersonDay: 130_000, transportPerPersonDay: 25_000 },
  medio: { roomNight: 200_000, foodPerPersonDay: 100_000, transportPerPersonDay: 20_000 },
  economico: { roomNight: 130_000, foodPerPersonDay: 70_000, transportPerPersonDay: 12_000 },
}

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

export type BudgetLineId = 'alojamiento' | 'comida' | 'transporte' | 'entradas'

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
  itinerary: Pick<Itinerary, 'days' | 'destination'>,
  trip: Pick<TripDetails, 'travelers' | 'rooms' | 'budgetCOP'>,
): TripBudget {
  const level = costLevelFor(itinerary.destination.displayName)
  const price = PRICES[level]
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
          : `${plural(nights, 'noche', 'noches')} × ${plural(rooms, 'habitación', 'habitaciones')} × ${money(price.roomNight)}`,
    },
    {
      id: 'comida',
      label: 'Comida',
      amount: food,
      detail: `${plural(days, 'día', 'días')} × ${plural(people, 'persona', 'personas')} × ${money(price.foodPerPersonDay)}`,
    },
    {
      id: 'transporte',
      label: 'Transporte',
      amount: transport,
      detail:
        excursionDays.length > 0
          ? `Taxis y buses en la ciudad, más el bus a ${excursionDays.map((d) => d.excursion!.name).join(' y ')}`
          : `Taxis y buses: ${money(price.transportPerPersonDay)} por persona al día`,
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

  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const budget = Math.max(0, trip.budgetCOP)
  const difference = budget - total
  const status = difference < 0 ? 'falta' : difference >= total * 0.15 ? 'holgado' : 'justo'
  const lodgingAllowance = Math.max(0, budget - (food + transport + entries))

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
