/**
 * PASO 3 · "Tu itinerario"
 *
 * Arma el plan día a día con el motor de Locus (planItinerary): lugares reales
 * de OpenStreetMap para las actividades elegidas, repartidos entre los días y
 * ordenados con la heurística del vecino más cercano.
 *
 * - Pestañas por día (patrón "tabs" accesible: flechas izquierda/derecha).
 * - Cada día: mapa con la ruta numerada (MapLibre, carga diferida) y la lista
 *   de paradas con la distancia desde la anterior.
 * - Mientras busca: marcadores de carga. Si falla: mensaje y "Reintentar".
 * - Las paradas se agrupan en mañana, tarde y noche, y cada una se puede
 *   quitar o cambiar por otra de la misma actividad (con "Deshacer").
 */
import {
  ArrowLeft,
  CalendarDays,
  Coffee,
  ExternalLink,
  Gauge,
  MapPin,
  MapPinned,
  Moon,
  Navigation,
  RefreshCw,
  Route,
  Shuffle,
  Sparkles,
  Sun,
  Sunset,
  Trash,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { BudgetCard } from '../components/BudgetCard'
import { WeatherChip } from '../components/ItineraryView'
import { Alert } from '../components/ui'
import { CATEGORY_ICONS } from '../components/choiceOptions'
import { findFeaturedNear } from '../lib/featuredDestinations'
import { alternativeFor, dayParts, DAY_PART_LABELS, removeStop, replaceStop, type DayPart } from '../lib/flow/editItinerary'
import { formatDayTab, formatDistance, googleMapsRouteUrl, legDistancesKm, osmPlaceUrl } from '../lib/flow/itineraryView'
import { PACES } from '../lib/flow/pace'
import {
  daysForExtra,
  estimateTripBudget,
  extrasForDay,
  fitItineraryToBudget,
  moveExtra,
  removeExtra,
  spareSuggestions,
  venueMapUrl,
} from '../lib/flow/tripBudget'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { useDestinationPhotos } from '../lib/flow/useDestinationPhotos'
import { useItinerary } from '../lib/flow/useItinerary'
import { countTripDays, formatCOP, formatDateRange, formatDuration } from '../lib/format'
import { CATEGORIES } from '../lib/itinerary/categories'
import { allPlacesNear, placesSource } from '../lib/itinerary/fallbackClient'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useAsync } from '../lib/useAsync'
import { fetchForecast, type DailyForecast } from '../lib/weather/openMeteo'
import type { TripDetails } from '../types/flow'
import type { BudgetExtra, DayPlan, Itinerary } from '../types/itinerary'

const DayMap = lazy(() => import('../components/DayMap'))

