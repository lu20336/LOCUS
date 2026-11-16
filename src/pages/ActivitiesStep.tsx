/**
 * PASO 2 · "¿Qué te gustaría hacer?"
 *
 * El usuario elige las actividades (categorías de lugares que el motor buscará
 * en OpenStreetMap) y el ritmo del viaje (lugares por día). Al continuar se
 * guardan en el estado del flujo y se pasa al Paso 3 (itinerario).
 *
 * - Si el destino vino del Modo B, las actividades elegidas al buscarlo ya
 *   aparecen marcadas.
 * - Solo se pueden elegir las actividades que existen cerca del destino
 *   (useActivityCounts): en Bogotá no hay "Playa". Cada tarjeta dice cuántos
 *   lugares hay y, en los destinos destacados, muestra una foto de ese lugar.
 * - Las tarjetas de actividad son checkboxes nativos (teclado y lector de
 *   pantalla funcionan sin código extra); el ritmo, radios nativos.
 */
import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Users } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { ACTIVITY_IMAGES, CATEGORY_DESCRIPTIONS, CATEGORY_ICONS } from '../components/choiceOptions'
import { findFeaturedNear } from '../lib/featuredDestinations'
import { PACE_IDS, PACES } from '../lib/flow/pace'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { useActivityCounts } from '../lib/flow/useActivityCounts'
import { countTripDays, formatDateRange } from '../lib/format'
import { CATEGORIES, CATEGORY_IDS } from '../lib/itinerary/categories'
import type { TripPace } from '../types/flow'
import type { CategoryId } from '../types/itinerary'

const ERROR_ID = 'activities-error'

/** "1 lugar cerca", "54 lugares cerca", "Más de 100 lugares cerca". */
function placesNearLabel(count: number): string {
  if (count >= 100) return 'Más de 100 lugares cerca'
  return `${count} ${count === 1 ? 'lugar' : 'lugares'} cerca`
}

