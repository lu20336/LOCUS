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
 */
import {
  ArrowLeft,
  CalendarDays,
  Coffee,
  ExternalLink,
  Gauge,
  MapPin,
  Moon,
  Navigation,
  RefreshCw,
  Route,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { WeatherChip } from '../components/ItineraryView'
import { Alert } from '../components/ui'
import { CATEGORY_ICONS } from '../components/choiceOptions'
import { findFeaturedNear } from '../lib/featuredDestinations'
import { formatDayTab, formatDistance, googleMapsRouteUrl, legDistancesKm, osmPlaceUrl } from '../lib/flow/itineraryView'
import { PACES } from '../lib/flow/pace'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { useDestinationPhotos } from '../lib/flow/useDestinationPhotos'
import { useItinerary } from '../lib/flow/useItinerary'
import { countTripDays, formatCOP, formatDateRange } from '../lib/format'
import { CATEGORIES } from '../lib/itinerary/categories'
import { placesSource } from '../lib/itinerary/fallbackClient'
import { useAsync } from '../lib/useAsync'
import { fetchForecast, type DailyForecast } from '../lib/weather/openMeteo'
import type { DayPlan, Itinerary } from '../types/itinerary'

const DayMap = lazy(() => import('../components/DayMap'))

export function ItineraryStep() {
  const { trip, categories, pace, goToStep, itinerary: savedItinerary, setItinerary } = useTripFlow()
  const { state, retry } = useItinerary(trip, categories, pace)
  const ready = state.status === 'done' ? state.itinerary : null
  // El Paso 4 (guardar) lee el plan desde el contexto del flujo.
  useEffect(() => {
    if (ready && ready !== savedItinerary) setItinerary(ready)
  }, [ready, savedItinerary, setItinerary])
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Paso 3 de 4 · Itinerario</p>
          <h1
            id="step-title"
            tabIndex={-1}
            className="mt-1 font-serif text-3xl font-semibold leading-tight text-white focus:outline-none sm:text-4xl"
          >
            Tu plan en {placeName}
          </h1>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatDateRange(trip.startDate, trip.endDate)} · {days} {days === 1 ? 'día' : 'días'}
            </li>
            <li className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4" />
              {trip.travelers} {trip.travelers === 1 ? 'viajero' : 'viajeros'}
            </li>
            <li className="flex items-center gap-1.5">
              <Gauge aria-hidden="true" className="size-4" />
              Ritmo {PACES[pace].label.toLowerCase()}
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
                No pudimos armar tu itinerario
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
                    Reintentar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-ink transition-colors hover:bg-surface-2"
                >
                  Cambiar actividades
                </button>
              </div>
            </div>
          )}
          {state.status === 'done' && <PlanView itinerary={state.itinerary} budgetCOP={trip.budgetCOP} />}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Cambiar actividades
          </button>
          <button
            type="button"
            onClick={() => goToStep(1)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Cambiar destino o fechas
          </button>
          {ready && (
            <button
              type="button"
              onClick={() => goToStep(4)}
              className="inline-flex items-center gap-2 rounded-xl bg-coral px-5 py-3 font-semibold text-on-coral transition hover:brightness-95 sm:ml-auto"
            >
              Continuar: guardar y hospedaje →
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function LoadingPlan({ placeName }: { placeName: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Route aria-hidden="true" className="size-4 animate-pulse text-teal-soft" />
        Buscando lugares reales en {placeName} y armando la ruta más corta…
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

function PlanView({ itinerary, budgetCOP }: { itinerary: Itinerary; budgetCOP: number }) {
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const totalPlaces = itinerary.days.reduce((sum, d) => sum + d.places.length, 0)
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
        <Stat label="Lugares" value={String(totalPlaces)} />
        <Stat label="Recorrido total" value={formatDistance(stats.optimizedKm)} hint="en línea recta" />
        {/* Solo si la optimización acortó el recorrido frente al orden sin optimizar. */}
        {stats.savingPercent > 0 && (
          <Stat
            label="Ruta optimizada"
            value={`−${stats.savingPercent}%`}
            hint={`${formatDistance(savedKm)} menos que sin optimizar`}
          />
        )}
        <Stat label="Presupuesto por día" value={formatCOP(Math.round(budgetCOP / itinerary.days.length))} />
      </dl>

      {placesSource.last !== 'live' && (
        <Alert tone="info">
          El servicio principal de mapas está ocupado: armamos el plan con{' '}
          {placesSource.last === 'static' ? 'lugares guardados' : 'una fuente alternativa'} de OpenStreetMap (menos lugares y
          pueden no estar actualizados).
        </Alert>
      )}

      {itinerary.missingCategories.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-4 text-sm text-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal-soft" />
          No encontramos lugares de{' '}
          {itinerary.missingCategories.map((c) => CATEGORIES[c].label.toLowerCase()).join(' ni de ')} cerca de tu
          destino; el plan incluye las demás actividades.
        </p>
      )}

      {/* Pestañas de días */}
      <div>
        <div role="tablist" aria-label="Días del viaje" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                  active ? 'border-navy bg-navy text-white' : 'border-line text-ink hover:bg-surface-2'
                }`}
              >
                <span className="block text-sm font-semibold">Día {d.day}</span>
                <span className={`block text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{formatDayTab(d.date)}</span>
              </button>
            )
          })}
        </div>

        <DayPanel key={day.day} day={day} itinerary={itinerary} forecast={forecastByDate.get(day.date)} />
      </div>

      <p className="text-xs text-muted">
        Lugares de OpenStreetMap. Las distancias son en línea recta; los horarios y precios de cada lugar pueden
        cambiar, revísalos antes de ir.
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