export function ItineraryStep() {
  const { t } = useI18n()
  const { trip, categories, pace, excursions, goToStep, itinerary: savedItinerary, setItinerary } = useTripFlow()
  const { state, retry } = useItinerary(trip, categories, pace, excursions)
  const generated = state.status === 'done' ? state.itinerary : null
  // El plan siempre llega ajustado al presupuesto (hospedaje, comida, paradas pagas…).
  const ready = useMemo(() => (generated && trip ? fitItineraryToBudget(generated, trip) : null), [generated, trip])
  // El Paso 4 (guardar) lee el plan desde el contexto del flujo. Si el usuario
  // lo editó (quitar o cambiar paradas), se muestra y se guarda esa versión.
  const shown = ready && savedItinerary?.generatedAt === ready.generatedAt ? savedItinerary : ready
  useEffect(() => {
    if (ready && savedItinerary?.generatedAt !== ready.generatedAt) setItinerary(ready)
  }, [ready, savedItinerary, setItinerary])
  const [history, setHistory] = useState<Itinerary[]>([])
  const [notice, setNotice] = useState('')
  function applyEdit(next: Itinerary, message: string) {
    if (!shown) return
    setHistory((h) => [...h, shown])
    setItinerary(next)
    setNotice(message)
  }
  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setItinerary(previous)
    setNotice(t('it.undone'))
  }
  const photos = useDestinationPhotos(trip?.destination ?? null)
  if (!trip) return null

  const days = countTripDays(trip.startDate, trip.endDate)
  const [placeName] = trip.destination.displayName.split(',').map((part) => part.trim())
  const featured = findFeaturedNear(trip.destination)
  const headerPhoto = featured?.image ?? (photos.status === 'done' ? photos.photos.city?.url : undefined)

  return (
    <section aria-labelledby="step-title" className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="relative isolate flex min-h-36 items-end sm:min-h-44">
        {headerPhoto ? (
          <img src={headerPhoto} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-navy to-teal-soft" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
        <div className="w-full p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">{t('it.step3')}</p>
          <h1
            id="step-title"
            tabIndex={-1}
            className="mt-1 font-serif text-3xl font-semibold leading-tight text-white focus:outline-none sm:text-4xl"
          >
            {t('it.yourPlanIn', { place: placeName })}
          </h1>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatDateRange(trip.startDate, trip.endDate)} · {t('act.daysCount', { count: days })}
            </li>
            <li className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4" />
              {t('act.travelersCount', { count: trip.travelers })}
            </li>
            <li className="flex items-center gap-1.5">
              <Gauge aria-hidden="true" className="size-4" />
              {t('it.pace', { pace: PACES[pace].label.toLowerCase() })}
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div aria-live="polite" aria-busy={state.status === 'loading'}>
          {state.status === 'loading' && <LoadingPlan placeName={placeName} />}
          {state.status === 'error' && (
            <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
              <p className="flex items-start gap-2 font-semibold text-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
                {t('it.errorTitle')}
              </p>
              <p className="mt-1 text-sm text-muted">{state.message}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {state.code !== 'NO_PLACES' && (
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2.5 font-semibold text-on-coral transition hover:brightness-95"
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    {t('common.retry')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-ink transition-colors hover:bg-surface-2"
                >
                  {t('it.changeActivities')}
                </button>
              </div>
            </div>
          )}
          {shown && (
            <PlanView
              itinerary={shown}
              trip={trip}
              onEdit={applyEdit}
              onUndo={history.length > 0 ? undo : undefined}
              notice={notice}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('it.changeActivities')}
          </button>
          <button
            type="button"
            onClick={() => goToStep(1)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {t('it.changeDestination')}
          </button>
          {ready && (
            <button
              type="button"
              onClick={() => goToStep(4)}
              className="inline-flex items-center gap-2 rounded-xl bg-coral px-5 py-3 font-semibold text-on-coral transition hover:brightness-95 sm:ml-auto"
            >
              {t('it.continue')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function LoadingPlan({ placeName }: { placeName: string }) {
  const { t } = useI18n()
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Route aria-hidden="true" className="size-4 animate-pulse text-teal-soft" />
        {t('it.loading', { place: placeName })}
      </p>
      <div aria-hidden="true" className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-10 w-24 animate-pulse rounded-full bg-surface-2" />
        ))}
      </div>
      <div aria-hidden="true" className="mt-4 h-72 animate-pulse rounded-2xl bg-surface-2 sm:h-96" />
      <div aria-hidden="true" className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-16 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

interface PlanViewProps {
  itinerary: Itinerary
  trip: TripDetails
  onEdit: (next: Itinerary, message: string) => void
  onUndo?: () => void
  /** Mensaje del último cambio (se anuncia a lectores de pantalla). */
  notice: string
}

function PlanView({ itinerary, trip, onEdit, onUndo, notice }: PlanViewProps) {
  const { t } = useI18n()
  // Se recalcula al quitar o cambiar paradas.
  const budget = useMemo(() => estimateTripBudget(itinerary, trip), [itinerary, trip])
  // Lugares de todas las actividades cerca del destino (ya buscados desde el Paso 1):
  // le dan un lugar real a cada plan extra (el restaurante de la cena, el muelle de la lancha…).
  const { lat: destLat, lon: destLon, radiusMeters } = trip.destination
  const nearby = useAsync(
    () => allPlacesNear({ lat: destLat, lon: destLon }, radiusMeters),
    [destLat, destLon, radiusMeters],
  )
  const spare = useMemo(
    () => spareSuggestions(itinerary, trip, 12, nearby.data ?? []),
    [itinerary, trip, nearby.data],
  )
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const totalPlaces = itinerary.days.reduce((sum, d) => sum + d.places.length, 0)
  const cityDays = itinerary.days.filter((d) => !d.excursion).length
  const { stats } = itinerary
  const savedKm = Math.max(0, stats.unoptimizedKm - stats.optimizedKm)
  const day = itinerary.days[Math.min(selected, itinerary.days.length - 1)]
  const { lat, lon } = itinerary.destination
  const weather = useAsync(() => fetchForecast(lat, lon, 16), [lat, lon])
  const forecastByDate = useMemo(
    () => new Map((weather.data?.daily ?? []).map((f) => [f.date, f])),
    [weather.data],
  )

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = itinerary.days.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Resumen */}
      <dl className={`grid grid-cols-2 gap-3 ${stats.savingPercent > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <Stat label={t('it.places')} value={String(totalPlaces)} />
        <Stat
          label={t('it.totalDistance')}
          value={formatDistance(stats.optimizedKm)}
          hint={cityDays < itinerary.days.length ? t('it.straightCity', { city: itinerary.destination.displayName.split(',')[0] }) : t('it.straight')}
        />
        {/* Solo si la optimización acortó el recorrido frente al orden sin optimizar. */}
        {stats.savingPercent > 0 && (
          <Stat
            label={t('it.optimized')}
            value={`−${stats.savingPercent}%`}
            hint={t('it.lessThan', { distance: formatDistance(savedKm) })}
          />
        )}
        <Stat
          label={t('it.estimatedCost')}
          value={formatCOP(budget.total)}
          hint={t(budget.status === 'falta' ? 'it.overBudget' : 'it.withinBudget', { budget: formatCOP(budget.budget) })}
        />
      </dl>

      {placesSource.last !== 'live' && (
        <Alert tone="info">
          {t(placesSource.last === 'static' ? 'it.fallbackStatic' : 'it.fallbackAlt')}
        </Alert>
      )}

      {itinerary.missingCategories.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-4 text-sm text-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal-soft" />
          {t('it.missing', { categories: itinerary.missingCategories.map((c) => CATEGORIES[c].label.toLowerCase()).join(t('it.missingJoin')) })}
        </p>
      )}

      {/* Pestañas de días */}
      <div>
        <div role="tablist" aria-label={t('it.tripDays')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {itinerary.days.map((d, i) => {
            const active = d === day
            return (
              <button
                key={d.day}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                id={`day-tab-${d.day}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`day-panel-${d.day}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`shrink-0 rounded-full border px-4 py-2 text-left transition-colors ${
                  active ? 'border-navy bg-navy text-surface' : 'border-line text-ink hover:bg-surface-2'
                }`}
              >
                <span className="block text-sm font-semibold">{t('it.day', { day: d.day })}</span>
                <span className={`block text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{formatDayTab(d.date)}</span>
                {d.excursion && (
                  <span className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${active ? 'text-white' : 'text-teal-soft'}`}>
                    <MapPinned aria-hidden="true" className="size-3" />
                    {d.excursion.name}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-3 text-sm" aria-live="polite">
          {notice && <span className="text-ink">{notice}</span>}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-teal-soft hover:bg-surface-2"
            >
              <Undo2 aria-hidden="true" className="size-4" />
              {t('it.undo')}
            </button>
          )}
        </div>

        <DayPanel
          key={day.day}
          day={day}
          dayIndex={itinerary.days.indexOf(day)}
          itinerary={itinerary}
          forecast={forecastByDate.get(day.date)}
          onEdit={onEdit}
        />
      </div>

      <BudgetCard
        estimate={budget}
        travelers={trip.travelers}
        adjustments={itinerary.budgetPlan?.adjustments ?? []}
        spare={spare}
        extras={itinerary.budgetPlan?.extras ?? []}
        onRemoveExtra={(extra) => onEdit(removeExtra(itinerary, extra.id), t('it.removedExtra', { title: extra.title }))}
        onAddSpare={(option) =>
          onEdit(
            option.result,
            option.type === 'mejora' ? t('it.done', { title: option.title.toLowerCase() }) : t('it.added', { title: option.title }),
          )
        }
        // Si ni con todos los ajustes alcanza, volver a ajustar no sirve: se muestran las ideas.
        onFit={itinerary.budgetPlan?.fits === false ? undefined : () => onEdit(fitItineraryToBudget(itinerary, trip), t('it.fitted'))}
      />

      <p className="text-xs text-muted">
        {t('it.osmNote')}
      </p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-navy">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  )
}

const DAY_PART_ICONS: Record<DayPart, typeof Sun> = { mañana: Sun, tarde: Sunset, noche: Moon }

interface DayPanelProps {
  day: DayPlan
  dayIndex: number
  itinerary: Itinerary
  forecast?: DailyForecast
  onEdit: (next: Itinerary, message: string) => void
}

function DayPanel({ day, dayIndex, itinerary, forecast, onEdit }: DayPanelProps) {
  const { t } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  // En un día de excursión el recorrido sale del centro del pueblo.
  const start = day.excursion ?? itinerary.destination
  const startName = day.excursion?.name ?? itinerary.destination.displayName.split(',')[0]
  const cityName = itinerary.destination.displayName.split(',')[0]
  const legs = legDistancesKm(start, day.places)
  const routeUrl = googleMapsRouteUrl(start, day.places)
  const parts = dayParts(day.places)
  const extras = extrasForDay(itinerary, dayIndex)
  const fullDay = extras.some((e) => e.part === 'todo el día')

  return (
    <div
      id={`day-panel-${day.day}`}
      role="tabpanel"
      aria-labelledby={`day-tab-${day.day}`}
      tabIndex={0}
      className="mt-4 focus:outline-none"
    >
      {forecast && (
        <div className="mb-3">
          <WeatherChip forecast={forecast} />
        </div>
      )}
      {day.excursion && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-teal/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold text-ink">
              <MapPinned aria-hidden="true" className="size-4 text-teal-soft" />
              {t('it.excursion', { name: day.excursion.name })}
            </p>
            <p className="text-sm text-ink">{day.excursion.tagline}</p>
            <p className="text-xs text-muted">
              {day.excursion.region} ·{' '}
              {day.excursion.driveMinutes !== undefined
                ? t('it.excursionDrive', { duration: formatDuration(day.excursion.driveMinutes), city: cityName })
                : t('it.excursionStraight', { km: day.excursion.distanceKm, city: cityName })}
            </p>
          </div>
          <a
            href={googleMapsRouteUrl(itinerary.destination, [day.excursion], 'driving') ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-teal-soft underline-offset-2 hover:underline"
          >
            <Navigation aria-hidden="true" className="size-4" />
            {t('it.directionsFrom', { city: cityName })}
            <span className="sr-only">{t('common.newTabHint')}</span>
          </a>
        </div>
      )}
      {fullDay ? null : day.places.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl border border-dashed border-line p-5 text-ink">
          <Coffee aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-soft" />
          {day.excursion
            ? t('it.noPlacesTown', { name: day.excursion.name })
            : t('it.freeDay', { name: startName })}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line">
            <Suspense fallback={<div className="h-72 animate-pulse bg-surface-2 sm:h-96" />}>
              <DayMap start={start} places={day.places} label={t('it.dayMap', { day: day.day })} activeId={activeId} />
            </Suspense>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-lg font-semibold text-ink">
              {t('common.stops', { count: day.places.length })} ·{' '}
              <span className="font-normal text-muted">{t('it.inTotal', { distance: formatDistance(day.distanceKm) })}</span>
            </h2>
            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-soft underline-offset-2 hover:underline"
              >
                <Navigation aria-hidden="true" className="size-4" />
                {t('it.openRoute')}
                <span className="sr-only">{t('common.newTabHint')}</span>
              </a>
            )}
          </div>

          <ol className="mt-3 flex flex-col">
            <li className="flex items-center gap-3 pb-3 text-sm text-muted">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center">
                <span className="size-3.5 rounded-full border-[3px] border-white bg-teal ring-4 ring-teal/30" />
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {t('it.startFrom', { name: startName })}
              </span>
            </li>
            {day.places.map((place, i) => {
              const Icon = CATEGORY_ICONS[place.category]
              return (
                <li key={place.id} className="relative">
                  {parts[i] !== parts[i - 1] && <DayPartHeading part={parts[i]} />}
                  <p className="mb-2 ml-11 text-xs text-muted">
                    {formatDistance(legs[i])} {i === 0 ? t('it.fromCenter') : t('it.fromPrevious')}
                  </p>
                  <div
                    onMouseEnter={() => setActiveId(place.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(place.id)}
                    onBlur={() => setActiveId(null)}
                    className="mb-3 flex items-start gap-3 rounded-2xl border border-line p-3 transition-colors hover:border-teal/60"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        <span className="sr-only">{t('it.stopN', { n: i + 1 })} </span>
                        {place.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                        <Icon aria-hidden="true" className="size-4 shrink-0 text-teal-soft" />
                        {place.kind} · {CATEGORIES[place.category].label}
                      </p>
                    </div>
                    <a
                      href={osmPlaceUrl(place)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                      <span className="sr-only">{t('it.viewOnOsm', { name: place.name })} {t('common.newTabHint')}</span>
                    </a>
                  </div>
                  <StopActions itinerary={itinerary} dayIndex={dayIndex} placeIndex={i} onEdit={onEdit} />
                </li>
              )
            })}
          </ol>
        </>
      )}
      {extras.length > 0 && <DayExtras extras={extras} itinerary={itinerary} onEdit={onEdit} />}
    </div>
  )
}

/** Planes extra del día (tour, cena, lancha…): sin punto en el mapa, con su momento del día. */
function DayExtras({
  extras,
  itinerary,
  onEdit,
}: {
  extras: BudgetExtra[]
  itinerary: Itinerary
  onEdit: (next: Itinerary, message: string) => void
}) {
  const { t } = useI18n()
  return (
    <section aria-label={t('it.extrasLabel')} className="mt-2 flex flex-col gap-3">
      {extras.map((extra) => {
        const part = extra.part ?? 'tarde'
        const Icon = part === 'todo el día' ? Sparkles : DAY_PART_ICONS[part]
        const days = daysForExtra(itinerary, part, extra.id)
        return (
          <div key={extra.id} className="rounded-2xl border border-teal/50 bg-teal/10 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-soft">
              <Icon aria-hidden="true" className="size-4" />
              {t('it.extraPlan', { part: t(`it.part.${part}`) })}
            </p>
            <p className="mt-1 font-semibold text-ink">{extra.title}</p>
            {extra.venue && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-teal-soft" />
                <span>
                  {extra.venue.role}: <strong className="font-semibold">{extra.venue.name}</strong>
                  <span className="text-muted"> · {extra.venue.kind}</span>
                </span>
                <a
                  href={venueMapUrl(extra.venue, itinerary.destination.displayName.split(',')[0])}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal-soft underline-offset-2 hover:underline"
                >
                  {t('it.viewOnMap')}<span className="sr-only"> {t('common.newTabHint')}</span>
                </a>
              </p>
            )}
            <p className="text-sm text-muted">
              {t('it.inTotal', { distance: formatCOP(extra.amount) })}
              {extra.replaced?.length ? ` · ${t('it.takesDay', { count: extra.replaced.length })}` : ''}
              {extra.covers ? ` · ${t('it.replacesStop', { name: extra.covers.place.name })}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                {t('it.dayLabel')}
                <select
                  value={extra.dayIndex}
                  onChange={(e) => {
                    const to = Number(e.target.value)
                    onEdit(moveExtra(itinerary, extra.id, to), t('it.movedExtra', { title: extra.title, day: to + 1 }))
                  }}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink"
                >
                  {days.map((i) => (
                    <option key={i} value={i}>
                      {t('it.day', { day: i + 1 })} · {formatDayTab(itinerary.days[i].date)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => onEdit(removeExtra(itinerary, extra.id), t('it.removedExtraQuoted', { title: extra.title }))}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {t('it.remove')}
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function DayPartHeading({ part }: { part: DayPart }) {
  const Icon = DAY_PART_ICONS[part]
  return (
    <h3 className="mb-2 ml-11 flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
      <Icon aria-hidden="true" className="size-3.5" />
      {DAY_PART_LABELS[part]}
    </h3>
  )
}

/** "Cambiar" (por otro lugar de la misma actividad) y "Quitar" de cada parada. */
function StopActions({
  itinerary,
  dayIndex,
  placeIndex,
  onEdit,
}: {
  itinerary: Itinerary
  dayIndex: number
  placeIndex: number
  onEdit: (next: Itinerary, message: string) => void
}) {
  const day = itinerary.days[dayIndex]
  const place = day.places[placeIndex]
  const next = alternativeFor(itinerary, dayIndex, placeIndex)
  const { t } = useI18n()
  return (
    <div className="-mt-2 mb-3 ml-11 flex gap-1">
      <button
        type="button"
        disabled={!next}
        title={next ? t('it.swapFor', { name: next.name }) : t('it.noAlternative')}
        onClick={() => {
          const changed = replaceStop(itinerary, dayIndex, placeIndex)
          if (changed && next) onEdit(changed, t('it.swapped', { from: place.name, to: next.name }))
        }}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Shuffle aria-hidden="true" className="size-3.5" />
        {t('it.change')}<span className="sr-only"> {place.name}</span>
      </button>
      <button
        type="button"
        onClick={() => onEdit(removeStop(itinerary, dayIndex, placeIndex), t('it.removedStop', { name: place.name, day: day.day }))}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-danger"
      >
        <Trash aria-hidden="true" className="size-3.5" />
        {t('it.remove')}<span className="sr-only"> {place.name}</span>
      </button>
    </div>
  )
}
