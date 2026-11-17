/**
 * "Dónde hospedarte" cerca de un punto: 1) alojamientos reservables publicados
 * por anfitriones de LOCUS; 2) alojamientos de referencia de OpenStreetMap
 * (solo para ver, no reservables), que se muestran siempre para que un
 * destino nunca aparezca vacío. Mantiene separadas las dos fuentes.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { fetchPublished } from '../lib/catalog/repo'
import { getReferenceLodging } from '../lib/catalog/referenceLodging'
import { db } from '../lib/firebase/client'
import { haversineKm } from '../lib/itinerary/geo'
import { useAsync } from '../lib/useAsync'
import type { Listing } from '../lib/domain/types'
import { ListingCard } from './ListingCard'
import { FavoriteButton } from './FavoriteButton'
import { Alert, Badge, Button, ButtonLink, Spinner } from './ui'

const NEAR_KM = 40

/** Alojamientos de referencia que se muestran de entrada (y cuántos más con "Ver más"). */
const REF_PAGE = 6

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

  // Alojamientos de referencia (solo para ver): catálogo precalculado o Nominatim en vivo.
  const reference = useAsync(() => getReferenceLodging({ lat, lon }), [lat, lon])
  const osmPlaces = reference.data?.places ?? []
  const osmMarkers: MapMarker[] = osmPlaces.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, kind: 'lodging-osm' }))
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  // Se muestran de a 6 (en Cartagena hay más de 60): una lista larga abruma, sobre todo en el celular.
  const [visibleRefs, setVisibleRefs] = useState(REF_PAGE)

  return (
    <section aria-label={`Alojamientos en ${placeName}`} className="flex flex-col gap-5">
      {showLocus && (<>
      <div>
        <h2 className="text-2xl font-semibold text-navy">Dónde hospedarte en {placeName}</h2>
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
          Todavía no hay anfitriones de LOCUS cerca de {placeName}. Más abajo puedes ver alojamientos de referencia (no reservables aquí) o{' '}
          <Link to="/anfitrion" className="font-semibold underline">publicar el tuyo</Link>.
        </Alert>
      )}

      {near.length > 6 && <ButtonLink to="/explorar" variant="secondary" className="self-start">Ver todos los alojamientos</ButtonLink>}
      </>)}

      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-navy">{showLocus ? 'Más opciones en la zona' : `Alojamientos en ${placeName}`}</h3>
          <Badge>Solo para ver · no reservables en LOCUS</Badge>
        </div>
        <p className="text-sm text-muted">
          Establecimientos reales de OpenStreetMap cerca de {placeName}. No tenemos sus precios, fotos ni disponibilidad: contáctalos directamente.
        </p>
        {reference.loading && <Spinner label="Buscando alojamientos…" />}
        {reference.error && (
          <>
            <Alert>No pudimos consultar los alojamientos de referencia en este momento.</Alert>
            <Button variant="secondary" className="self-start" onClick={reference.reload}>Reintentar</Button>
          </>
        )}
        {!reference.loading && !reference.error && osmPlaces.length === 0 && <p className="text-sm text-muted">No encontramos alojamientos registrados en OpenStreetMap en esta zona.</p>}
        {osmPlaces.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {osmPlaces.slice(0, visibleRefs).map((p) => (
                <li key={p.id} onMouseEnter={() => setSelectedRef(p.id)} className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 ${selectedRef === p.id ? 'border-teal' : 'border-line'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="text-sm text-muted">{p.kind} · {haversineKm({ lat, lon }, p).toFixed(1)} km del centro</p>
                    <p className="mt-1 flex flex-wrap gap-3 text-sm">
                      {p.website && <a href={p.website} target="_blank" rel="noreferrer noopener" className="font-semibold text-teal-soft underline">Sitio web</a>}
                      {p.phone && <span className="text-muted">Tel. {p.phone}</span>}
                      <a href={`https://www.openstreetmap.org/${p.id}`} target="_blank" rel="noreferrer noopener" className="text-muted underline">Ver en el mapa</a>
                    </p>
                  </div>
                  <FavoriteButton item={{ kind: 'place', refId: p.id, title: p.name, subtitle: p.kind }} />
                </li>
              ))}
            </ul>
            {osmPlaces.length > visibleRefs && (
              <Button variant="secondary" className="self-start" onClick={() => setVisibleRefs((n) => n + REF_PAGE)}>
                Ver más alojamientos ({osmPlaces.length - visibleRefs})
              </Button>
            )}
            </div>
            <LocusMap markers={osmMarkers} selectedId={selectedRef} onSelect={setSelectedRef} center={[lat, lon]} zoom={12} className="h-72" ariaLabel="Mapa de alojamientos de referencia" />
          </div>
        )}
        {osmPlaces.length > 0 && (
          <p className="text-xs text-muted">
            {osmPlaces.length} alojamientos · Datos © OpenStreetMap contributors (ODbL)
            {reference.data?.source === 'static' && reference.data.generatedAt ? ` · actualizado el ${new Date(reference.data.generatedAt).toLocaleDateString('es-CO')}` : ''}.
          </p>
        )}
      </div>
    </section>
  )
}
