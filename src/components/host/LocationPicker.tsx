/**
 * Selector de ubicación sobre OpenStreetMap: buscar por nombre (Nominatim,
 * solo al pulsar "Buscar": su política prohíbe consultar en cada tecla), clic
 * en el mapa o arrastrar el pin. Devuelve latitud y longitud.
 */
import { useState } from 'react'
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
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function search() {
    const text = (query || searchHint).trim()
    if (text.length < 2) return setMessage('Escribe el nombre de un lugar para buscarlo.')
    setBusy(true)
    setMessage(null)
    try {
      const found = await osmClient.geocode(text)
      if (!found) setMessage(`No encontramos "${text}". Prueba con el municipio y el departamento, o marca el punto directamente en el mapa.`)
      else onChange(found.lat, found.lon)
    } catch {
      setMessage('El servicio de búsqueda no respondió. Puedes marcar el punto directamente en el mapa.')
    } finally {
      setBusy(false)
    }
  }

  function pick(la: number, lo: number) {
    if (!inColombia(la, lo)) return setMessage('LOCUS solo publica lugares en Colombia. Elige un punto dentro del país.')
    setMessage(null)
    onChange(Number(la.toFixed(6)), Number(lo.toFixed(6)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="loc-search">Buscar un lugar en el mapa</label>
        <input id="loc-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} placeholder={searchHint ? `Buscar (ej. ${searchHint})` : 'Buscar dirección o lugar'} className={`${inputClassName} min-w-0 flex-1`} />
        <Button variant="secondary" onClick={search} disabled={busy}>{busy ? 'Buscando…' : 'Buscar'}</Button>
      </div>
      <LocusMap
        center={lat !== null && lon !== null ? [lat, lon] : undefined}
        zoom={lat !== null ? 14 : 5}
        fitMarkers={false}
        pickedPoint={lat !== null && lon !== null ? { lat, lon } : null}
        onPick={pick}
        className="h-80"
        ariaLabel="Mapa para marcar la ubicación"
      />
      <p className="text-sm text-muted">
        {lat !== null && lon !== null ? <>Ubicación elegida: <strong>{lat.toFixed(5)}, {lon.toFixed(5)}</strong>. Puedes arrastrar el pin para afinarla.</> : 'Haz clic en el mapa para marcar el punto exacto.'}
      </p>
      {message && <Alert tone="info">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  )
}
