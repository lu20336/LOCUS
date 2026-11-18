/**
 * Explorar hospedajes: lista + mapa sincronizados (estilo portales de viaje).
 * Fuente de la lista: alojamientos PUBLICADOS por anfitriones de LOCUS
 * (reservables). Si no hay resultados, se ofrecen alojamientos de referencia de
 * OpenStreetMap, claramente separados y marcados como no reservables.
 */
import { Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Counter } from '../components/Counter'
import { ListingCard } from '../components/ListingCard'
import { StaysSection } from '../components/StaysSection'
import type { Destination } from '../types/itinerary'
import { Alert, Button, ButtonLink, CardGridSkeleton, Container, EmptyState, PageHeader, Spinner, selectClassName } from '../components/ui'
import { inputClassName } from '../components/FormField'
import { fetchCalendar, fetchPublished } from '../lib/catalog/repo'
import { availableListings, filterListings, type ListingFilters } from '../lib/catalog/search'
import { AMENITIES, LISTING_TYPES, type Listing, type ListingType } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { useDestinationOptions } from '../lib/flow/destinationOptions'
import { findFeaturedDestination, findTownDestination, resolveDestination } from '../lib/flow/resolveDestination'
import { FEATURED_DESTINATIONS } from '../lib/featuredDestinations'
import { osmClient, suggestionDeps } from '../lib/itinerary/browserClient'
import { geocodeDestination } from '../lib/itinerary/generateItinerary'
import { haversineKm } from '../lib/itinerary/geo'
import { formatCOP, todayISO } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'
import type { TownCandidate } from '../lib/itinerary/suggestDestination'

type Sort = 'recent' | 'price-asc' | 'price-desc' | 'near'

