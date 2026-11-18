/**
 * Vista de un itinerario: días con lugares reales (OpenStreetMap), mapa con
 * los puntos y pronóstico del clima por día. Se usa en el planificador y en
 * los itinerarios guardados (con `onChange` se puede editar).
 */
import { useMemo, useState } from 'react'
import { osmPlaceUrl } from '../lib/flow/itineraryView'
import { CATEGORIES } from '../lib/itinerary/categories'
import { movePlace, removePlace, setDayNote } from '../lib/itinerary/itineraryStore'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { formatDate } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
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

export function WeatherChip({ forecast }: { forecast: DailyForecast }) {
  const { t } = useI18n()
  const risk = rainRisk(forecast)
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>
        {t('weather.forecastLabel', { description: forecast.description, min: Math.round(forecast.tMin), max: Math.round(forecast.tMax) })}
      </span>
      <Badge tone={riskTone[risk]}>{t('weather.rainRisk', { risk: t(`weather.risk.${risk}`), probability: forecast.precipitationProbability })}</Badge>
    </span>
  )
}

export function ItineraryView<T extends ViewableItinerary>({ itinerary, onChange }: Props<T>) {
  const { t } = useI18n()
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
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('iv.filterByDay')}>
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
              {d === 'all' ? t('iv.allDays') : t('it.day', { day: d + 1 })}
            </button>
          ))}
        </div>

        {days.map((day, di) =>
          selectedDay === 'all' || selectedDay === di ? (
            <section key={day.date} aria-labelledby={`day-${day.day}`} className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`day-${day.day}`} className="text-xl font-semibold text-navy">
                  {t('it.day', { day: day.day })} · {formatDate(day.date)}
                </h3>
                <span className="text-sm text-muted">{t('iv.straightDistance', { km: day.distanceKm })}</span>
              </div>
              {forecastByDate.get(day.date) && <div className="mt-1"><WeatherChip forecast={forecastByDate.get(day.date)!} /></div>}

              {day.places.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t('iv.freeDay')}</p>
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
                        href={osmPlaceUrl(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs font-semibold text-teal-soft underline underline-offset-2"
                        aria-label={t('it.viewOnOsm', { name: p.name })}
                      >
                        {t('iv.viewOsm')}
                      </a>
                      {onChange && (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={t('iv.moveUp', { name: p.name })}
                            disabled={pi === 0}
                            onClick={() => onChange(movePlace(itinerary, { day: di, place: pi }, { day: di, place: pi - 1 }))}
                            className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={t('iv.moveDown', { name: p.name })}
                            disabled={pi === day.places.length - 1}
                            onClick={() => onChange(movePlace(itinerary, { day: di, place: pi }, { day: di, place: pi + 1 }))}
                            className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"
                          >
                            ↓
                          </button>
                          {days.length > 1 && (
                            <select
                              aria-label={t('iv.moveToDay', { name: p.name })}
                              value=""
                              onChange={(e) => e.target.value !== '' && onChange(movePlace(itinerary, { day: di, place: pi }, { day: Number(e.target.value) }))}
                              className="h-8 rounded-lg border border-line bg-surface px-1 text-xs"
                            >
                              <option value="">{t('iv.moveTo')}</option>
                              {days.map((_, i) => i !== di && <option key={i} value={i}>{t('it.day', { day: i + 1 })}</option>)}
                            </select>
                          )}
                          <button
                            type="button"
                            aria-label={t('iv.remove', { name: p.name })}
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
                  {t('iv.dayNotes')}
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
          {t('iv.osmDisclaimer')}{' '}
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
          ariaLabel={t('iv.mapLabel', { place: destination.displayName.split(',')[0] })}
        />
      </div>
    </div>
  )
}
