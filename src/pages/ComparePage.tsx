/**
 * COMPARADOR · "todo tu viaje en un solo lugar".
 *
 * El usuario pone destino, fechas y viajeros UNA vez y LOCUS arma, para cada
 * necesidad (alojamiento, vuelos, experiencias, transporte), la búsqueda en las
 * plataformas más usadas con esos datos ya puestos, más una libreta de precios
 * para decidir con números. Lo que LOCUS ofrece directo (alojamientos de
 * anfitriones) aparece primero, con precio verificado y sin cargos de servicio.
 *
 * Precios de terceros: NO se muestran (no hay API gratuita y el scraping viola
 * sus términos); ver docs/NEGOCIO.md para el camino a precios en vivo.
 */
import { Hotel, MapPinned, Plane, ShieldCheck, Ticket, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProviderList } from '../components/compare/ProviderList'
import { PriceNotebook } from '../components/compare/PriceNotebook'
import { Counter } from '../components/Counter'
import { inputClassName } from '../components/FormField'
import { ListingCard } from '../components/ListingCard'
import { Alert, Badge, ButtonLink, Card, Container, PageHeader, selectClassName, Spinner } from '../components/ui'
import { fetchFlightReference, livePricesEnabled, referenceToQuote, type FlightReference } from '../lib/compare/livePrices'
import { notebookKey } from '../lib/compare/priceNotebook'
import {
  airlineLinks,
  experienceLinks,
  flightSearchLinks,
  insuranceLinks,
  propertyLinks,
  stayLinks,
  transportLinks,
  type PriceQuote,
} from '../lib/compare/providers'
import { fetchPublished } from '../lib/catalog/repo'
import { quoteStay, validateStay } from '../lib/domain/pricing'
import type { Listing } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { AIRPORTS, findAirport, nearestAirports } from '../lib/flights/airports'
import { useDestinationOptions } from '../lib/flow/destinationOptions'
import { findFeaturedDestination } from '../lib/flow/resolveDestination'
import { formatCOP, formatDate, todayISO } from '../lib/format'
import { haversineKm } from '../lib/itinerary/geo'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useAsync } from '../lib/useAsync'
import type { Destination } from '../types/itinerary'

const TABS = [
  { id: 'alojamiento', icon: Hotel },
  { id: 'vuelos', icon: Plane },
  { id: 'experiencias', icon: Ticket },
  { id: 'transporte', icon: ShieldCheck },
] as const
type TabId = (typeof TABS)[number]['id']

interface Ctx {
  /** Nombre corto del destino, ej. "Cartagena de Indias". */
  place: string
  dest: Destination | null
  checkIn: string
  checkOut: string
  /** Fechas completas y coherentes. */
  datesOk: boolean
  travelers: number
}

const NEAR_KM = 40

