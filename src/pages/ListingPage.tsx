import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { doc, getDoc } from 'firebase/firestore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Counter } from '../components/Counter'
import { FavoriteButton } from '../components/FavoriteButton'
import { MonthCalendar } from '../components/MonthCalendar'
import { StreetPhotos } from '../components/StreetPhotos'
import { WeatherPanel } from '../components/WeatherPanel'
import { Alert, Badge, Button, ButtonLink, Container, EmptyState, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { BookingError, placeStayBooking } from '../lib/booking/bookingService'
import { fetchCalendar, fetchItem, fetchPhotos } from '../lib/catalog/repo'
import { averageRating, fetchReviews } from '../lib/catalog/reviews'
import { eachNight } from '../lib/domain/dates'
import { conflictingNights, quoteStay, validateStay } from '../lib/domain/pricing'
import { AMENITIES, CANCELLATION_POLICIES, LISTING_TYPES, type Listing } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { formatCOP, formatDate, todayISO } from '../lib/format'
import { LocusMap } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', pending: 'Pendiente de revisión', rejected: 'Rechazado', suspended: 'Suspendido', published: 'Publicado',
}

function Gallery({ listing }: { listing: Listing }) {
  const photos = useAsync(() => fetchPhotos(db, 'listings', listing.id), [listing.id])
  const [index, setIndex] = useState(0)
  const urls = photos.data && photos.data.length > 0 ? photos.data.map((p) => p.dataUrl) : listing.cover && listing.photoCount > 0 ? [listing.cover] : []
  if (urls.length === 0) return <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-surface-2 text-muted">Este alojamiento aún no tiene fotos</div>
  return (
    <div>
      <img src={urls[Math.min(index, urls.length - 1)]} alt={`Foto ${index + 1} de ${urls.length} de ${listing.title}`} className="aspect-[16/9] w-full rounded-3xl object-cover" />
      {urls.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {urls.map((u, i) => (
            <li key={i} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === index} className={`overflow-hidden rounded-xl border-2 ${i === index ? 'border-teal' : 'border-transparent'}`}>
                <img src={u} alt="" className="h-16 w-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ListingPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const today = todayISO()

  const listingState = useAsync(() => fetchItem<Listing>(db, 'listings', id), [id])
  const calendar = useAsync(() => fetchCalendar(db, id), [id])
  const reviews = useAsync(() => fetchReviews(db, id), [id])
  const host = useAsync(async () => {
    const l = listingState.data
    if (!l) return null
    const snap = await getDoc(doc(db, 'hosts', l.hostId))
    return snap.exists() ? (snap.data() as { displayName: string; bio: string; verified: boolean }) : null
  }, [listingState.data?.hostId])

  const [checkIn, setCheckIn] = useState(params.get('llegada') ?? '')
  const [checkOut, setCheckOut] = useState(params.get('salida') ?? '')
  const [guests, setGuests] = useState(Number(params.get('huespedes')) || 1)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listing = listingState.data
  const booked = useMemo(() => calendar.data?.booked ?? {}, [calendar.data])
  const blocked = useMemo(() => calendar.data?.hostBlocked ?? {}, [calendar.data])

  const stay = useMemo(() => {
    if (!listing || !checkIn || !checkOut) return { problem: null as string | null, quote: null, ready: false }
    const request = { checkIn, checkOut, guests }
    const problem = validateStay(listing, request, today)
    if (problem) return { problem, quote: null, ready: false }
    if (conflictingNights(checkIn, checkOut, booked, blocked).length > 0) {
      return { problem: 'Alguna de esas noches no está disponible. Elige otras fechas en el calendario.', quote: null, ready: false }
    }
    return { problem: null, quote: quoteStay(listing, request), ready: true }
  }, [listing, checkIn, checkOut, guests, today, booked, blocked])

  if (listingState.loading) return <Container className="py-10"><Spinner label="Cargando el alojamiento…" /></Container>
  if (!listing) {
    return <Container className="py-12"><EmptyState title="No encontramos este alojamiento" action={<ButtonLink to="/explorar">Ver alojamientos</ButtonLink>}>Puede que ya no esté publicado.</EmptyState></Container>
  }

  const rating = averageRating(reviews.data ?? [])
  const isOwner = user?.uid === listing.hostId

  function pickDay(iso: string) {
    if (!checkIn || (checkIn && checkOut) || iso <= checkIn) {
      setCheckIn(iso)
      setCheckOut('')
    } else setCheckOut(iso)
  }

  async function reserve() {
    if (!user || !listing) return
    setBusy(true)
    setError(null)
    try {
      const bookingId = await placeStayBooking(db, {
        listing,
        guestId: user.uid,
        guestName: profile?.displayName || user.displayName || 'Huésped',
        request: { checkIn, checkOut, guests },
        today,
      })
      navigate(`/reservas?nueva=${bookingId}`)
    } catch (e) {
      setConfirming(false)
      setError(e instanceof BookingError ? e.message : 'No pudimos completar la reserva.')
      calendar.reload()
    } finally {
      setBusy(false)
    }
  }

  const policy = CANCELLATION_POLICIES[listing.cancellationPolicy]
  const nightsSelected = checkIn && checkOut ? eachNight(checkIn, checkOut).length : 0

  return (
    <Container className="py-8 sm:py-10">
      {listing.status !== 'published' && (
        <div className="mb-4"><Alert tone="info">Vista previa para ti: este alojamiento está en estado «{STATUS_LABEL[listing.status]}» y no es visible para otros huéspedes.</Alert></div>
      )}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{LISTING_TYPES[listing.type]} · {listing.municipality}, {listing.department}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">{listing.title}</h1>
          <p className="mt-1 text-muted">
            {rating !== null ? `★ ${rating} (${reviews.data?.length} ${reviews.data?.length === 1 ? 'reseña' : 'reseñas'})` : 'Aún sin reseñas'}
            {listing.isTestData && <> · <Badge tone="warn">Dato de prueba</Badge></>}
          </p>
        </div>
        <FavoriteButton className="border border-line" item={{ kind: 'listing', refId: listing.id, title: listing.title, subtitle: listing.municipality }} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-8">
          <Gallery listing={listing} />

          <section aria-labelledby="about">
            <h2 id="about" className="text-2xl font-semibold text-navy">Sobre este alojamiento</h2>
            <p className="mt-1 text-muted">
              {listing.capacity} huéspedes · {listing.bedrooms} {listing.bedrooms === 1 ? 'habitación' : 'habitaciones'} · {listing.beds} {listing.beds === 1 ? 'cama' : 'camas'} · {listing.bathrooms} {listing.bathrooms === 1 ? 'baño' : 'baños'}
            </p>
            <p className="mt-3 whitespace-pre-line text-ink">{listing.description || 'El anfitrión aún no agregó una descripción.'}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="amen">
              <h2 id="amen" className="text-2xl font-semibold text-navy">Comodidades</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.amenities.map((a) => <li key={a} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">✓ {AMENITIES[a] ?? a}</li>)}
              </ul>
            </section>
          )}

          <section aria-labelledby="where">
            <h2 id="where" className="text-2xl font-semibold text-navy">Dónde está</h2>
            <p className="mt-1 text-muted">{listing.addressReference || `${listing.municipality}, ${listing.department}`}</p>
            <div className="mt-3">
              <LocusMap markers={[{ id: listing.id, lat: listing.lat, lon: listing.lon, kind: 'listing' }]} center={[listing.lat, listing.lon]} zoom={14} className="h-72" ariaLabel="Ubicación del alojamiento" />
            </div>
          </section>

          <StreetPhotos lat={listing.lat} lon={listing.lon} />
          <WeatherPanel lat={listing.lat} lon={listing.lon} title={`El clima en ${listing.municipality}`} />

          <section aria-labelledby="rules">
            <h2 id="rules" className="text-2xl font-semibold text-navy">Reglas y políticas</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink">
              <li><strong>Llegada:</strong> {listing.checkInTime || 'a convenir'} · <strong>Salida:</strong> {listing.checkOutTime || 'a convenir'}</li>
              <li><strong>Estadía:</strong> de {listing.minNights} a {listing.maxNights} noches</li>
              <li><strong>Cancelación {policy.label.toLowerCase()}:</strong> {policy.description}</li>
              {listing.rules && <li className="whitespace-pre-line"><strong>Reglas del anfitrión:</strong> {listing.rules}</li>}
            </ul>
          </section>

          <section aria-labelledby="host">
            <h2 id="host" className="text-2xl font-semibold text-navy">Tu anfitrión</h2>
            <p className="mt-2 text-ink">
              <strong>{host.data?.displayName ?? 'Anfitrión de LOCUS'}</strong>{' '}
              {host.data?.verified ? <Badge tone="teal">Verificado por LOCUS</Badge> : <Badge>Aún sin verificar</Badge>}
            </p>
            {host.data?.bio && <p className="mt-1 text-muted">{host.data.bio}</p>}
          </section>

          <section aria-labelledby="reviews">
            <h2 id="reviews" className="text-2xl font-semibold text-navy">Reseñas</h2>
            {(reviews.data ?? []).length === 0 ? (
              <p className="mt-2 text-muted">Todavía no hay reseñas. Solo pueden reseñar quienes completaron una estadía.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {reviews.data!.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                    <p className="font-semibold text-ink">{r.guestName || 'Huésped'} · {'★'.repeat(r.rating)}<span className="text-muted">{'★'.repeat(5 - r.rating)}</span></p>
                    {r.text && <p className="mt-1 text-sm text-ink">{r.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Reserva */}
        <aside aria-label="Reservar" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-lg">
            <p className="text-2xl font-semibold text-ink">{formatCOP(listing.pricePerNight)} <span className="text-base font-normal text-muted">por noche</span></p>

            <div className="mt-4">
              {calendar.loading ? (
                <Spinner label="Cargando disponibilidad…" />
              ) : (
                <MonthCalendar
                  today={today}
                  focusDate={checkIn || undefined}
                  ariaLabel="Disponibilidad: elige llegada y salida"
                  onSelect={pickDay}
                  cellState={(iso) => {
                    const occupied = iso in booked || iso in blocked
                    const choosingCheckout = Boolean(checkIn && !checkOut)
                    if (iso === checkIn || iso === checkOut) return { tone: 'selected' }
                    if (checkIn && checkOut && iso > checkIn && iso < checkOut) return { tone: 'range' }
                    if (occupied) return { tone: iso in booked ? 'booked' : 'blocked', disabled: !choosingCheckout, hint: 'no disponible' }
                    return { tone: 'free' }
                  }}
                />
              )}
              <p className="mt-2 text-xs text-muted">Tachado = noche no disponible. Elige la llegada y luego la salida.</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="font-semibold">Llegada</p><p>{checkIn ? formatDate(checkIn) : 'Elige una fecha'}</p></div>
              <div><p className="font-semibold">Salida</p><p>{checkOut ? formatDate(checkOut) : 'Elige una fecha'}</p></div>
            </div>
            <div className="mt-3">
              <Counter label="Huéspedes" icon={Users} unit="un huésped" value={guests} min={1} max={listing.capacity} onChange={setGuests} hint={guests > listing.includedGuests ? `Incluye ${listing.includedGuests}; cada huésped extra cuesta ${formatCOP(listing.extraGuestFee)} por noche.` : undefined} />
            </div>

            {stay.problem && <div className="mt-3"><Alert tone="info">{stay.problem}</Alert></div>}
            {error && <div className="mt-3"><Alert>{error}</Alert></div>}

            {stay.quote && (
              <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt>{formatCOP(stay.quote.nightly)} × {stay.quote.nights} {stay.quote.nights === 1 ? 'noche' : 'noches'}</dt><dd>{formatCOP(stay.quote.subtotal)}</dd></div>
                {stay.quote.cleaningFee > 0 && <div className="flex justify-between"><dt>Tarifa de limpieza</dt><dd>{formatCOP(stay.quote.cleaningFee)}</dd></div>}
                {stay.quote.extraGuestsFee > 0 && <div className="flex justify-between"><dt>Huéspedes extra</dt><dd>{formatCOP(stay.quote.extraGuestsFee)}</dd></div>}
                <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatCOP(stay.quote.total)}</dd></div>
              </dl>
            )}

            <div className="mt-4">
              {isOwner ? (
                <ButtonLink to={`/anfitrion/alojamientos/${listing.id}`} variant="secondary" className="w-full">Editar mi alojamiento</ButtonLink>
              ) : !user ? (
                <ButtonLink to={`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`} className="w-full">Ingresa para reservar</ButtonLink>
              ) : (
                <Button className="w-full" disabled={!stay.ready || listing.status !== 'published'} onClick={() => setConfirming(true)}>
                  {listing.bookingMode === 'instant' ? 'Reservar' : 'Solicitar reserva'}
                </Button>
              )}
              <p className="mt-2 text-center text-xs text-muted">
                {listing.bookingMode === 'instant' ? 'Reserva inmediata.' : 'El anfitrión debe aceptar tu solicitud.'} No se te cobra nada todavía: los pagos están en modo de prueba.
              </p>
            </div>
          </div>
          {!isOwner && <p className="mt-3 text-center text-xs text-muted">¿Dudas? <Link to="/perfil" className="underline">Habla con tu compañero LOCUS</Link> (botón flotante).</p>}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={listing.bookingMode === 'instant' ? 'Confirma tu reserva' : 'Confirma tu solicitud'}
        confirmLabel={listing.bookingMode === 'instant' ? 'Confirmar reserva' : 'Enviar solicitud'}
        busy={busy}
        onConfirm={reserve}
        onCancel={() => setConfirming(false)}
      >
        {stay.quote && (
          <div className="flex flex-col gap-2">
            <p><strong>{listing.title}</strong></p>
            <p>{formatDate(checkIn)} → {formatDate(checkOut)} · {nightsSelected} {nightsSelected === 1 ? 'noche' : 'noches'} · {guests} {guests === 1 ? 'huésped' : 'huéspedes'}</p>
            <p>Total: <strong>{formatCOP(stay.quote.total)}</strong></p>
            <p className="rounded-xl bg-surface-2 p-3"><strong>Pago simulado:</strong> LOCUS aún no cobra dinero real. Esta reserva sirve para probar el flujo.</p>
            <p><strong>Cancelación {policy.label.toLowerCase()}:</strong> {policy.description}</p>
          </div>
        )}
      </ConfirmDialog>
    </Container>
  )
}
