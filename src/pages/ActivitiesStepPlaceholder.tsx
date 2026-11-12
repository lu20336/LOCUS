/**
 * PROVISIONAL · Paso 2 aún no construido.
 * Muestra lo que guardó el Paso 1 en el estado del flujo, para comprobar que
 * el formulario quedó conectado. Se reemplazará por el selector de categorías.
 */
import { countTripDays, formatCOP, formatDate } from '../lib/format'
import { CATEGORIES } from '../lib/itinerary/categories'
import { useTripFlow } from '../lib/flow/tripFlowContext'

export function ActivitiesStepPlaceholder() {
  const { trip, categories, goToStep } = useTripFlow()
  if (!trip) return null
  const days = countTripDays(trip.startDate, trip.endDate)

  return (
    <section aria-labelledby="step-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 2 de 4</p>
      <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        ¿Qué te gustaría hacer?
      </h1>
      <p className="mt-2 text-muted">Este paso está en construcción. Esto es lo que guardamos de tu viaje:</p>

      <dl className="mt-6 grid gap-4 rounded-2xl bg-surface-2 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted">Destino</dt>
          <dd className="font-semibold text-ink">{trip.destination.displayName}</dd>
          <dd className="text-xs text-muted">
            {trip.destination.lat.toFixed(4)}, {trip.destination.lon.toFixed(4)} · radio de búsqueda{' '}
            {(trip.destination.radiusMeters / 1000).toFixed(1)} km
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Fechas</dt>
          <dd className="font-semibold text-ink">
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          </dd>
          <dd className="text-xs text-muted">
            {days} {days === 1 ? 'día' : 'días'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Presupuesto</dt>
          <dd className="font-semibold text-ink">{formatCOP(trip.budgetCOP)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Viajeros y habitaciones</dt>
          <dd className="font-semibold text-ink">
            {trip.travelers} {trip.travelers === 1 ? 'viajero' : 'viajeros'} · {trip.rooms}{' '}
            {trip.rooms === 1 ? 'habitación' : 'habitaciones'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Cómo elegiste el destino</dt>
          <dd className="font-semibold text-ink">
            {trip.mode === 'suggested' ? 'Modo B · Sugerencia por clima y actividades' : 'Modo A · Lo escribiste tú'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Actividades</dt>
          <dd className="font-semibold text-ink">
            {categories.length > 0
              ? categories.map((c) => CATEGORIES[c].label).join(', ')
              : 'Se elegirán en este paso'}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => goToStep(1)}
        className="mt-6 rounded-xl border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <span aria-hidden="true">← </span>Editar mi viaje
      </button>
    </section>
  )
}