function DayPanel({ day, itinerary, forecast }: { day: DayPlan; itinerary: Itinerary; forecast?: DailyForecast }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const start = itinerary.destination
  const legs = legDistancesKm(start, day.places)
  const routeUrl = googleMapsRouteUrl(start, day.places)
  const firstNight = day.places.findIndex((p) => p.category === 'vidaNocturna')

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
      {day.places.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl border border-dashed border-line p-5 text-ink">
          <Coffee aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-soft" />
          Día libre: no hubo más lugares para este día. Descansa o explora {start.displayName.split(',')[0]} a tu ritmo.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line">
            <Suspense fallback={<div className="h-72 animate-pulse bg-surface-2 sm:h-96" />}>
              <DayMap start={start} places={day.places} label={`Mapa del día ${day.day}`} activeId={activeId} />
            </Suspense>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-lg font-semibold text-ink">
              {day.places.length} {day.places.length === 1 ? 'parada' : 'paradas'} ·{' '}
              <span className="font-normal text-muted">{formatDistance(day.distanceKm)} en total</span>
            </h2>
            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-soft underline-offset-2 hover:underline"
              >
                <Navigation aria-hidden="true" className="size-4" />
                Abrir ruta en Google Maps
                <span className="sr-only">(se abre en otra pestaña)</span>
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
                Salida desde el centro de {start.displayName.split(',')[0]}
              </span>
            </li>
            {day.places.map((place, i) => {
              const Icon = CATEGORY_ICONS[place.category]
              return (
                <li key={place.id} className="relative">
                  {i === firstNight && (
                    <p className="mb-2 ml-11 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      <Moon aria-hidden="true" className="size-3.5" />
                      De noche
                    </p>
                  )}
                  <p className="mb-2 ml-11 text-xs text-muted">
                    {formatDistance(legs[i])} {i === 0 ? 'desde el centro' : 'desde la parada anterior'}
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
                        <span className="sr-only">Parada {i + 1}: </span>
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
                      <span className="sr-only">Ver {place.name} en OpenStreetMap (se abre en otra pestaña)</span>
                    </a>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