export function ActivitiesStep() {
  const { trip, categories: savedCategories, pace: savedPace, completeActivities, goToStep } = useTripFlow()
  const [selected, setSelected] = useState<CategoryId[]>(savedCategories)
  const [pace, setPace] = useState<TripPace>(savedPace)
  const [showError, setShowError] = useState(false)
  const firstCheckbox = useRef<HTMLInputElement | null>(null)
  const availability = useActivityCounts(trip?.destination ?? null)

  if (!trip) return null

  const days = countTripDays(trip.startDate, trip.endDate)
  const [placeName, ...region] = trip.destination.displayName.split(',').map((part) => part.trim())
  const featured = findFeaturedNear(trip.destination)
  const placesPerDay = PACES[pace].placesPerDay
  const fromSuggestion = trip.mode === 'suggested' && savedCategories.length > 0

  /**
   * Solo se muestran las actividades que existen cerca del destino. Si no se
   * pudo revisar, se muestran todas (mejor dejar elegir que bloquear el viaje).
   */
  const found = availability.status === 'ready' ? CATEGORY_IDS.filter((c) => availability.counts[c] > 0) : []
  // Si no hay ninguna registrada cerca (pueblos pequeños), mejor dejar elegir que mostrar una lista vacía.
  const nothingFound = availability.status === 'ready' && found.length === 0
  const isAvailable = (category: CategoryId) => availability.status !== 'ready' || nothingFound || found.includes(category)
  const visible = CATEGORY_IDS.filter(isAvailable)
  // Lo elegido antes que no exista en este destino se descarta (ej. cambió de destino).
  const chosen = visible.filter((c) => selected.includes(c))

  function toggle(category: CategoryId, checked: boolean) {
    setSelected((current) => (checked ? [...current, category] : current.filter((c) => c !== category)))
    setShowError(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (chosen.length === 0) {
      setShowError(true)
      firstCheckbox.current?.focus()
      return
    }
    completeActivities(chosen, pace)
  }

  return (
    <section aria-labelledby="step-title" className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      {/* Encabezado: el destino del viaje, con su foto si es uno de los destacados. */}
      <div className="relative isolate flex min-h-40 items-end sm:min-h-48">
        {featured ? (
          <img src={featured.image} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-navy to-teal-soft" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
        <div className="w-full p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Tu viaje a</p>
          <p className="mt-1 font-serif text-3xl font-semibold leading-tight text-white">{placeName}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            {region.length > 0 && (
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {region.filter((part) => part !== 'Colombia').join(', ') || 'Colombia'}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatDateRange(trip.startDate, trip.endDate)} · {days} {days === 1 ? 'día' : 'días'}
            </li>
            <li className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4" />
              {trip.travelers} {trip.travelers === 1 ? 'viajero' : 'viajeros'}
            </li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8 p-6 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Paso 2 de 4</p>
          <h1 id="step-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
            ¿Qué te gustaría hacer en {placeName}?
          </h1>
          <p className="mt-2 text-muted">
            Elige una o varias actividades. Buscaremos lugares reales de cada una y armaremos la ruta que menos te
            haga recorrer.
          </p>
          {fromSuggestion && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal/10 px-3 py-2 text-sm text-ink">
              <Check aria-hidden="true" className="size-4 shrink-0 text-teal-soft" />
              Marcamos las que elegiste al buscar tu destino. Puedes cambiarlas.
            </p>
          )}
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            {availability.status === 'loading' && 'Revisando qué hay cerca de tu destino…'}
            {availability.status === 'ready' &&
              (nothingFound
                ? `No encontramos actividades registradas a menos de 7 km de ${placeName}; elige las que prefieras y buscaremos un poco más lejos.`
                : `Te mostramos lo que encontramos a menos de 7 km de ${placeName}.`)}
            {availability.status === 'unknown' &&
              'No pudimos revisar qué hay cerca de tu destino; elige las actividades que prefieras.'}
          </p>
        </div>

        {/* Actividades */}
        <fieldset aria-describedby={showError ? ERROR_ID : undefined} aria-invalid={showError}>
          <legend className="text-lg font-semibold text-ink">
            Actividades <span className="text-sm font-normal text-muted">· puedes elegir varias</span>
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {availability.status === 'loading'
              ? // Tarjetas de carga: así no aparecen opciones que luego desaparecen.
                CATEGORY_IDS.map((category) => (
                  <span key={category} aria-hidden="true" className="h-44 animate-pulse rounded-2xl bg-surface-2 sm:h-48" />
                ))
              : visible.map((category, index) => {
                  const Icon = CATEGORY_ICONS[category]
                  const checked = chosen.includes(category)
                  const count = availability.status === 'ready' ? availability.counts[category] : null
                  return (
                    <label
                      key={category}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md has-checked:border-teal has-checked:ring-2 has-checked:ring-teal has-focus-visible:ring-2 has-focus-visible:ring-teal-soft has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface"
                    >
                      <input
                        ref={index === 0 ? firstCheckbox : undefined}
                        type="checkbox"
                        name="categories"
                        value={category}
                        checked={checked}
                        onChange={(e) => toggle(category, e.target.checked)}
                        aria-describedby={count ? `count-${category}` : undefined}
                        className="peer sr-only"
                      />
                      <span className="relative block h-24 overflow-hidden sm:h-28">
                        <img
                          // Foto de esa actividad EN el destino, si la tenemos; si no, una genérica.
                          src={featured?.activityImages?.[category] ?? ACTIVITY_IMAGES[category]}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {/* Marca de "elegida" sobre la foto. */}
                        <span
                          aria-hidden="true"
                          className={`absolute right-2 top-2 grid size-7 place-items-center rounded-full border-2 text-white backdrop-blur-sm transition ${
                            checked ? 'border-teal bg-teal' : 'border-white bg-black/25'
                          }`}
                        >
                          {checked && <Check className="size-4" strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5 p-3">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          <Icon aria-hidden="true" className="size-4 shrink-0 text-teal-soft" />
                          {CATEGORIES[category].label}
                        </span>
                        <span className="text-xs leading-snug text-muted">{CATEGORY_DESCRIPTIONS[category]}</span>
                        {count !== null && count > 0 && (
                          <span id={`count-${category}`} className="mt-1 text-xs font-semibold text-teal-soft">
                            {placesNearLabel(count)}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
          </div>
          {showError && (
            <p id={ERROR_ID} role="alert" className="mt-3 text-sm font-medium text-danger">
              Elige al menos una actividad para armar tu itinerario.
            </p>
          )}
        </fieldset>

        {/* Ritmo */}
        <fieldset>
          <legend className="text-lg font-semibold text-ink">Ritmo del viaje</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {PACE_IDS.map((id) => (
              <label
                key={id}
                className="flex cursor-pointer flex-col gap-0.5 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal/10 has-focus-visible:ring-2 has-focus-visible:ring-teal-soft has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface"
              >
                <input
                  type="radio"
                  name="pace"
                  value={id}
                  checked={pace === id}
                  onChange={() => setPace(id)}
                  className="sr-only"
                />
                <span className="font-semibold text-ink">{PACES[id].label}</span>
                <span className="text-sm text-ink">{PACES[id].placesPerDay} lugares por día</span>
                <span className="text-xs text-muted">{PACES[id].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Resumen y acciones */}
        <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            {chosen.length === 0
              ? 'Aún no has elegido actividades.'
              : `Tu plan: ${days} ${days === 1 ? 'día' : 'días'} × ${placesPerDay} lugares ≈ ${days * placesPerDay} lugares para visitar.`}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Editar mi viaje
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-6 py-3 font-bold text-on-coral shadow-sm transition hover:brightness-105 active:brightness-95"
            >
              Generar itinerario
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
