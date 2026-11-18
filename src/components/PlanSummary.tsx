/**
 * Paso 4 · Resumen del plan y cómo llevárselo:
 *   - Lista día por día (mañana, tarde, noche), con las excursiones.
 *   - "Descargar PDF": un PDF diseñado (itineraryPdf.ts), no la impresión del navegador.
 *   - "Compartir": menú del celular (Web Share API) o, si no existe, copia el
 *     texto para pegarlo en WhatsApp o un correo.
 *   - "Google Calendar": abre Google Calendar con el viaje ya escrito.
 *   - En el celular, "Calendario del iPhone / del celular": lo guarda en el
 *     calendario del teléfono (Calendario de iOS, Samsung Calendar…).
 */
import { CalendarPlus, Check, FileDown, LoaderCircle, MapPinned, Share2, Smartphone, Sparkles } from 'lucide-react'
import { useState } from 'react'
import {
  dayTitle,
  googleCalendarUrl,
  itineraryToIcs,
  itineraryToText,
  stopsByPart,
  tripEvent,
} from '../lib/flow/exportItinerary'
import { downloadItineraryPdf } from '../lib/flow/itineraryPdf'
import { extrasForDay, venueMapUrl } from '../lib/flow/tripBudget'
import { addToPhoneCalendar, detectPlatform, phoneCalendarLabel } from '../lib/flow/phoneCalendar'
import { formatCOP, formatDateRange } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import type { TripDetails } from '../types/flow'
import type { Itinerary } from '../types/itinerary'

export function PlanSummary({ itinerary, trip }: { itinerary: Itinerary; trip: TripDetails }) {
  const { t } = useI18n()
  const [shared, setShared] = useState<string | null>(null)
  const [makingPdf, setMakingPdf] = useState(false)
  const [platform] = useState(() => detectPlatform())
  const city = itinerary.destination.displayName.split(',')[0]
  const places = itinerary.days.reduce((n, d) => n + d.places.length, 0)

  async function share() {
    const text = itineraryToText(itinerary)
    try {
      if (navigator.share) {
        await navigator.share({ title: t('it.myTripTo', { place: city }), text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShared(t('sum.copied'))
    } catch (error) {
      // Cerrar el menú de compartir no es un error.
      if ((error as Error).name !== 'AbortError') setShared(t('sum.shareError'))
    }
  }

  async function downloadPdf() {
    setMakingPdf(true)
    try {
      await downloadItineraryPdf(itinerary, trip)
      setShared(t('sum.pdfDone'))
    } catch {
      setShared(t('sum.pdfError'))
    } finally {
      setMakingPdf(false)
    }
  }

  function saveToPhone() {
    const action = addToPhoneCalendar(platform, {
      event: tripEvent(itinerary),
      ics: itineraryToIcs(itinerary),
      fallbackUrl: googleCalendarUrl(itinerary),
    })
    setShared(
      action === 'ios-invite'
        ? t('sum.iosInvite')
        : action === 'android-intent'
          ? t('sum.androidIntent')
          : t('sum.googleOpened'),
    )
  }

  const button =
    'inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2'

  return (
    <section aria-labelledby="plan-summary-title" className="locus-print rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <p className="hidden text-sm font-semibold text-muted print:block">{t('sum.printHeader')}</p>
      <h2 id="plan-summary-title" className="text-2xl font-semibold text-navy">
        {t('it.yourPlanIn', { place: city })}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {formatDateRange(trip.startDate, trip.endDate)} · {t('act.daysCount', { count: itinerary.days.length })} · {t('common.places', { count: places })} · {t('act.travelersCount', { count: trip.travelers })} · {t('sum.budget', { budget: formatCOP(trip.budgetCOP) })}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={downloadPdf} disabled={makingPdf} className={button}>
          {makingPdf ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FileDown aria-hidden="true" className="size-4" />
          )}
          {makingPdf ? t('sum.makingPdf') : t('sum.downloadPdf')}
        </button>
        <button type="button" onClick={share} className={button}>
          <Share2 aria-hidden="true" className="size-4" />
          {t('sum.share')}
        </button>
        <a href={googleCalendarUrl(itinerary)} target="_blank" rel="noreferrer" className={button}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Google Calendar
          <span className="sr-only">{t('common.newTabHint')}</span>
        </a>
        {platform !== 'desktop' && (
          <button type="button" onClick={saveToPhone} className={button}>
            <Smartphone aria-hidden="true" className="size-4" />
            {phoneCalendarLabel(platform)}
          </button>
        )}
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
        {itinerary.days.map((day, dayIndex) => {
          const extras = extrasForDay(itinerary, dayIndex)
          return (
            <li key={day.day} className="break-inside-avoid rounded-2xl bg-surface-2 p-4 print:border print:border-line">
              <h3 className="font-sans text-base font-semibold text-ink">{dayTitle(day)}</h3>
              {day.excursion && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <MapPinned aria-hidden="true" className="size-3.5 text-teal-soft" />
                  {day.excursion.tagline}
                </p>
              )}
              {day.places.length === 0 && extras.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t('sum.freeDay')}</p>
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
              {extras.length > 0 && (
                <ul aria-label={t('sum.extras')} className="mt-2 flex flex-col gap-1.5">
                  {extras.map((extra) => (
                    <li key={extra.id} className="rounded-xl border border-teal/40 bg-teal/10 px-3 py-2 text-sm">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-soft">
                        <Sparkles aria-hidden="true" className="size-3.5" />
                        {t('it.extraPlan', { part: t(`it.part.${extra.part ?? 'tarde'}`) })}
                      </p>
                      <p className="font-semibold text-ink">{extra.title}</p>
                      {extra.venue && (
                        <p className="text-ink">
                          {extra.venue.role}:{' '}
                          <a
                            href={venueMapUrl(extra.venue, itinerary.destination.displayName.split(',')[0])}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-teal-soft underline-offset-2 hover:underline"
                          >
                            {extra.venue.name}
                            <span className="sr-only"> ({t('it.viewOnMap')}, {t('common.newTabHint').replace(/[()]/g, '')})</span>
                          </a>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 hidden text-xs text-muted print:block">
        {t('sum.printFooter')}
      </p>
    </section>
  )
}
