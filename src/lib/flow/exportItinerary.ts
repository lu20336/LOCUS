/**
 * Sacar el itinerario de la app (Paso 4):
 *   - itineraryToText: texto para compartir (WhatsApp, correo…).
 *   - itineraryToIcs: archivo de calendario (.ics, RFC 5545) con un evento de
 *     día completo por cada día del viaje; lo abren Google Calendar, Outlook y
 *     el calendario del celular.
 * Funciones puras (la fecha de creación se puede fijar para las pruebas).
 */
import type { DayPlan, Itinerary } from '../../types/itinerary'
import { formatDateRange } from '../format'
import { getT } from '../i18n/store'
import { dayParts, DAY_PART_LABELS } from './editItinerary'
import { formatDayTab, googleMapsRouteUrl } from './itineraryView'

export const APP_URL = 'https://locus-bb57e.firebaseapp.com'

const placeName = (it: Itinerary) => it.destination.displayName.split(',')[0]

/** "Día 2 · vie 11 dic · Excursión a Turbaco" */
export function dayTitle(day: DayPlan): string {
  return `${getT()('it.day', { day: day.day })} · ${formatDayTab(day.date)}${day.excursion ? ` · ${getT()('it.excursionTo', { name: day.excursion.name })}` : ''}`
}

/** Paradas del día agrupadas por momento: [["Mañana", ["Museo del Oro", …]], …] */
/** "Plan extra (noche): Una cena especial" — los planes extra de un día, en orden. */
export function extraLines(it: Pick<Itinerary, 'budgetPlan'>, dayIndex: number): string[] {
  const order = ['todo el día', 'mañana', 'tarde', 'noche']
  return (it.budgetPlan?.extras ?? [])
    .filter((e) => e.dayIndex === dayIndex)
    .sort((a, b) => order.indexOf(a.part ?? 'tarde') - order.indexOf(b.part ?? 'tarde'))
    .map((e) => `Plan extra (${e.part ?? 'tarde'}): ${e.title}${e.venue ? ` · ${e.venue.role}: ${e.venue.name}` : ''}`)
}

export function stopsByPart(day: DayPlan): [string, string[]][] {
  const parts = dayParts(day.places)
  const groups: [string, string[]][] = []
  day.places.forEach((place, i) => {
    const label = DAY_PART_LABELS[parts[i]]
    if (groups.at(-1)?.[0] !== label) groups.push([label, []])
    groups.at(-1)![1].push(place.name)
  })
  return groups
}

export function itineraryToText(it: Itinerary): string {
  const days = it.days.length
  const lines = [`${getT()('it.myTripTo', { place: placeName(it) })} · ${formatDateRange(it.input.startDate, it.input.endDate)} (${getT()('act.daysCount', { count: days })})`]
  it.days.forEach((day, dayIndex) => {
    lines.push('', dayTitle(day))
    const extras = extraLines(it, dayIndex)
    if (day.places.length === 0 && extras.length === 0) lines.push('  Día libre para recorrer a tu ritmo.')
    for (const [part, names] of stopsByPart(day)) lines.push(`  ${part}: ${names.join(' → ')}`)
    for (const extra of extras) lines.push(`  ${extra}`)
    const route = googleMapsRouteUrl(day.excursion ?? it.destination, day.places)
    if (route) lines.push(`  Ruta: ${route}`)
  })
  // Planes extra sin día (de una versión anterior del plan).
  const loose = (it.budgetPlan?.extras ?? []).filter((e) => e.dayIndex === undefined)
  if (loose.length > 0) {
    lines.push('', 'Planes extra')
    for (const extra of loose) lines.push(`  ${extra.title}`)
  }
  lines.push('', `Planeado con LOCUS · ${APP_URL}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Calendario (.ics)
// ---------------------------------------------------------------------------

/** Escapa texto para iCalendar: \ ; , y saltos de línea. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/**
 * Corta las líneas largas (las siguientes empiezan con un espacio), como pide
 * RFC 5545. El límite es de 75 BYTES; con 60 caracteres hay margen para las
 * tildes y la ñ, que ocupan 2 bytes en UTF-8.
 */
export function icsFold(line: string, width = 60): string {
  const chunks = [line.slice(0, width)]
  for (let i = width; i < line.length; i += width - 1) chunks.push(line.slice(i, i + width - 1))
  return chunks.join('\r\n ')
}

const icsDate = (iso: string) => iso.replace(/-/g, '')

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function itineraryToIcs(it: Itinerary, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const city = placeName(it)
  const events = it.days.flatMap((day, dayIndex) => {
    const description = [
      ...stopsByPart(day).map(([part, names]) => `${part}: ${names.join(' → ')}`),
      ...extraLines(it, dayIndex),
      googleMapsRouteUrl(day.excursion ?? it.destination, day.places) ?? '',
      `Planeado con LOCUS · ${APP_URL}`,
    ]
      .filter(Boolean)
      .join('\n')
    return [
      'BEGIN:VEVENT',
      `UID:locus-${icsDate(it.input.startDate)}-${day.day}-${stamp}@locus-bb57e`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(day.date)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(day.date))}`,
      `SUMMARY:${icsEscape(day.excursion ? `Excursión a ${day.excursion.name}` : `Día ${day.day} en ${city}`)}`,
      `LOCATION:${icsEscape(day.excursion ? `${day.excursion.name}, ${day.excursion.region}` : it.destination.displayName)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      'END:VEVENT',
    ]
  })
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LOCUS//Itinerario//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(`Viaje a ${city}`)}`,
    ...events,
    'END:VCALENDAR',
  ]
    .map((line) => icsFold(line))
    .join('\r\n')
}

/**
 * Enlace que abre Google Calendar con el viaje ya escrito (un evento de día
 * completo desde la salida hasta el regreso, con el plan día por día en la
 * descripción). Funciona en el computador y en Android (abre la app).
 */
export function googleCalendarUrl(it: Itinerary): string {
  const event = tripEvent(it)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${icsDate(event.startDate)}/${icsDate(event.endDateExclusive)}`,
    location: event.location,
    details: event.details,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** El viaje como UN evento de día completo (Google Calendar y el calendario de Android). */
export interface TripEvent {
  title: string
  location: string
  /** El plan día por día, en texto. */
  details: string
  /** Primer día (ISO) y el día SIGUIENTE al último (el fin no se incluye). */
  startDate: string
  endDateExclusive: string
}

export function tripEvent(it: Itinerary): TripEvent {
  const details = [
    ...it.days.flatMap((day, dayIndex) => {
      const extras = extraLines(it, dayIndex).map((line) => `  ${line}`)
      return [
        dayTitle(day),
        ...(day.places.length === 0 && extras.length === 0
          ? ['  Día libre']
          : stopsByPart(day).map(([part, names]) => `  ${part}: ${names.join(' → ')}`)),
        ...extras,
      ]
    }),
    '',
    `Planeado con LOCUS · ${APP_URL}`,
  ].join('\n')
  return {
    title: `Viaje a ${placeName(it)}`,
    location: it.destination.displayName,
    details,
    startDate: it.input.startDate,
    endDateExclusive: nextDay(it.input.endDate),
  }
}

/** Nombre del archivo: "viaje-cartagena-de-indias-2026-12-10.ics" */
export function icsFileName(it: Itinerary): string {
  const slug = placeName(it)
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `viaje-${slug}-${it.input.startDate}.ics`
}
