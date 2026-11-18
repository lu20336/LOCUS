/**
 * Lógica pura de "Mis viajes": en qué estado está un itinerario según sus
 * fechas, cuánto dura y cómo se agrupa. Sin Firebase ni React, para probarla.
 *
 * No se guarda ningún "estado" en la base de datos: se DERIVA de las fechas
 * (así no hay datos duplicados que se desactualicen ni cambios en las reglas).
 */
import { addDays, nightsBetween } from '../domain/dates'
import { spanishT } from '../i18n/store'
import type { Translator } from '../i18n/translate'

export type TripStatus = 'upcoming' | 'ongoing' | 'past'

export interface TripLike {
  title: string
  startDate: string
  endDate: string
  destination: { displayName: string }
  days: { places: unknown[] }[]
  updatedAt: number | null
}

/** 'upcoming' antes de la salida, 'ongoing' entre salida y regreso (ambos incluidos), 'past' después. */
export function tripStatus(trip: Pick<TripLike, 'startDate' | 'endDate'>, today: string): TripStatus {
  if (trip.endDate < today) return 'past'
  if (trip.startDate > today) return 'upcoming'
  return 'ongoing'
}

/** Días del viaje contando salida y regreso (3 al 5 → 3 días). */
export const tripDays = (trip: Pick<TripLike, 'startDate' | 'endDate'>) => nightsBetween(trip.startDate, trip.endDate) + 1

export const tripPlaces = (trip: Pick<TripLike, 'days'>) => trip.days.reduce((sum, d) => sum + d.places.length, 0)

/** Días que faltan para la salida (negativo si ya pasó). */
export const daysUntil = (startDate: string, today: string) => nightsBetween(today, startDate)

/** Nombre corto del destino: "Cartagena de Indias, Bolívar, Colombia" → "Cartagena de Indias". */
export const tripPlace = (trip: Pick<TripLike, 'destination'>) => trip.destination.displayName.split(',')[0].trim()

export interface GroupedTrips<T> {
  /** En curso y próximos: primero el que ocurre antes. */
  upcoming: T[]
  /** Realizados: primero el más reciente. */
  past: T[]
}

export function groupTrips<T extends TripLike>(trips: readonly T[], today: string): GroupedTrips<T> {
  const upcoming: T[] = []
  const past: T[] = []
  for (const t of trips) (tripStatus(t, today) === 'past' ? past : upcoming).push(t)
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
  past.sort((a, b) => b.endDate.localeCompare(a.endDate))
  return { upcoming, past }
}

/** El viaje más cercano (en curso o próximo), o null. */
export function nextTrip<T extends TripLike>(trips: readonly T[], today: string): T | null {
  return groupTrips(trips, today).upcoming[0] ?? null
}

/** Filtra por texto en el nombre o el destino (sin tildes ni mayúsculas). */
export function filterTrips<T extends TripLike>(trips: readonly T[], text: string): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const q = norm(text.trim())
  if (!q) return [...trips]
  return trips.filter((t) => norm(`${t.title} ${t.destination.displayName}`).includes(q))
}

/** Título para una copia: "Viaje a Salento" → "Viaje a Salento (copia)"; copiar una copia no apila "(copia)". */
export function copyTitle(title: string): string {
  const base = title.replace(/\s*\(copia(?: \d+)?\)$/, '')
  return `${base} (copia)`.slice(0, 120)
}

/** Fechas de la copia: mismas noches, empezando en `startFrom`. */
export function shiftedDates(startDate: string, endDate: string, startFrom: string): { startDate: string; endDate: string } {
  return { startDate: startFrom, endDate: addDays(startFrom, nightsBetween(startDate, endDate)) }
}

/** Texto para compartir el viaje por WhatsApp, correo o el menú de compartir del sistema. */
export function shareSummary(trip: TripLike & { travelers: number }, formatRange: (a: string, b: string) => string, t: Translator = spanishT()): string {
  return [
    `${trip.title} · ${formatRange(trip.startDate, trip.endDate)}`,
    `${t('common.days', { count: tripDays(trip) })} · ${t('common.travelers', { count: trip.travelers })} · ${t('common.places', { count: tripPlaces(trip) })}`,
    t('trips.share.planned'),
  ].join('\n')
}
