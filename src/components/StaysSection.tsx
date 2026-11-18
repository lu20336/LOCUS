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
import { stayFit } from '../lib/flow/tripBudget'
import { formatCOP } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
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
  lodgingAllowance,
}: {
  lat: number
  lon: number
  placeName: string
  checkIn?: string
  checkOut?: string
  guests?: number
  /** false cuando la pantalla ya lista los alojamientos de LOCUS (ej. Explorar). */
  showLocus?: boolean
  /**
   * Lo que queda del presupuesto para hospedarse en todo el viaje (Paso 4).
   * Con fechas, los alojamientos que caben salen primero y marcados.
   */
  lodgingAllowance?: number
}) {
  const { t, meta } = useI18n()
  const listings = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const withBudget = lodgingAllowance !== undefined && Boolean(checkIn && checkOut)
  const near = useMemo(() => {
    const distance = (l: Listing) => haversineKm({ lat, lon }, l)
    return (listings.data ?? [])
      .filter((l) => l.capacity >= guests && distance(l) <= NEAR_KM)
      .map((l) => ({
        listing: l,
        fit: withBudget ? stayFit(l, { checkIn, checkOut, guests }, lodgingAllowance!) : null,
      }))
      .sort(
        (a, b) =>
          // Primero los que caben en el presupuesto; luego, los más cercanos.
          Number(b.fit?.fits ?? 0) - Number(a.fit?.fits ?? 0) || distance(a.listing) - distance(b.listing),
      )
  }, [listings.data, lat, lon, guests, withBudget, checkIn, checkOut, lodgingAllowance])
  const search = checkIn && checkOut ? `?llegada=${checkIn}&salida=${checkOut}&huespedes=${guests}` : ''

  // Alojamientos de referencia (solo para ver): catálogo precalculado o Nominatim en vivo.
  const reference = useAsync(() => getReferenceLodging({ lat, lon }), [lat, lon])
  const osmPlaces = reference.data?.places ?? []
  const osmMarkers: MapMarker[] = osmPlaces.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, kind: 'lodging-osm' }))
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  // Se muestran de a 6 (en Cartagena hay más de 60): una lista larga abruma, sobre todo en el celular.
  const [visibleRefs, setVisibleRefs] = useState(REF_PAGE)

  return (
    <section aria-label={t('stay.sectionLabel', { place: placeName })} className="flex flex-col gap-5">
      {showLocus && (<>
      <div>
        <h2 className="text-2xl font-semibold text-navy">{t('stay.whereTitle', { place: placeName })}</h2>
        <p className="mt-1 text-sm text-muted">{t('stay.bookable')}</p>
        {withBudget && (
          <p className="mt-2 text-sm text-ink">
            {lodgingAllowance! > 0 ? (
              <>
                {t('stay.budgetLeft', { amount: formatCOP(lodgingAllowance!) })}
                {near.length > 0 && t('stay.fitsFirst')}
              </>
            ) : (
              <>{t('stay.noBudget')}</>
            )}
          </p>
        )}
      </div>

      {listings.loading ? (
        <Spinner label={t('stay.searching')} />
      ) : listings.error ? (
        <Alert>{listings.error}</Alert>
      ) : near.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {near.slice(0, 6).map(({ listing: l, fit }) => (
            <li key={l.id} className="flex flex-col gap-2">
              {fit && (
                <span className="self-start">
                  {fit.fits ? (
                    <Badge tone="teal">{t('stay.withinBudget', { total: formatCOP(fit.total) })}</Badge>
                  ) : (
                    <Badge tone="warn">{t('stay.overBudget', { over: formatCOP(fit.over), total: formatCOP(fit.total) })}</Badge>
                  )}
                </span>
              )}
              <ListingCard listing={l} search={search} />
            </li>
          ))}
        </ul>
      ) : (
        <Alert tone="info">
          {t('stay.noHostsA', { place: placeName })}{' '}
          <Link to="/anfitrion" className="font-semibold underline">{t('stay.noHostsLink')}</Link>.
        </Alert>
      )}

      {near.length > 6 && <ButtonLink to="/explorar" variant="secondary" className="self-start">{t('stay.seeAll')}</ButtonLink>}
      </>)}

      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-navy">{showLocus ? t('stay.moreOptions') : t('stay.staysIn', { place: placeName })}</h3>
          <Badge>{t('stay.viewOnly')}</Badge>
        </div>
        <p className="text-sm text-muted">
          {t('stay.referenceNote', { place: placeName })}
        </p>
        {reference.loading && <Spinner label={t('stay.searching')} />}
        {reference.error && (
          <>
            <Alert>{t('stay.refError')}</Alert>
            <Button variant="secondary" className="self-start" onClick={reference.reload}>{t('common.retry')}</Button>
          </>
        )}
        {!reference.loading && !reference.error && osmPlaces.length === 0 && <p className="text-sm text-muted">{t('stay.noneOsm')}</p>}
        {osmPlaces.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {osmPlaces.slice(0, visibleRefs).map((p) => (
                <li key={p.id} onMouseEnter={() => setSelectedRef(p.id)} className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 ${selectedRef === p.id ? 'border-teal' : 'border-line'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="text-sm text-muted">{t('stay.fromCenter', { kind: p.kind, km: haversineKm({ lat, lon }, p).toFixed(1) })}</p>
                    <p className="mt-1 flex flex-wrap gap-3 text-sm">
                      {p.website && <a href={p.website} target="_blank" rel="noreferrer noopener" className="font-semibold text-teal-soft underline">{t('stay.website')}</a>}
                      {p.phone && <span className="text-muted">{t('stay.phone', { phone: p.phone })}</span>}
                      <a href={`https://www.openstreetmap.org/${p.id}`} target="_blank" rel="noreferrer noopener" className="text-muted underline">{t('stay.viewOnMap')}</a>
                    </p>
                  </div>
                  <FavoriteButton item={{ kind: 'place', refId: p.id, title: p.name, subtitle: p.kind }} />
                </li>
              ))}
            </ul>
            {osmPlaces.length > visibleRefs && (
              <Button variant="secondary" className="self-start" onClick={() => setVisibleRefs((n) => n + REF_PAGE)}>
                {t('stay.seeMore', { count: osmPlaces.length - visibleRefs })}
              </Button>
            )}
            </div>
            <LocusMap markers={osmMarkers} selectedId={selectedRef} onSelect={setSelectedRef} center={[lat, lon]} zoom={12} className="h-72" ariaLabel={t('stay.refMap')} />
          </div>
        )}
        {osmPlaces.length > 0 && (
          <p className="text-xs text-muted">
            {t('stay.count', { count: osmPlaces.length })}
            {reference.data?.source === 'static' && reference.data.generatedAt ? t('stay.updatedOn', { date: new Date(reference.data.generatedAt).toLocaleDateString(meta.bcp47) }) : ''}.
          </p>
        )}
      </div>
    </section>
  )
}
