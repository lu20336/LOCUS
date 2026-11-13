/**
 * Vista de un itinerario: días con lugares reales (OpenStreetMap), mapa con
 * los puntos y pronóstico del clima por día. Se usa en el planificador y en
 * los itinerarios guardados (con `onChange` se puede editar).
 */
import { useMemo, useState } from 'react'
import { CATEGORIES } from '../lib/itinerary/categories'
import { movePlace, removePlace, setDayNote } from '../lib/itinerary/itineraryStore'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { formatDate } from '../lib/format'
import { fetchForecast, rainRisk, type DailyForecast } from '../lib/weather/openMeteo'
import { useAsync } from '../lib/useAsync'
import type { DayPlan, Destination } from '../types/itinerary'
import { Badge } from './ui'

export interface ViewableItinerary {
  destination: Destination
  days: (DayPlan & { note?: string })[]
}

interface Props<T extends ViewableItinerary> {
  itinerary: T
  /** Si se pasa, la vista permite quitar/mover lugares y escribir notas. */
  onChange?: (next: T) => void
}

const riskTone = { bajo: 'teal', medio: 'warn', alto: 'danger' } as const

function WeatherChip({ forecast }: { forecast: DailyForecast }) {
  const risk = rainRisk(forecast)
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>
        Pronóstico: {forecast.description}, {Math.round(forecast.tMin)}–{Math.round(forecast.tMax)} °C
      </span>
      <Badge tone={riskTone[risk]}>Lluvia {risk} ({forecast.precipitationProbability}%)</Badge>
    </span>
  )
}

export function ItineraryView<T extends ViewableItinerary>({ itinerary, onChange }: Props<T>) {
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all')
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null)
  const { destination, days } = itinerary

  const weather = useAsync(() => fetchForecast(destination.lat, destination.lon, 16), [destination.lat, destination.lon])
  const forecastByDate = useMemo(() => new Map((weather.data?.daily ?? []).map((d) => [d.date, d])), [weather.data])

  const markers: MapMarker[] = useMemo(
    () =>
      days.flatMap((d, di) =>
        selectedDay === 'all' || selectedDay === di
          ? d.places.map((p, pi) => ({ id: p.id, lat: p.lat, lon: p.lon, label: `${d.day}·${pi + 1}`, kind: 'place' as const }))
          : [],
      ),
    [days, selectedDay],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por día">
          {(['all', ...days.map((_, i) => i)] as (number | 'all')[]).map((d) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => setSelectedDay(d)}
              aria-pressed={selectedDay === d}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                selectedDay === d ? 'border-teal bg-teal/15 text-ink' : 'border-line bg-surface text-ink hover:bg-surface-2'
              }`}
            >
              {d === 'all' ? 'Todos los días' : `Día ${d + 1}`}
            </button>
          ))}
        </div>

        {days.map((day, di) =>
          selectedDay === 'all' || selectedDay === di ? (
            <section key={day.date} aria-labelledby={`day-${day.day}`} className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`day-${day.day}`} className="text-xl font-semibold text-navy">
                  Día {day.day} · {formatDate(day.date)}
                </h3>
                <span className="text-sm text-muted">Recorrido en línea recta: {day.distanceKm} km</span>
              </div>
              {forecastByDate.get(day.date) && <div className="mt-1"><WeatherChip forecast={forecastByDate.get(day.date)!} /></div>}

              {day.places.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Este día quedó libre: no encontramos más lugares con tus actividades.</p>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {day.places.map((p, pi) => (
                    <li
                      key={p.id}
                      className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
                        selectedPlace === p.id ? 'border-teal bg-teal/10' : 'border-line bg-surface-2'
                      }`}
                    >
                      <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-surface">
                        {pi + 1}
                      </span>
                      <button type="button" onClick={() => setSelectedPlace(p.id)} className="min-w-0 flex-1 text-left">
                        <span className="block font-semibold text-ink">{p.name}</span>
                        <span className="block text-sm text-muted">
                          {p.kind} · {CATEGORIES[p.category].label}
                        </span>
                      </button>
                      <a
                        href={`https://www.openstreetmap.org/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs font-semibold text-teal-soft underline underline-offset-2"
                        aria-label={`Ver ${p.name} en OpenStreetMap`}
                      >
                        Ver en OSM
                      </a>
                      {onChange && (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Subir ${p.name}`}
                            disabled={pi === 0}
                            onClick={() => onChange(movePlace(itinerary, { day: di, place: pi }, { day: di, place: pi - 1 }))}
                            className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar ${p.name}`}
                            disabled={pi === day.places.length - 1}
                            onClick={() => onChange(movePlace(itinerary, { day: di, place: pi }, { day: di, place: pi + 1 }))}
                            className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"
                          >
                            ↓
                          </button>
                          {days.length > 1 && (
                            <select
                              aria-label={`Mover ${p.name} a otro día`}
                              value=""
                              onChange={(e) => e.target.value !== '' && onChange(movePlace(itinerary, { day: di, place: pi }, { day: Number(e.target.value) }))}
                              className="h-8 rounded-lg border border-line bg-surface px-1 text-xs"
                            >
                              <option value="">Mover a…</option>
                              {days.map((_, i) => i !== di && <option key={i} value={i}>Día {i + 1}</option>)}
                            </select>
                          )}
                          <button
                            type="button"
                            aria-label={`Quitar ${p.name}`}
                            onClick={() => onChange(removePlace(itinerary, di, pi))}
                            className="grid size-8 place-items-center rounded-lg border border-danger/40 text-danger"
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {onChange ? (
                <label className="mt-3 block text-sm font-semibold text-ink">
                  Notas del día
                  <textarea
                    value={day.note ?? ''}
                    onChange={(e) => onChange(setDayNote(itinerary, di, e.target.value))}
                    rows={2}
                    maxLength={500}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </label>
              ) : (
                day.note && <p className="mt-3 text-sm text-ink">📝 {day.note}</p>
              )}
            </section>
          ) : null,
        )}

        <p className="text-xs text-muted">
          Lugares de OpenStreetMap contributors. LOCUS no conoce horarios de apertura ni precios de estos lugares: confírmalos antes de ir. El pronóstico del clima es una estimación de{' '}
          <a href="https://open-meteo.com" className="underline" target="_blank" rel="noreferrer">Open-Meteo</a>.
        </p>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <LocusMap
          markers={markers}
          selectedId={selectedPlace}
          onSelect={setSelectedPlace}
          center={[destination.lat, destination.lon]}
          zoom={12}
          className="h-80 lg:h-[34rem]"
          ariaLabel={`Mapa del itinerario en ${destination.displayName.split(',')[0]}`}
        />
      </div>
    </div>
  )
}
