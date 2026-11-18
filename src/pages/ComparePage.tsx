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
import { useAsync } from '../lib/useAsync'
import type { Destination } from '../types/itinerary'

const TABS = [
  { id: 'alojamiento', label: 'Alojamiento', icon: Hotel },
  { id: 'vuelos', label: 'Vuelos', icon: Plane },
  { id: 'experiencias', label: 'Experiencias', icon: Ticket },
  { id: 'transporte', label: 'Transporte y seguro', icon: ShieldCheck },
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
      ? 'La llegada no puede estar en el pasado.'
      : checkIn && checkOut && checkOut <= checkIn
        ? 'La salida debe ser posterior a la llegada.'
        : null

  return (
    <Container className="max-w-5xl py-8 sm:py-10">
      <PageHeader eyebrow="Comparador" title="Compara todo tu viaje en un solo lugar">
        Pon tu destino y tus fechas una vez. Te llevamos a cada plataforma con la búsqueda lista y te ayudamos a decidir con números.
      </PageHeader>

      <Card>
        <form className="grid gap-4 sm:grid-cols-6" onSubmit={(e) => e.preventDefault()}>
          <div className="relative sm:col-span-6">
            <label htmlFor="cmp-dest" className="text-sm font-semibold text-ink">¿A dónde vas?</label>
            <input
              id="cmp-dest"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setChosen(null)
              }}
              autoComplete="off"
              placeholder="Cartagena, Salento, San Andrés…"
              className={`${inputClassName} mt-1`}
            />
            {!chosen && options.length > 0 && text.trim().length >= 2 && !dest && (
              <ul aria-label="Sugerencias de destino" className="mt-2 flex flex-wrap gap-2">
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
            <label htmlFor="cmp-in" className="text-sm font-semibold text-ink">Llegada / ida</label>
            <input id="cmp-in" type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={`${inputClassName} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cmp-out" className="text-sm font-semibold text-ink">Salida / regreso</label>
            <input id="cmp-out" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`${inputClassName} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <Counter label="Viajeros" icon={Users} unit="un viajero" value={travelers} min={1} max={16} onChange={setTravelers} />
          </div>
        </form>
        {dateHint && <p className="mt-3 text-sm text-danger" role="alert">{dateHint}</p>}
      </Card>

      <nav aria-label="Qué quieres comparar" className="mt-6">
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => {
            const active = t.id === tab
            const next = new URLSearchParams(params)
            next.set('tipo', t.id)
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setParams(next, { replace: true })}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold transition-colors ${
                    active ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink hover:bg-surface-2'
                  }`}
                >
                  <t.icon aria-hidden="true" className="size-4" />
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-6">
        {!hasPlace ? (
          <Alert tone="info">Escribe tu destino arriba para ver dónde comparar. Puedes empezar con las fechas si aún no lo decides.</Alert>
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
  return (
    <p className="text-xs text-muted">
      Algunos enlaces son de afiliado: si reservas, LOCUS puede recibir una comisión, sin costo extra para ti y sin cambiar el orden en que te mostramos las opciones.{' '}
      <Link to="/como-ganamos-dinero" className="underline underline-offset-2 hover:text-ink">Cómo ganamos dinero</Link>.
    </p>
  )
}

/* ───────────────────────────── Alojamiento ───────────────────────────── */

function StaysTab({ ctx }: { ctx: Ctx }) {
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
        title={`Reserva directa en LOCUS · ${place}`}
        subtitle="Alojamientos de anfitriones de LOCUS: precio real, sin cargos de servicio para ti."
        badge={<Badge tone="teal">Sin comisión para el huésped</Badge>}
      >
        {!dest ? (
          <Alert tone="info">Elige una de las sugerencias de destino para ver los alojamientos de LOCUS cerca.</Alert>
        ) : listings.loading ? (
          <Spinner label="Buscando alojamientos…" />
        ) : near.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {near.slice(0, 3).map((l) => (
                <li key={l.id}>
                  <ListingCard listing={l} search={search} />
                  {datesOk && validateStay(l, { checkIn, checkOut, guests: travelers }, todayISO()) === null && (
                    <p className="mt-2 text-sm text-ink">
                      <strong>{formatCOP(quoteStay(l, { checkIn, checkOut, guests: travelers }).total)}</strong>{' '}
                      <span className="text-muted">en total · {formatDate(checkIn)} – {formatDate(checkOut)}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {near.length > 3 && <ButtonLink to="/explorar" variant="secondary" className="self-start">Ver los {near.length} alojamientos</ButtonLink>}
          </>
        ) : (
          <Alert tone="info">
            Aún no hay anfitriones de LOCUS cerca de {place}. Compara abajo en otras plataformas, o{' '}
            <Link to="/anfitrion" className="font-semibold underline">publica tu alojamiento</Link> y sé el primero.
          </Alert>
        )}
      </Block>

      <Block
        title="Compara en otras plataformas"
        subtitle={datesOk ? `Abrimos cada una con ${place}, tus fechas y ${travelers} ${travelers === 1 ? 'viajero' : 'viajeros'} ya puestos.` : 'Agrega fechas arriba para que lleguen puestas; si no, solo llega el destino.'}
      >
        <ProviderList links={links} cta="Buscar en" />
      </Block>

      <Block title="Anota y decide" subtitle="La forma más rápida de saber cuál conviene de verdad.">
        <Card>
          <PriceNotebook
            storageKey={notebookKey('stay', place, checkIn, checkOut, travelers)}
            rows={links.filter((l) => l.prefill !== 'none' || l.provider.id === 'despegar').slice(0, 6).map((l) => ({ providerId: l.provider.id, label: l.provider.name }))}
            fixedQuotes={locusQuote}
            unit="total de la estadía"
          />
        </Card>
      </Block>

      <Block title="¿Ya viste un alojamiento que te gusta?" subtitle="Escribe su nombre y lo buscamos en las otras plataformas para comparar el precio del mismo lugar.">
        <Card>
          <label htmlFor="cmp-prop" className="text-sm font-semibold text-ink">Nombre del alojamiento</label>
          <input id="cmp-prop" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Ej. Finca El Cafetal" className={`${inputClassName} mt-1`} />
          {sameProperty.length > 0 && (
            <div className="mt-4">
              <ProviderList links={sameProperty} cta="Buscarlo en" />
            </div>
          )}
        </Card>
      </Block>
    </>
  )
}

/* ───────────────────────────── Vuelos ───────────────────────────── */

function FlightsTab({ ctx }: { ctx: Ctx }) {
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
  const options = AIRPORTS.map((a) => (
    <option key={a.iata} value={a.iata}>
      {a.city} · {a.name} ({a.iata})
    </option>
  ))

  return (
    <>
      <Block title="Tu ruta" subtitle="Usamos tus fechas de arriba: llegada = ida, salida = regreso (opcional).">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cmp-o" className="text-sm font-semibold text-ink">Origen</label>
              <select id="cmp-o" value={origin} onChange={(e) => setOrigin(e.target.value)} className={`${selectClassName} mt-1`}>{options}</select>
            </div>
            <div>
              <label htmlFor="cmp-d" className="text-sm font-semibold text-ink">Destino</label>
              <select id="cmp-d" value={to} onChange={(e) => setDestOverride(e.target.value)} className={`${selectClassName} mt-1`}>{options}</select>
            </div>
          </div>
          {same && <p className="mt-3 text-sm text-danger" role="alert">El origen y el destino son el mismo aeropuerto.</p>}
          {!checkIn && <p className="mt-3 text-sm text-muted">Elige la fecha de ida arriba para pre-llenar la búsqueda.</p>}
        </Card>
      </Block>

      {flights.length > 0 && (
        <>
          <Block title="Compara en buscadores de vuelos" subtitle="Cada uno revisa decenas de aerolíneas y agencias; abre dos o tres y compara.">
            <ProviderList links={flights} cta="Ver vuelos en" />
          </Block>
          <Block title="Anota y decide" subtitle="Incluye el equipaje: en bajo costo se cobra aparte.">
            <Card>
              <PriceNotebook
                storageKey={notebookKey('flight', `${origin}-${to}`, checkIn, checkOut, travelers)}
                rows={[...flights, ...airlineLinks().slice(0, 3)].map((l) => ({ providerId: l.provider.id, label: l.provider.name }))}
                unit={`total para ${travelers} ${travelers === 1 ? 'pasajero' : 'pasajeros'}`}
              />
            </Card>
          </Block>
        </>
      )}

      <Block title="Aerolíneas directas" subtitle="A veces la tarifa del sitio oficial es la más barata (cambios, equipaje, millas). No llegan pre-llenadas: repite tu búsqueda.">
        <ProviderList links={airlineLinks()} cta="Ir a" />
      </Block>
    </>
  )
}

/* ───────────────────────────── Experiencias y transporte ───────────────────────────── */

function ExperiencesTab({ ctx }: { ctx: Ctx }) {
  const links = useMemo(() => experienceLinks(ctx.place), [ctx.place])
  return (
    <>
      <Block title={`Experiencias en LOCUS · ${ctx.place}`} subtitle="Actividades publicadas por anfitriones locales, con cupos y precio real." badge={<Badge tone="teal">Reserva directa</Badge>}>
        <ButtonLink to="/experiencias" variant="secondary" className="self-start">Ver experiencias de LOCUS</ButtonLink>
      </Block>
      <Block title="Compara tours y actividades" subtitle="Mismos destinos en los marketplaces de experiencias más grandes.">
        <ProviderList links={links} cta="Buscar en" />
      </Block>
    </>
  )
}

function TransportTab({ ctx }: { ctx: Ctx }) {
  const transport = useMemo(
    () => transportLinks(ctx.place, { checkIn: ctx.datesOk ? ctx.checkIn : undefined, checkOut: ctx.datesOk ? ctx.checkOut : undefined }),
    [ctx.place, ctx.datesOk, ctx.checkIn, ctx.checkOut],
  )
  return (
    <>
      <Block title="Buses y alquiler de carro" subtitle="Para moverte entre ciudades o recorrer la región a tu ritmo.">
        <ProviderList links={transport} cta="Ver en" />
      </Block>
      <Block title="Seguro de viaje" subtitle="Cubre salud, cancelaciones y equipaje. Revisa bien las coberturas antes de comprar.">
        <ProviderList links={insuranceLinks()} cta="Cotizar en" />
      </Block>
    </>
  )
}
