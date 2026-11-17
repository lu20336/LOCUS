/**
 * PDF del itinerario (Paso 4 · "Descargar PDF"), diseñado para leerse e
 * imprimirse en A4:
 *   - Encabezado con la marca LOCUS y el título del viaje.
 *   - Resumen en tarjetas (días, lugares, recorrido, presupuesto por día).
 *   - Cada día con su fecha, la excursión si la hay, y las paradas numeradas
 *     agrupadas en mañana, tarde y noche, con su tipo y la distancia desde la
 *     anterior; enlace a la ruta del día en Google Maps.
 *   - Pie con número de página y la fuente de los datos.
 * jsPDF se carga solo al pulsar el botón (no pesa en el resto de la app).
 */
import type { jsPDF } from 'jspdf'
import type { TripDetails } from '../../types/flow'
import type { DayPlan, Itinerary } from '../../types/itinerary'
import { formatCOP, formatDateRange, formatDuration } from '../format'
import { CATEGORIES } from '../itinerary/categories'
import { dayParts, DAY_PART_LABELS } from './editItinerary'
import { APP_URL, icsFileName } from './exportItinerary'
import { formatDayTab, formatDistance, googleMapsRouteUrl, legDistancesKm } from './itineraryView'

type RGB = [number, number, number]
const NAVY: RGB = [0, 51, 102]
const TEAL: RGB = [0, 135, 125]
const TEAL_BRIGHT: RGB = [0, 166, 153]
const INK: RGB = [26, 33, 48]
const MUTED: RGB = [92, 122, 153]
const LIGHT: RGB = [237, 241, 245]
const LINE: RGB = [214, 222, 232]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - 2 * MARGIN
const BOTTOM = PAGE_H - 22

/** Caracteres que la fuente estándar del PDF no tiene (Helvetica, WinAnsi). */
const REPLACEMENTS: Record<string, string> = { '→': '›', '≈': '~', '−': '-' }

/** Deja solo caracteres que Helvetica puede dibujar (las tildes y la ñ sí están). */
export function pdfSafe(text: string): string {
  return [...text]
    .map((c) => REPLACEMENTS[c] ?? c)
    .filter((c) => c.charCodeAt(0) <= 0xff || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(c))
    .join('')
}

