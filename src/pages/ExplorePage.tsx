/**
 * Explorar hospedajes: lista + mapa sincronizados (estilo portales de viaje).
 * Fuente de la lista: alojamientos PUBLICADOS por anfitriones de LOCUS
 * (reservables). Si no hay resultados, se ofrecen alojamientos de referencia de
 * OpenStreetMap, claramente separados y marcados como no reservables.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Counter } from '../components/Counter'
import { ListingCard } from '../components/ListingCard'
import { StaysSection } from '../components/StaysSection'
import { Alert, Badge, ButtonLink, Container, EmptyState, PageHeader, Spinner, selectClassName } from '../components/ui'
import { inputClassName } from '../components/FormField'
import { fetchCalendar, fetchPublished } from '../lib/catalog/repo'
import { availableListings, filterListings, type ListingFilters } from '../lib/catalog/search'
import { AMENITIES, LISTING_TYPES, type Listing, type ListingType } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { useDestinationOptions } from '../lib/flow/destinationOptions'
import { findFeaturedDestination, findTownDestination } from '../lib/flow/resolveDestination'
import { suggestionDeps } from '../lib/itinerary/browserClient'
import { haversineKm } from '../lib/itinerary/geo'
import { formatCOP, todayISO } from '../lib/format'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'
import type { TownCandidate } from '../lib/itinerary/suggestDestination'

type Sort = 'recent' | 'price-asc' | 'price-desc' | 'near'

export default function ExplorePage() {
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

  function selectFromMap(id: string) {
    setSelectedId(id)
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function locate() {
    setGeoMessage(null)
    if (!('geolocation' in navigator)) return setGeoMessage('Tu navegador no permite ubicarte.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setSort('near')
      },
      () => setGeoMessage('No pudimos obtener tu ubicación (permiso denegado o sin señal).'),
      { timeout: 8000, maximumAge: 300_000 },
    )
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader eyebrow="Hospedajes" title="Encuentra dónde quedarte en Colombia">
        Alojamientos publicados por anfitriones de LOCUS, con reserva directa.
      </PageHeader>

      <form onSubmit={(e) => e.preventDefault()} className="mb-6 grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_auto]" role="search" aria-label="Buscar hospedajes">
        <div>
          <label htmlFor="q" className="text-sm font-semibold text-ink">Destino</label>
          <input id="q" list="destino-options" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ciudad, pueblo o nombre" className={`${inputClassName} mt-1`} />
          <datalist id="destino-options">{options.map((o) => <option key={o.id} value={o.name}>{o.detail}</option>)}</datalist>
        </div>
        <div>
          <label htmlFor="llegada" className="text-sm font-semibold text-ink">Llegada</label>
          <input id="llegada" type="date" min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }} className={`${inputClassName} mt-1`} />
        </div>
        <div>
          <label htmlFor="salida" className="text-sm font-semibold text-ink">Salida</label>
          <input id="salida" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`${inputClassName} mt-1`} />
        </div>
        <Counter label="Huéspedes" icon="👥" unit="un huésped" value={guests} min={1} max={20} onChange={setGuests} />
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
        {(Object.keys(LISTING_TYPES) as ListingType[]).map((t) => (
          <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => setTypes(toggle(types, t))}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${types.includes(t) ? 'border-teal bg-teal/15' : 'border-line bg-surface hover:bg-surface-2'}`}>
            {LISTING_TYPES[t]}
          </button>
        ))}
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
            Comodidades{amenities.length > 0 && ` (${amenities.length})`}
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
          Precio máx.
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`${selectClassName} w-auto py-1.5`}>
            <option value="">Sin límite</option>
            {[100000, 200000, 300000, 500000, 800000, 1200000].map((p) => <option key={p} value={p}>{formatCOP(p)}</option>)}
          </select>
        </label>
        <button type="button" onClick={locate} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">📍 Cerca de mí</button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClassName} w-auto py-1.5`}>
            <option value="recent">Más recientes</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            {origin && <option value="near">Más cerca de mí</option>}
          </select>
        </label>
      </div>

      {geoMessage && <div className="mb-3"><Alert tone="info">{geoMessage}</Alert></div>}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <p className="text-sm text-muted" aria-live="polite">{results.length} {results.length === 1 ? 'alojamiento' : 'alojamientos'}</p>
        <div role="group" aria-label="Vista" className="flex overflow-hidden rounded-full border border-line">
          {(['list', 'map'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-navy text-surface' : 'bg-surface'}`}>
              {v === 'list' ? 'Lista' : 'Mapa'}
            </button>
          ))}
        </div>
      </div>

      {all.loading ? (
        <Spinner label="Cargando alojamientos…" />
      ) : all.error ? (
        <Alert>No pudimos cargar los alojamientos. Revisa tu conexión e <button className="underline" onClick={all.reload}>inténtalo de nuevo</button>.</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_30rem]">
          <div className={view === 'map' ? 'hidden lg:block' : ''}>
            <p className="mb-3 hidden text-sm text-muted lg:block" aria-live="polite">
              {results.length} {results.length === 1 ? 'alojamiento' : 'alojamientos'}{datesValid && calendars.loading ? ' · revisando disponibilidad…' : ''}
            </p>
            {results.length === 0 ? (
              <EmptyState
                title={(all.data?.length ?? 0) === 0 ? 'Aún no hay alojamientos publicados' : 'No hay alojamientos con esos filtros'}
                action={<ButtonLink to="/anfitrion" variant="secondary">Publica el primero en tu zona</ButtonLink>}
              >
                {(all.data?.length ?? 0) === 0
                  ? 'LOCUS está empezando: los anfitriones se están sumando. Mientras tanto puedes ver alojamientos de referencia de OpenStreetMap o explorar experiencias.'
                  : 'Prueba con otras fechas, menos filtros o un precio más alto.'}
              </EmptyState>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2">
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
              <LocusMap markers={markers} selectedId={selectedId ?? hoveredId} onSelect={selectFromMap} className="h-[28rem] lg:h-[36rem]" ariaLabel="Mapa de alojamientos" />
              {selected && (
                <div className="mt-3 flex gap-3 rounded-2xl border border-teal bg-surface p-3 shadow-md">
                  {selected.cover && <img src={selected.cover} alt="" className="size-20 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{selected.title}</p>
                    <p className="text-sm text-muted">{selected.municipality} · {formatCOP(selected.pricePerNight)} por noche</p>
                    <Link to={`/hospedajes/${selected.id}${search}`} className="text-sm font-semibold text-teal-soft underline">Ver ficha</Link>
                  </div>
                  <button type="button" aria-label="Cerrar vista previa" onClick={() => setSelectedId(null)} className="self-start text-muted">✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!all.loading && results.length === 0 && knownPlace && (
        <div className="mt-8">
          <Badge tone="teal">Fuente alternativa</Badge>
          <div className="mt-3">
            <StaysSection lat={knownPlace.lat} lon={knownPlace.lon} placeName={knownPlace.displayName.split(',')[0]} guests={guests} showLocus={false} />
          </div>
        </div>
      )}
    </Container>
  )
}