export default function ExplorePage() {
  const { t: tr } = useI18n()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const [text, setText] = useState(params.get('q') ?? '')
  const [checkIn, setCheckIn] = useState(params.get('llegada') ?? '')
  const [checkOut, setCheckOut] = useState(params.get('salida') ?? '')
  const [guests, setGuests] = useState(Number(params.get('huespedes')) || 1)
  const [maxPrice, setMaxPrice] = useState(params.get('max') ?? '')
  const [types, setTypes] = useState<ListingType[]>([])
  const [amenities, setAmenities] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('recent')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null)
  const [geoMessage, setGeoMessage] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const all = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const options = useDestinationOptions(text)

  // La búsqueda queda en la URL (se puede compartir y el botón "atrás" funciona).
  useEffect(() => {
    const next = new URLSearchParams()
    if (text) next.set('q', text)
    if (checkIn) next.set('llegada', checkIn)
    if (checkOut) next.set('salida', checkOut)
    if (guests > 1) next.set('huespedes', String(guests))
    if (maxPrice) next.set('max', maxPrice)
    setParams(next, { replace: true })
  }, [text, checkIn, checkOut, guests, maxPrice, setParams])

  const filters: ListingFilters = {
    text,
    guests,
    minPrice: null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    types,
    amenities,
    checkIn,
    checkOut,
  }
  const base = useMemo(() => filterListings(all.data ?? [], filters), [all.data, text, guests, maxPrice, types, amenities]) // eslint-disable-line react-hooks/exhaustive-deps

  const datesValid = Boolean(checkIn && checkOut && checkIn >= today && checkOut > checkIn)
  const calendars = useAsync(async () => {
    if (!datesValid) return {}
    const entries = await Promise.all(base.slice(0, 40).map(async (l) => [l.id, await fetchCalendar(db, l.id)] as const))
    return Object.fromEntries(entries)
  }, [datesValid, checkIn, checkOut, base.map((l) => l.id).join(',')])

  const results = useMemo(() => {
    const list = datesValid ? availableListings(base, calendars.data ?? {}, checkIn, checkOut) : base
    const sorted = [...list]
    if (sort === 'near' && origin) sorted.sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b))
    else if (sort === 'price-asc') sorted.sort((a, b) => a.pricePerNight - b.pricePerNight)
    else if (sort === 'price-desc') sorted.sort((a, b) => b.pricePerNight - a.pricePerNight)
    else sorted.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    return sorted
  }, [base, calendars.data, datesValid, checkIn, checkOut, sort, origin])

  const markers: MapMarker[] = results.map((l) => ({ id: l.id, lat: l.lat, lon: l.lon, label: formatCOP(l.pricePerNight), kind: 'listing' }))
  const selected = results.find((l) => l.id === selectedId) ?? null
  const search = datesValid ? `?llegada=${checkIn}&salida=${checkOut}&huespedes=${guests}` : guests > 1 ? `?huespedes=${guests}` : ''

  // Destino conocido para sugerir alojamientos de referencia cuando no hay resultados.
  const [towns, setTowns] = useState<TownCandidate[]>([])
  useEffect(() => {
    void suggestionDeps.loadTowns().then(setTowns, () => undefined)
  }, [])
  const knownPlace = useMemo(() => text.trim().length >= 3 ? findFeaturedDestination(text) ?? findTownDestination(text, towns) : null, [text, towns])

  // Destino que no está en la lista local: se geocodifica con Nominatim SOLO al pulsar el botón.
  const [searched, setSearched] = useState<{ query: string; place: Destination | null; busy: boolean } | null>(null)
  async function searchOutsideList() {
    const query = text.trim()
    setSearched({ query, place: null, busy: true })
    try {
      const place = await resolveDestination(query, { geocode: (q) => geocodeDestination(q, osmClient), loadTowns: suggestionDeps.loadTowns })
      setSearched({ query, place, busy: false })
    } catch {
      setSearched({ query, place: null, busy: false })
    }
  }
  const extraPlace = !knownPlace && searched && searched.query === text.trim() ? searched : null

  function selectFromMap(id: string) {
    setSelectedId(id)
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function locate() {
    setGeoMessage(null)
    if (!('geolocation' in navigator)) return setGeoMessage(tr('ex.noGeolocation'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setSort('near')
      },
      () => setGeoMessage(tr('ex.geoDenied')),
      { timeout: 8000, maximumAge: 300_000 },
    )
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader eyebrow={tr('nav.stays')} title={tr('ex.title')}>
        {tr('ex.intro')}
      </PageHeader>

      <form onSubmit={(e) => e.preventDefault()} className="mb-6 grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_auto]" role="search" aria-label={tr('ex.searchLabel')}>
        <div>
          <label htmlFor="q" className="text-sm font-semibold text-ink">{tr('ex.destination')}</label>
          <input id="q" list="destino-options" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('ex.destinationPlaceholder')} className={`${inputClassName} mt-1`} />
          <datalist id="destino-options">{options.map((o) => <option key={o.id} value={o.name}>{o.detail}</option>)}</datalist>
        </div>
        <div>
          <label htmlFor="llegada" className="text-sm font-semibold text-ink">{tr('ex.checkIn')}</label>
          <input id="llegada" type="date" min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }} className={`${inputClassName} mt-1`} />
        </div>
        <div>
          <label htmlFor="salida" className="text-sm font-semibold text-ink">{tr('ex.checkOut')}</label>
          <input id="salida" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`${inputClassName} mt-1`} />
        </div>
        <Counter label={tr('ex.guests')} icon={Users} unit={tr('ex.oneGuest')} value={guests} min={1} max={20} onChange={setGuests} />
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label={tr('ex.popularLabel')}>
        <span className="text-sm text-muted">{tr('ex.popular')}</span>
        {FEATURED_DESTINATIONS.map((d) => (
          <button key={d.id} type="button" onClick={() => setText(d.name)} aria-pressed={text.trim().toLowerCase() === d.name.toLowerCase()} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold hover:bg-surface-2 aria-pressed:border-teal aria-pressed:bg-teal/15">{d.name}</button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label={tr('ex.filters')}>
        {(Object.keys(LISTING_TYPES) as ListingType[]).map((lt) => (
          <button key={lt} type="button" aria-pressed={types.includes(lt)} onClick={() => setTypes(toggle(types, lt))}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${types.includes(lt) ? 'border-teal bg-teal/15' : 'border-line bg-surface hover:bg-surface-2'}`}>
            {LISTING_TYPES[lt]}
          </button>
        ))}
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
            {tr('ex.amenities')}{amenities.length > 0 && ` (${amenities.length})`}
          </summary>
          <div className="absolute z-20 mt-2 grid w-72 gap-1 rounded-2xl border border-line bg-surface p-3 shadow-xl">
            {Object.entries(AMENITIES).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={amenities.includes(k)} onChange={() => setAmenities(toggle(amenities, k))} className="accent-[var(--primary)]" /> {label}
              </label>
            ))}
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm font-semibold">
          {tr('ex.maxPrice')}
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`${selectClassName} w-auto py-1.5`}>
            <option value="">{tr('ex.noLimit')}</option>
            {[100000, 200000, 300000, 500000, 800000, 1200000].map((p) => <option key={p} value={p}>{formatCOP(p)}</option>)}
          </select>
        </label>
        <button type="button" onClick={locate} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">{tr('ex.nearMe')}</button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          {tr('ex.sort')}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClassName} w-auto py-1.5`}>
            <option value="recent">{tr('ex.sortRecent')}</option>
            <option value="price-asc">{tr('ex.sortPriceAsc')}</option>
            <option value="price-desc">{tr('ex.sortPriceDesc')}</option>
            {origin && <option value="near">{tr('ex.sortNear')}</option>}
          </select>
        </label>
      </div>

      {geoMessage && <div className="mb-3"><Alert tone="info">{geoMessage}</Alert></div>}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <p className="text-sm text-muted" aria-live="polite">{tr('ex.stays', { count: results.length })}</p>
        <div role="group" aria-label={tr('ex.view')} className="flex overflow-hidden rounded-full border border-line">
          {(['list', 'map'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-navy text-surface' : 'bg-surface'}`}>
              {v === 'list' ? tr('ex.list') : tr('ex.map')}
            </button>
          ))}
        </div>
      </div>

      {all.loading ? (
        <CardGridSkeleton count={4} label={tr('ex.loading')} />
      ) : all.error ? (
        <Alert>{tr('ex.loadError')} <button className="underline" onClick={all.reload}>{tr('ex.tryAgain')}</button>.</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_30rem]">
          <div className={view === 'map' ? 'hidden lg:block' : ''}>
            <p className="mb-3 hidden text-sm text-muted lg:block" aria-live="polite">
              {tr('ex.stays', { count: results.length })}{datesValid && calendars.loading ? tr('ex.checkingAvailability') : ''}
            </p>
            {results.length === 0 ? (
              <EmptyState
                title={(all.data?.length ?? 0) === 0 ? tr('ex.emptyNone') : tr('ex.emptyFiltered')}
                action={<ButtonLink to="/anfitrion" variant="secondary">{tr('ex.publishFirst')}</ButtonLink>}
              >
                {(all.data?.length ?? 0) === 0
                  ? tr('ex.emptyNoneText')
                  : tr('ex.emptyFilteredText')}
              </EmptyState>
            ) : (
              <ul className="anim-stagger grid gap-5 sm:grid-cols-2">
                {results.map((l) => (
                  <li key={l.id} ref={(el) => { cardRefs.current[l.id] = el }}>
                    <ListingCard listing={l} selected={l.id === selectedId || l.id === hoveredId} onHover={(id) => { setHoveredId(id); }} search={search} distanceKm={origin ? haversineKm(origin, l) : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${view === 'list' ? 'hidden lg:block' : ''}`}>
            <div className="lg:sticky lg:top-24">
              <LocusMap markers={markers} selectedId={selectedId ?? hoveredId} onSelect={selectFromMap} className="h-[28rem] lg:h-[36rem]" ariaLabel={tr('ex.mapLabel')} />
              {selected && (
                <div className="mt-3 flex gap-3 rounded-2xl border border-teal bg-surface p-3 shadow-md">
                  {selected.cover && <img src={selected.cover} alt="" className="size-20 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{selected.title}</p>
                    <p className="text-sm text-muted">{selected.municipality} · {tr('ex.perNight', { price: formatCOP(selected.pricePerNight) })}</p>
                    <Link to={`/hospedajes/${selected.id}${search}`} className="text-sm font-semibold text-teal-soft underline">{tr('ex.viewListing')}</Link>
                  </div>
                  <button type="button" aria-label={tr('ex.closePreview')} onClick={() => setSelectedId(null)} className="self-start text-muted">✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!knownPlace && text.trim().length >= 3 && !extraPlace && (
        <div className="mt-8">
          <Button variant="secondary" onClick={searchOutsideList}>{tr('ex.seeReference', { place: text.trim() })}</Button>
        </div>
      )}
      {extraPlace && (
        <div className="mt-10">
          {extraPlace.busy ? <Spinner label={tr('ex.locating')} /> : extraPlace.place ? (
            <StaysSection lat={extraPlace.place.lat} lon={extraPlace.place.lon} placeName={extraPlace.place.displayName.split(',')[0]} guests={guests} showLocus={false} />
          ) : <Alert tone="info">{tr('ex.notFound', { query: extraPlace.query })}</Alert>}
        </div>
      )}
      {knownPlace && (
        <div className="mt-10">
          <div className="mt-3">
            <StaysSection lat={knownPlace.lat} lon={knownPlace.lon} placeName={knownPlace.displayName.split(',')[0]} guests={guests} showLocus={false} />
          </div>
        </div>
      )}
    </Container>
  )
}