export async function buildItineraryPdf(it: Itinerary, trip: TripDetails, now: Date = new Date()): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const city = it.destination.displayName.split(',')[0]
  const places = it.days.reduce((n, d) => n + d.places.length, 0)

  const color = (rgb: RGB) => doc.setTextColor(...rgb)
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }
  const text = (value: string, x: number, y: number, options?: Parameters<jsPDF['text']>[3]) =>
    doc.text(pdfSafe(value), x, y, options)

  // --- Portada / encabezado ---------------------------------------------------
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 34, 'F')
  font(22, 'bold')
  color([255, 255, 255])
  text('Locus', MARGIN, 17)
  doc.setFillColor(...TEAL_BRIGHT)
  doc.circle(MARGIN + doc.getTextWidth('Locus') + 1.8, 16.2, 1.2, 'F')
  font(9)
  text('Tu plan de viaje por Colombia', MARGIN, 25)
  const generated = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  text(`Generado el ${generated}`, PAGE_W - MARGIN, 25, { align: 'right' })

  let y = 48
  font(20, 'bold')
  color(NAVY)
  text(`Tu plan en ${city}`, MARGIN, y)
  y += 7
  font(10)
  color(MUTED)
  const days = it.days.length
  text(
    `${formatDateRange(trip.startDate, trip.endDate)} · ${days} ${days === 1 ? 'día' : 'días'} · ${trip.travelers} ${trip.travelers === 1 ? 'viajero' : 'viajeros'}`,
    MARGIN,
    y,
  )

  // --- Tarjetas de resumen ----------------------------------------------------
  y += 7
  const stats: [string, string][] = [
    ['Días', String(days)],
    ['Lugares', String(places)],
    ['Recorrido', formatDistance(it.days.reduce((sum, d) => sum + d.distanceKm, 0))],
    ['Presupuesto por día', formatCOP(Math.round(trip.budgetCOP / days))],
  ]
  const gap = 4
  const boxW = (CONTENT_W - gap * (stats.length - 1)) / stats.length
  stats.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + gap)
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, y, boxW, 18, 2.5, 2.5, 'F')
    font(7, 'bold')
    color(MUTED)
    text(label.toUpperCase(), x + 4, y + 6.5)
    font(12.5, 'bold')
    color(NAVY)
    text(value, x + 4, y + 13.5)
  })
  y += 28

  // --- Días -------------------------------------------------------------------
  const newPage = () => {
    doc.addPage()
    font(8, 'bold')
    color(MUTED)
    text(`LOCUS · Tu plan en ${city}`, MARGIN, 12)
    doc.setDrawColor(...LINE)
    doc.line(MARGIN, 14.5, PAGE_W - MARGIN, 14.5)
    y = 24
  }
  const ensure = (height: number) => {
    if (y + height > BOTTOM) newPage()
  }

  const STOP_H = 11
  for (const day of it.days) {
    // Que la cabecera del día y al menos su primera parada queden juntas.
    ensure(16 + (day.excursion ? 6 : 0) + Math.min(day.places.length, 2) * STOP_H)
    drawDayHeader(day)
    if (day.places.length === 0) {
      font(10, 'italic')
      color(MUTED)
      text(day.excursion ? `Recorre ${day.excursion.name} a tu ritmo.` : 'Día libre para recorrer a tu ritmo.', MARGIN + 4, y)
      y += 10
      continue
    }
    const parts = dayParts(day.places)
    const legs = legDistancesKm(day.excursion ?? it.destination, day.places)
    day.places.forEach((place, i) => {
      if (parts[i] !== parts[i - 1]) {
        if (i > 0) y += 2.5 // aire entre mañana, tarde y noche
        ensure(6 + STOP_H)
        font(7.5, 'bold')
        color(TEAL)
        text(DAY_PART_LABELS[parts[i]].toUpperCase(), MARGIN + 4, y)
        y += 4.5
      }
      ensure(STOP_H)
      // Número de la parada en un círculo.
      doc.setFillColor(...NAVY)
      doc.circle(MARGIN + 7, y + 1.6, 3, 'F')
      font(8, 'bold')
      color([255, 255, 255])
      text(String(i + 1), MARGIN + 7, y + 2.8, { align: 'center' })
      font(11, 'bold')
      color(INK)
      text(place.name, MARGIN + 13, y + 2.6, { maxWidth: CONTENT_W - 15 })
      font(8.5)
      color(MUTED)
      const from = i === 0 ? (day.excursion ? `del centro de ${day.excursion.name}` : 'del centro') : 'de la parada anterior'
      text(`${place.kind} · ${CATEGORIES[place.category].label} · a ${formatDistance(legs[i])} ${from}`, MARGIN + 13, y + 7)
      y += STOP_H
    })
    const route = googleMapsRouteUrl(day.excursion ?? it.destination, day.places)
    if (route) {
      font(8.5, 'bold')
      color(TEAL)
      doc.textWithLink(pdfSafe('Ver la ruta del día en Google Maps'), MARGIN + 13, y + 1, { url: route })
      y += 6
    }
    y += 5
  }

  function drawDayHeader(day: DayPlan) {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F')
    doc.setFillColor(...TEAL_BRIGHT)
    doc.rect(MARGIN, y, 1.6, 10, 'F')
    font(11.5, 'bold')
    color(NAVY)
    text(`Día ${day.day} · ${formatDayTab(day.date)}`, MARGIN + 5, y + 6.6)
    font(9, 'bold')
    color(day.excursion ? TEAL : MUTED)
    const right = day.excursion
      ? `Excursión a ${day.excursion.name}`
      : `${day.places.length} ${day.places.length === 1 ? 'parada' : 'paradas'} · ${formatDistance(day.distanceKm)}`
    text(right, PAGE_W - MARGIN - 4, y + 6.6, { align: 'right' })
    y += 15
    if (day.excursion) {
      font(9, 'italic')
      color(MUTED)
      const time =
        day.excursion.driveMinutes !== undefined
          ? `aprox. ${formatDuration(day.excursion.driveMinutes)} en carro desde ${city}, sin tráfico`
          : `a ${day.excursion.distanceKm} km de ${city} en línea recta`
      text(`${day.excursion.tagline} · ${time}`, MARGIN + 4, y - 1)
      y += 5
    }
  }

  // --- Pie de página ----------------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.line(MARGIN, PAGE_H - 15, PAGE_W - MARGIN, PAGE_H - 15)
    font(7.5)
    color(MUTED)
    text('Lugares de OpenStreetMap. Distancias en línea recta: revisa horarios y precios antes de ir.', MARGIN, PAGE_H - 10.5)
    text(`Planeado con LOCUS · ${APP_URL.replace('https://', '')}`, MARGIN, PAGE_H - 6.5)
    text(`Página ${page} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 6.5, { align: 'right' })
  }
  return doc
}

export async function downloadItineraryPdf(it: Itinerary, trip: TripDetails): Promise<void> {
  const doc = await buildItineraryPdf(it, trip)
  doc.save(icsFileName(it).replace(/\.ics$/, '.pdf'))
}
