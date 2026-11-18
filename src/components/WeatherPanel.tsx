import { fetchForecast, rainRisk } from '../lib/weather/openMeteo'
import { useAsync } from '../lib/useAsync'
import { getBcp47 } from '../lib/i18n/store'
import { useI18n } from '../lib/i18n/I18nProvider'
import { Badge } from './ui'

const riskTone = { bajo: 'teal', medio: 'warn', alto: 'danger' } as const
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat(getBcp47(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

/** Clima actual y pronóstico de 7 días (Open-Meteo). Distingue "ahora" de "pronóstico". */
export function WeatherPanel({ lat, lon, title }: { lat: number; lon: number; title?: string }) {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => fetchForecast(lat, lon, 7), [lat, lon])

  return (
    <section aria-labelledby="weather-title" className="rounded-3xl border border-line bg-surface p-5">
      <h2 id="weather-title" className="text-xl font-semibold text-navy">{title ?? t('wp.title')}</h2>
      {loading && <p className="mt-3 text-sm text-muted" role="status">{t('wp.loading')}</p>}
      {error && (
        <p className="mt-3 text-sm text-muted">
          {t('wp.error')} <button className="font-semibold underline" onClick={reload}>{t('common.retry')}</button>
        </p>
      )}
      {data && (
        <>
          {data.current && (
            <p className="mt-2 text-ink">
              <span className="text-3xl font-semibold">{Math.round(data.current.temperature)} °C</span>{' '}
              <span className="text-muted">
                {t('wp.now', { description: data.current.description, feels: Math.round(data.current.apparentTemperature), humidity: data.current.humidity })}
              </span>
            </p>
          )}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {data.daily.map((d) => (
              <li key={d.date} className="rounded-2xl bg-surface-2 p-3 text-center">
                <p className="text-xs font-semibold capitalize text-muted">{shortDate(d.date)}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{Math.round(d.tMin)}–{Math.round(d.tMax)} °C</p>
                <p className="text-xs text-muted">{d.description}</p>
                <div className="mt-1"><Badge tone={riskTone[rainRisk(d)]}>☔ {d.precipitationProbability}%</Badge></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {t('wp.note')}{' '}
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> (CC BY 4.0).
          </p>
        </>
      )}
    </section>
  )
}