export default function ComparePage() {
  const { t: tr } = useI18n()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const tab: TabId = TABS.some((t) => t.id === params.get('tipo')) ? (params.get('tipo') as TabId) : 'alojamiento'

  const [text, setText] = useState(params.get('destino') ?? '')
  const [chosen, setChosen] = useState<Destination | null>(null)
  const [checkIn, setCheckIn] = useState(params.get('llegada') ?? '')
  const [checkOut, setCheckOut] = useState(params.get('salida') ?? '')
  const [travelers, setTravelers] = useState(Math.max(1, Math.min(Number(params.get('huespedes')) || 2, 16)))

  const options = useDestinationOptions(chosen ? '' : text)
  // El destino sale de la sugerencia elegida o, si el texto coincide con un destino conocido, de ahí.
  const dest = useMemo<Destination | null>(() => {
    if (chosen) return chosen
    const known = findFeaturedDestination(text)
    if (known) return known
    const first = options[0]
    return first && first.name.toLowerCase() === text.trim().split(',')[0].toLowerCase() ? first.destination : null
  }, [chosen, text, options])

  const place = (dest?.displayName ?? text).split(',')[0].trim()
  const datesOk = Boolean(checkIn && checkOut && checkIn >= today && checkOut > checkIn)
  const ctx: Ctx = { place, dest, checkIn, checkOut, datesOk, travelers }
  const hasPlace = place.length >= 2
  const dateHint =
    checkIn && checkIn < today
      ? tr('compare.pastArrival')
      : checkIn && checkOut && checkOut <= checkIn
        ? tr('compare.badDeparture')
        : null

  return (
    <Container className="max-w-5xl py-8 sm:py-10">
      <PageHeader eyebrow={tr('compare.eyebrow')} title={tr('compare.title')}>
        {tr('compare.intro')}
      </PageHeader>

      <Card>
        <form className="grid gap-4 sm:grid-cols-6" onSubmit={(e) => e.preventDefault()}>
          <div className="relative sm:col-span-6">
            <label htmlFor="cmp-dest" className="text-sm font-semibold text-ink">{tr('compare.whereTo')}</label>
            <input
              id="cmp-dest"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setChosen(null)
              }}
              autoComplete="off"
              placeholder={tr('compare.placeholder')}
              className={`${inputClassName} mt-1`}
            />
            {!chosen && options.length > 0 && text.trim().length >= 2 && !dest && (
              <ul aria-label={tr('compare.suggestions')} className="mt-2 flex flex-wrap gap-2">
                {options.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setChosen(o.destination)
                        setText(o.name)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-teal"
                    >
                      <MapPinned aria-hidden="true" className="size-4 text-teal-soft" />
                      {o.name} <span className="font-normal text-muted">· {o.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cmp-in" className="text-sm font-semibold text-ink">{tr('compare.checkIn')}</label>
            <input id="cmp-in" type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={`${inputClassName} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cmp-out" className="text-sm font-semibold text-ink">{tr('compare.checkOut')}</label>
            <input id="cmp-out" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`${inputClassName} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <Counter label={tr('compare.travelersLabel')} icon={Users} unit={tr('compare.oneTraveler')} value={travelers} min={1} max={16} onChange={setTravelers} />
          </div>
        </form>
        {dateHint && <p className="mt-3 text-sm text-danger" role="alert">{dateHint}</p>}
      </Card>

      <nav aria-label={tr('compare.tabsLabel')} className="mt-6">
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((tabItem) => {
            const active = tabItem.id === tab
            const next = new URLSearchParams(params)
            next.set('tipo', tabItem.id)
            return (
              <li key={tabItem.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setParams(next, { replace: true })}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold transition-colors ${
                    active ? 'border-navy bg-navy text-surface' : 'border-line bg-surface text-ink hover:bg-surface-2'
                  }`}
                >
                  <tabItem.icon aria-hidden="true" className="size-4" />
                  {tr(`compare.tab.${tabItem.id}`)}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-6">
        {!hasPlace ? (
          <Alert tone="info">{tr('compare.needDestination')}</Alert>
        ) : tab === 'alojamiento' ? (
          <StaysTab ctx={ctx} />
        ) : tab === 'vuelos' ? (
          <FlightsTab ctx={ctx} />
        ) : tab === 'experiencias' ? (
          <ExperiencesTab ctx={ctx} />
        ) : (
          <TransportTab ctx={ctx} />
        )}
        <AffiliateNote />
      </div>
    </Container>
  )
}

function Block({ title, subtitle, children, badge }: { title: string; subtitle?: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold text-navy">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function AffiliateNote() {
  const { t: tr } = useI18n()
  return (
    <p className="text-xs text-muted">
      {tr('compare.affiliate')}{' '}
      <Link to="/como-ganamos-dinero" className="underline underline-offset-2 hover:text-ink">{tr('footer.howWeEarn')}</Link>.
    </p>
  )
}

/* ───────────────────────────── Alojamiento ───────────────────────────── */

function StaysTab({ ctx }: { ctx: Ctx }) {
  const { t: tr } = useI18n()
  const { place, dest, checkIn, checkOut, datesOk, travelers } = ctx
  const listings = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const near = useMemo(() => {
    if (!dest) return []
    return (listings.data ?? [])
      .filter((l) => l.capacity >= travelers && haversineKm(dest, l) <= NEAR_KM)
      .sort((a, b) => haversineKm(dest, a) - haversineKm(dest, b))
  }, [listings.data, dest, travelers])

  const links = useMemo(() => stayLinks({ place, checkIn: datesOk ? checkIn : undefined, checkOut: datesOk ? checkOut : undefined, adults: travelers }), [place, datesOk, checkIn, checkOut, travelers])
  const search = datesOk ? `?llegada=${checkIn}&salida=${checkOut}&huespedes=${travelers}` : ''

  // Mejor precio verificado de LOCUS para esas fechas (misma fórmula que la reserva real).
  const locusQuote: PriceQuote[] = useMemo(() => {
    if (!datesOk) return []
    const today = todayISO()
    const priced = near
      .filter((l) => validateStay(l, { checkIn, checkOut, guests: travelers }, today) === null)
      .map((l) => ({ l, total: quoteStay(l, { checkIn, checkOut, guests: travelers }).total }))
      .sort((a, b) => a.total - b.total)
    const best = priced[0]
    return best ? [{ providerId: 'locus', label: `LOCUS · ${best.l.title}`, totalCOP: best.total, source: 'locus' as const }] : []
  }, [near, datesOk, checkIn, checkOut, travelers])

  const [propertyName, setPropertyName] = useState('')
  const sameProperty = propertyName.trim().length >= 3 ? propertyLinks(propertyName.trim(), place, { checkIn: datesOk ? checkIn : undefined, checkOut: datesOk ? checkOut : undefined, adults: travelers }) : []

  return (
    <>
      <Block
        title={tr('compare.stays.directTitle', { place })}
        subtitle={tr('compare.stays.directSubtitle')}
        badge={<Badge tone="teal">{tr('compare.stays.noCommission')}</Badge>}
      >
        {!dest ? (
          <Alert tone="info">{tr('compare.stays.pickSuggestion')}</Alert>
        ) : listings.loading ? (
          <Spinner label={tr('compare.stays.loading')} />
        ) : near.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {near.slice(0, 3).map((l) => (
                <li key={l.id}>
                  <ListingCard listing={l} search={search} />
                  {datesOk && validateStay(l, { checkIn, checkOut, guests: travelers }, todayISO()) === null && (
                    <p className="mt-2 text-sm text-ink">
                      <strong>{formatCOP(quoteStay(l, { checkIn, checkOut, guests: travelers }).total)}</strong>{' '}
                      <span className="text-muted">{tr('compare.stays.totalFor')} · {formatDate(checkIn)} – {formatDate(checkOut)}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {near.length > 3 && <ButtonLink to="/explorar" variant="secondary" className="self-start">{tr('compare.stays.seeAll', { count: near.length })}</ButtonLink>}
          </>
        ) : (
          <Alert tone="info">
            {tr('compare.stays.noHostsA', { place })}{' '}
            <Link to="/anfitrion" className="font-semibold underline">{tr('compare.stays.noHostsLink')}</Link> {tr('compare.stays.noHostsB')}
          </Alert>
        )}
      </Block>

      <Block
        title={tr('compare.stays.othersTitle')}
        subtitle={datesOk ? tr('compare.stays.othersWithDates', { place, travelers: tr('common.travelers', { count: travelers }) }) : tr('compare.stays.othersNoDates')}
      >
        <ProviderList links={links} cta={tr('compare.searchIn')} />
      </Block>

      <Block title={tr('compare.noteTitle')} subtitle={tr('compare.noteSubtitle')}>
        <Card>
          <PriceNotebook
            storageKey={notebookKey('stay', place, checkIn, checkOut, travelers)}
            rows={links.filter((l) => l.prefill !== 'none' || l.provider.id === 'despegar').slice(0, 6).map((l) => ({ providerId: l.provider.id, label: l.provider.name }))}
            fixedQuotes={locusQuote}
            unit={tr('compare.stayUnit')}
          />
        </Card>
      </Block>

      <Block title={tr('compare.sameTitle')} subtitle={tr('compare.sameSubtitle')}>
        <Card>
          <label htmlFor="cmp-prop" className="text-sm font-semibold text-ink">{tr('compare.propertyName')}</label>
          <input id="cmp-prop" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder={tr('compare.propertyPlaceholder')} className={`${inputClassName} mt-1`} />
          {sameProperty.length > 0 && (
            <div className="mt-4">
              <ProviderList links={sameProperty} cta={tr('compare.findIn')} />
            </div>
          )}
        </Card>
      </Block>
    </>
  )
}

/* ───────────────────────────── Vuelos ───────────────────────────── */

function FlightsTab({ ctx }: { ctx: Ctx }) {
  const { t: tr } = useI18n()
  const { place, dest, checkIn, checkOut, datesOk, travelers } = ctx
  const suggested = useMemo(
    () => (dest ? nearestAirports(dest, 1)[0]?.iata : findAirport(place)?.iata) ?? 'CTG',
    [dest, place],
  )
  const [origin, setOrigin] = useState('BOG')
  const [destOverride, setDestOverride] = useState<string | null>(null)
  const to = destOverride ?? suggested
  const same = origin === to
  const ready = checkIn && checkIn >= todayISO() && !same

  const flights = useMemo(
    () => (ready ? flightSearchLinks({ origin, destination: to, date: checkIn, returnDate: datesOk ? checkOut : undefined, adults: travelers }) : []),
    [ready, origin, to, checkIn, checkOut, datesOk, travelers],
  )
  // Precio de referencia (Worker gratis + datos de Aviasales). Apagado si no hay VITE_PRICES_API_URL.
  const liveOn = livePricesEnabled()
  const reference = useAsync(
    () => (liveOn && ready ? fetchFlightReference({ origin, destination: to, date: checkIn, returnDate: datesOk ? checkOut : undefined }) : Promise.resolve(null)),
    [liveOn, ready, origin, to, checkIn, checkOut, datesOk],
  )
  const options = AIRPORTS.map((a) => (
    <option key={a.iata} value={a.iata}>
      {a.city} · {a.name} ({a.iata})
    </option>
  ))

  return (
    <>
      <Block title={tr('compare.flights.route')} subtitle={tr('compare.flights.routeSub')}>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cmp-o" className="text-sm font-semibold text-ink">{tr('compare.flights.origin')}</label>
              <select id="cmp-o" value={origin} onChange={(e) => setOrigin(e.target.value)} className={`${selectClassName} mt-1`}>{options}</select>
            </div>
            <div>
              <label htmlFor="cmp-d" className="text-sm font-semibold text-ink">{tr('compare.flights.destination')}</label>
              <select id="cmp-d" value={to} onChange={(e) => setDestOverride(e.target.value)} className={`${selectClassName} mt-1`}>{options}</select>
            </div>
          </div>
          {same && <p className="mt-3 text-sm text-danger" role="alert">{tr('compare.flights.sameAirport')}</p>}
          {!checkIn && <p className="mt-3 text-sm text-muted">{tr('compare.flights.needDate')}</p>}
        </Card>
      </Block>

      {flights.length > 0 && (
        <>
          {liveOn && (
            <Block title={tr('compare.flights.refTitle')} subtitle={tr('compare.flights.refSub')}>
              {reference.loading ? <Spinner label={tr('compare.flights.refLoading')} /> : reference.data ? <ReferenceCard reference={reference.data} travelers={travelers} /> : <Alert tone="info">{tr('compare.flights.refNone')}</Alert>}
            </Block>
          )}
          <Block title={tr('compare.flights.searchersTitle')} subtitle={tr('compare.flights.searchersSub')}>
            <ProviderList links={flights} cta={tr('compare.flights.viewFlights')} />
          </Block>
          <Block title={tr('compare.noteTitle')} subtitle={tr('compare.flights.noteSub')}>
            <Card>
              <PriceNotebook
                storageKey={notebookKey('flight', `${origin}-${to}`, checkIn, checkOut, travelers)}
                rows={[...flights, ...airlineLinks().slice(0, 3)].map((l) => ({ providerId: l.provider.id, label: l.provider.name }))}
                fixedQuotes={reference.data ? [referenceToQuote(reference.data, travelers)] : []}
                unit={tr('compare.flights.unit', { count: travelers })}
              />
            </Card>
          </Block>
        </>
      )}

      <Block title={tr('compare.flights.airlinesTitle')} subtitle={tr('compare.flights.airlinesSub')}>
        <ProviderList links={airlineLinks()} cta={tr('compare.flights.goTo')} />
      </Block>
    </>
  )
}

/** Códigos IATA de aerolíneas que operan en Colombia (si no está, se muestra el código). */
const AIRLINE_NAMES: Record<string, string> = { AV: 'Avianca', LA: 'LATAM', P5: 'Wingo', JA: 'JetSMART', '9R': 'SATENA', CM: 'Copa Airlines' }

function ReferenceCard({ reference, travelers }: { reference: FlightReference; travelers: number }) {
  const { t: tr } = useI18n()
  const hours = Math.max(0, Math.round((Date.now() - Date.parse(reference.fetchedAt)) / 3_600_000))
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{reference.matched === 'date' ? tr('compare.flights.fromPerPerson') : tr('compare.flights.monthCheapest')}</p>
          <p className="text-3xl font-semibold text-navy">{formatCOP(reference.priceCOP)}</p>
          <p className="mt-1 text-sm text-muted">
            {reference.airline ? `${AIRLINE_NAMES[reference.airline] ?? tr('compare.flights.airline', { code: reference.airline })} · ` : ''}
            {reference.transfers === 0 ? `${tr('compare.flights.direct')} · ` : reference.transfers ? `${tr('compare.flights.stops', { count: reference.transfers })} · ` : ''}
            {tr('compare.flights.forPassengers', { count: travelers })}: <strong className="text-ink">{formatCOP(reference.priceCOP * travelers)}</strong>
          </p>
          <p className="mt-1 text-xs text-muted">{hours > 0 ? tr('compare.flights.cacheNoteHours', { hours }) : tr('compare.flights.cacheNote')}</p>
        </div>
        <a href={reference.link} target="_blank" rel="noopener noreferrer sponsored" className="inline-flex items-center rounded-xl bg-coral px-4 py-2.5 font-bold text-on-coral hover:brightness-105">
          {tr('compare.flights.viewOnAviasales')}
          <span className="sr-only"> {tr('common.newTabHint')}</span>
        </a>
      </div>
    </Card>
  )
}

/* ───────────────────────────── Experiencias y transporte ───────────────────────────── */

function ExperiencesTab({ ctx }: { ctx: Ctx }) {
  const { t: tr } = useI18n()
  const links = useMemo(() => experienceLinks(ctx.place), [ctx.place])
  return (
    <>
      <Block title={tr('compare.exp.directTitle', { place: ctx.place })} subtitle={tr('compare.exp.directSub')} badge={<Badge tone="teal">{tr('compare.exp.direct')}</Badge>}>
        <ButtonLink to="/experiencias" variant="secondary" className="self-start">{tr('compare.exp.seeLocus')}</ButtonLink>
      </Block>
      <Block title={tr('compare.exp.compareTitle')} subtitle={tr('compare.exp.compareSub')}>
        <ProviderList links={links} cta={tr('compare.searchIn')} />
      </Block>
    </>
  )
}

function TransportTab({ ctx }: { ctx: Ctx }) {
  const { t: tr } = useI18n()
  const transport = useMemo(
    () => transportLinks(ctx.place, { checkIn: ctx.datesOk ? ctx.checkIn : undefined, checkOut: ctx.datesOk ? ctx.checkOut : undefined }),
    [ctx.place, ctx.datesOk, ctx.checkIn, ctx.checkOut],
  )
  return (
    <>
      <Block title={tr('compare.transport.title')} subtitle={tr('compare.transport.sub')}>
        <ProviderList links={transport} cta={tr('compare.transport.view')} />
      </Block>
      <Block title={tr('compare.insurance.title')} subtitle={tr('compare.insurance.sub')}>
        <ProviderList links={insuranceLinks()} cta={tr('compare.insurance.quote')} />
      </Block>
    </>
  )
}
