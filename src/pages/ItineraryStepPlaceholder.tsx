/**
 * PROVISIONAL · Paso 3 aún no construido.
 * Confirma lo elegido en los pasos 1 y 2 mientras se conecta el motor de
 * itinerarios (generateItinerary) y la vista día a día con mapa.
 */
import { ArrowLeft, CalendarDays, Gauge, Route } from 'lucide-react'
import { CATEGORY_ICONS } from '../components/choiceOptions'
import { PACES } from '../lib/flow/pace'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { countTripDays, formatDateRange } from '../lib/format'
import { CATEGORIES } from '../lib/itinerary/categories'

export function ItineraryStepPlaceholder() {
  const { trip, categories, pace, goToStep } = useTripFlow()
  if (!trip) return null
  const days = countTripDays(trip.startDate, trip.endDate)
  const placeName = trip.destination.displayName.split(',')[0]

  return (
    <section aria-labelledby="step-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 3 de 4</p>
      <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        Tu itinerario para {placeName}
      </h1>
      <p className="mt-2 text-muted">Con estas preferencias armaremos tu plan día a día:</p>

      <dl className="mt-6 grid gap-4 rounded-2xl bg-surface-2 p-5 sm:grid-cols-2">
        <div className="flex gap-3">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-soft" />
          <div>
            <dt className="text-sm text-muted">Fechas</dt>
            <dd className="font-semibold text-ink">
              {formatDateRange(trip.startDate, trip.endDate)} · {days} {days === 1 ? 'día' : 'días'}
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Gauge aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-soft" />
          <div>
            <dt className="text-sm text-muted">Ritmo</dt>
            <dd className="font-semibold text-ink">
              {PACES[pace].label} · {PACES[pace].placesPerDay} lugares por día
            </dd>
          </div>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Actividades</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category]
              return (
                <span key={category} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-ink">
                  <Icon aria-hidden="true" className="size-4 text-teal-soft" />
                  {CATEGORIES[category].label}
                </span>
              )
            })}
          </dd>
        </div>
      </dl>

      <p className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        <Route aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-soft" />
        Muy pronto verás aquí tu plan día a día, con el mapa y la ruta que menos te hace recorrer.
      </p>

      <button
        type="button"
        onClick={() => goToStep(2)}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Cambiar actividades
      </button>
    </section>
  )
}
