/**
 * Paso 4 · Resumen del plan y cómo llevárselo:
 *   - Lista día por día (mañana, tarde, noche), con las excursiones.
 *   - "Descargar PDF": abre la impresión del navegador; el CSS de impresión
 *     (index.css, .locus-print) deja SOLO este resumen en la hoja, y ahí se
 *     elige "Guardar como PDF".
 *   - "Compartir": menú del celular (Web Share API) o, si no existe, copia el
 *     texto para pegarlo en WhatsApp o un correo.
 *   - "Agregar al calendario": archivo .ics con un evento por día.
 */
import { CalendarPlus, Check, FileDown, MapPinned, Share2 } from 'lucide-react'
import { useState } from 'react'
import { dayTitle, icsFileName, itineraryToIcs, itineraryToText, stopsByPart } from '../lib/flow/exportItinerary'
import { formatCOP, formatDateRange } from '../lib/format'
import type { TripDetails } from '../types/flow'
import type { Itinerary } from '../types/itinerary'

export function PlanSummary({ itinerary, trip }: { itinerary: Itinerary; trip: TripDetails }) {
  const [shared, setShared] = useState<string | null>(null)
  const city = itinerary.destination.displayName.split(',')[0]
  const places = itinerary.days.reduce((n, d) => n + d.places.length, 0)

  async function share() {
    const text = itineraryToText(itinerary)
    try {
      if (navigator.share) {
        await navigator.share({ title: `Mi viaje a ${city}`, text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShared('Copiamos tu plan: pégalo en WhatsApp o en un correo.')
    } catch (error) {
      // Cerrar el menú de compartir no es un error.
      if ((error as Error).name !== 'AbortError') setShared('No pudimos compartir el plan desde este navegador.')
    }
  }

  function downloadCalendar() {
    const blob = new Blob([itineraryToIcs(itinerary)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href: url, download: icsFileName(itinerary) })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const button =
    'inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2'

  return (
    <section aria-labelledby="plan-summary-title" className="locus-print rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <p className="hidden text-sm font-semibold text-muted print:block">LOCUS · Tu plan de viaje por Colombia</p>
      <h2 id="plan-summary-title" className="text-2xl font-semibold text-navy">
        Tu plan en {city}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {formatDateRange(trip.startDate, trip.endDate)} · {itinerary.days.length}{' '}
        {itinerary.days.length === 1 ? 'día' : 'días'} · {places} lugares · {trip.travelers}{' '}
        {trip.travelers === 1 ? 'viajero' : 'viajeros'} · presupuesto {formatCOP(trip.budgetCOP)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={button}>
          <FileDown aria-hidden="true" className="size-4" />
          Descargar PDF
        </button>
        <button type="button" onClick={share} className={button}>
          <Share2 aria-hidden="true" className="size-4" />
          Compartir
        </button>
        <button type="button" onClick={downloadCalendar} className={button}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Agregar al calendario
        </button>
      </div>
      <p className="mt-2 min-h-5 text-sm text-ink print:hidden" aria-live="polite">
        {shared && (
          <span className="inline-flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-teal-soft" />
            {shared}
          </span>
        )}
      </p>

      <ol className="mt-4 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {itinerary.days.map((day) => (
          <li key={day.day} className="break-inside-avoid rounded-2xl bg-surface-2 p-4 print:border print:border-line">
            <h3 className="font-sans text-base font-semibold text-ink">{dayTitle(day)}</h3>
            {day.excursion && (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <MapPinned aria-hidden="true" className="size-3.5 text-teal-soft" />
                {day.excursion.tagline}
              </p>
            )}
            {day.places.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Día libre para recorrer a tu ritmo.</p>
            ) : (
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                {stopsByPart(day).map(([part, names]) => (
                  <div key={part} className="flex gap-2">
                    <dt className="w-16 shrink-0 font-semibold text-muted">{part}</dt>
                    <dd className="text-ink">{names.join(' → ')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 hidden text-xs text-muted print:block">
        Lugares de OpenStreetMap. Distancias en línea recta; revisa horarios y precios antes de ir. Planeado con LOCUS ·
        locus-bb57e.firebaseapp.com
      </p>
    </section>
  )
}
