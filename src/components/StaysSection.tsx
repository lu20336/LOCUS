/**
 * "Dónde hospedarte" cerca de un punto: 1) alojamientos reservables publicados
 * por anfitriones de LOCUS; 2) a pedido, alojamientos de referencia de
 * OpenStreetMap (no reservables aquí). Mantiene separadas las dos fuentes.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { fetchPublished } from '../lib/catalog/repo'
import { buildLodgingQuery, parseLodging } from '../lib/catalog/osmLodging'
import { db } from '../lib/firebase/client'
import { osmClient } from '../lib/itinerary/browserClient'
import { haversineKm } from '../lib/itinerary/geo'
import { useAsync } from '../lib/useAsync'
import type { ExternalPlace, Listing } from '../lib/domain/types'
import { ListingCard } from './ListingCard'
import { FavoriteButton } from './FavoriteButton'
import { Alert, Badge, Button, ButtonLink, Spinner } from './ui'

const NEAR_KM = 40

export function StaysSection({
  lat,
  lon,
  placeName,
  checkIn = '',
  checkOut = '',
  guests = 1,
  showLocus = true,
}: {
  lat: number
  lon: number
  placeName: string
  checkIn?: string
  checkOut?: string
  guests?: number
  /** false cuando la pantalla ya lista los alojamientos de LOCUS (ej. Explorar). */
  showLocus?: boolean
}) {
  const listings = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const near = useMemo(
    () =>
      (listings.data ?? [])
        .filter((l) => l.capacity >= guests && haversineKm({ lat, lon }, l) <= NEAR_KM)
        .sort((a, b) => haversineKm({ lat, lon }, a) - haversineKm({ lat, lon }, b)),
    [listings.data, lat, lon, guests],
  )
  const search = checkIn && checkOut ? `?llegada=${checkIn}&salida=${checkOut}&huespedes=${guests}` : ''

  const [showOsm, setShowOsm] = useState(false)
  const [osm, setOsm] = useState<{ loading: boolean; error: string | null; places: ExternalPlace[] }>({ loading: false, error: null, places: [] })

  async function loadOsm() {
    setShowOsm(true)
    setOsm({ loading: true, error: null, places: [] })
    try {
      const response = await osmClient.queryOverpass(buildLodgingQuery(lat, lon, 8000))
      setOsm({ loading: false, error: null, places: parseLodging(response, { lat, lon }) })
    } catch {
      setOsm({ loading: false, error: 'El servicio de mapas (Overpass) está ocupado. Inténtalo de nuevo en unos segundos.', places: [] })
    }
  }

  const osmMarkers: MapMarker[] = osm.places.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, kind: 'lodging-osm' }))

  return (
    <section aria-labelledby="stays-title" className="flex flex-col gap-5">
      {showLocus && (<>
      <div>
        <h2 id="stays-title" className="text-2xl font-semibold text-navy">Dónde hospedarte en {placeName}</h2>
        <p className="mt-1 text-sm text-muted">Reservables en LOCUS, publicados por anfitriones.</p>
      </div>

      {listings.loading ? (
        <Spinner label="Buscando alojamientos…" />
      ) : listings.error ? (
        <Alert>{listings.error}</Alert>
      ) : near.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {near.slice(0, 6).map((l) => (
            <li key={l.id}><ListingCard listing={l} search={search} /></li>
          ))}
        </ul>
      ) : (
        <Alert tone="info">
          Todavía no hay anfitriones de LOCUS cerca de {placeName}. Puedes ver alojamientos de referencia (no reservables aquí) o{' '}
          <Link to="/anfitrion" className="font-semibold underline">publicar el tuyo</Link>.
        </Alert>
      )}

      {near.length > 6 && <ButtonLink to="/explorar" variant="secondary" className="self-start">Ver todos los alojamientos</ButtonLink>}
      </>)}

      {!showOsm ? (
        <Button variant="ghost" className="self-start border border-line" onClick={loadOsm}>
          Ver alojamientos de referencia en OpenStreetMap
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-navy">Alojamientos de referencia</h3>
            <Badge>OpenStreetMap · no reservables en LOCUS</Badge>
          </div>
          <p className="text-sm text-muted">
            Establecimientos reales cerca de {placeName}. No tenemos sus precios ni su disponibilidad: contáctalos directamente.
          </p>
          {osm.loading && <Spinner label="Consultando OpenStreetMap…" />}
          {osm.error && (
            <>
              <Alert>{osm.error}</Alert>
              <Button variant="secondary" className="self-start" onClick={loadOsm}>Reintentar</Button>
            </>
          )}
          {!osm.loading && !osm.error && osm.places.length === 0 && <p className="text-sm text-muted">No encontramos alojamientos registrados en OpenStreetMap en esta zona.</p>}
          {osm.places.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                {osm.places.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="text-sm text-muted">
                        {p.kind}
                        {p.address ? ` · ${p.address}` : ''} · {haversineKm({ lat, lon }, p).toFixed(1)} km
                      </p>
                      <p className="mt-1 flex flex-wrap gap-3 text-sm">
                        {p.website && <a href={p.website} target="_blank" rel="noreferrer noopener" className="font-semibold text-teal-soft underline">Sitio web</a>}
                        {p.phone && <span className="text-muted">Tel. {p.phone}</span>}
                      </p>
                    </div>
                    <FavoriteButton item={{ kind: 'place', refId: p.id, title: p.name, subtitle: p.kind }} />
                  </li>
                ))}
              </ul>
              <LocusMap markers={osmMarkers} center={[lat, lon]} zoom={12} className="h-72" ariaLabel="Mapa de alojamientos de referencia" />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
