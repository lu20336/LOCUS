/**
 * Selector de ubicación sobre OpenStreetMap: buscar por nombre (Nominatim,
 * solo al pulsar "Buscar": su política prohíbe consultar en cada tecla), clic
 * en el mapa o arrastrar el pin. Devuelve latitud y longitud.
 */
import { useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { osmClient } from '../../lib/itinerary/browserClient'
import { inColombia } from '../../lib/domain/validation'
import { LocusMap } from '../../lib/maps/MapLazy'
import { Alert, Button } from '../ui'
import { inputClassName } from '../FormField'

export function LocationPicker({
  lat,
  lon,
  onChange,
  error,
  searchHint = '',
}: {
  lat: number | null
  lon: number | null
  onChange: (lat: number, lon: number) => void
  error?: string
  /** Texto inicial sugerido para buscar (ej. el municipio). */
  searchHint?: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function search() {
    const text = (query || searchHint).trim()
    if (text.length < 2) return setMessage(t('lk.needName'))
    setBusy(true)
    setMessage(null)
    try {
      const found = await osmClient.geocode(text)
      if (!found) setMessage(t('lk.notFound', { text }))
      else onChange(found.lat, found.lon)
    } catch {
      setMessage(t('lk.serviceDown'))
    } finally {
      setBusy(false)
    }
  }

  function pick(la: number, lo: number) {
    if (!inColombia(la, lo)) return setMessage(t('lk.onlyColombia'))
    setMessage(null)
    onChange(Number(la.toFixed(6)), Number(lo.toFixed(6)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="loc-search">{t('lk.searchLabel')}</label>
        <input id="loc-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} placeholder={searchHint ? t('lk.searchHint', { hint: searchHint }) : t('lk.searchPlaceholder')} className={`${inputClassName} min-w-0 flex-1`} />
        <Button variant="secondary" onClick={search} disabled={busy}>{busy ? t('lk.searching') : t('common.search')}</Button>
      </div>
      <LocusMap
        center={lat !== null && lon !== null ? [lat, lon] : undefined}
        zoom={lat !== null ? 14 : 5}
        fitMarkers={false}
        pickedPoint={lat !== null && lon !== null ? { lat, lon } : null}
        onPick={pick}
        className="h-80"
        ariaLabel={t('lk.mapLabel')}
      />
      <p className="text-sm text-muted">
        {lat !== null && lon !== null ? <>{t('lk.chosen')} <strong>{lat.toFixed(5)}, {lon.toFixed(5)}</strong>. {t('lk.dragPin')}</> : t('lk.clickMap')}
      </p>
      {message && <Alert tone="info">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  )
}
