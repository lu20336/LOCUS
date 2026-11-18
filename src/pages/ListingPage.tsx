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
import { useI18n } from '../lib/i18n/I18nProvider'
import { LocusMap } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'

const STATUS_LABEL: Record<string, string> = {
  draft: 'ls.draft', pending: 'ls.pending', rejected: 'ls.rejected', suspended: 'ls.suspended', published: 'ls.published',
}

function Gallery({ listing }: { listing: Listing }) {
  const { t } = useI18n()
  const photos = useAsync(() => fetchPhotos(db, 'listings', listing.id), [listing.id])
  const [index, setIndex] = useState(0)
  const urls = photos.data && photos.data.length > 0 ? photos.data.map((p) => p.dataUrl) : listing.cover && listing.photoCount > 0 ? [listing.cover] : []
  if (urls.length === 0) return <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-surface-2 text-muted">{t('lp.noPhotos')}</div>
  return (
    <div>
      <img src={urls[Math.min(index, urls.length - 1)]} alt={t('lp.photoAlt', { n: index + 1, total: urls.length, title: listing.title })} className="aspect-[16/9] w-full rounded-3xl object-cover" />
      {urls.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {urls.map((u, i) => (
            <li key={i} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={t('lp.viewPhoto', { n: i + 1 })} aria-current={i === index} className={`overflow-hidden rounded-xl border-2 ${i === index ? 'border-teal' : 'border-transparent'}`}>
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
  const { t } = useI18n()
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
      return { problem: t('lp.unavailableNights'), quote: null, ready: false }
    }
    return { problem: null, quote: quoteStay(listing, request), ready: true }
  }, [listing, checkIn, checkOut, guests, today, booked, blocked, t])

  if (listingState.loading) return <Container className="py-10"><Spinner label={t('lp.loading')} /></Container>
  if (!listing) {
    return <Container className="py-12"><EmptyState title={t('lp.notFound')} action={<ButtonLink to="/explorar">{t('lp.seeStays')}</ButtonLink>}>{t('lp.notFoundText')}</EmptyState></Container>
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
        guestName: profile?.displayName || user.displayName || t('lp.guestDefault'),
        request: { checkIn, checkOut, guests },
        today,
      })
      navigate(`/reservas?nueva=${bookingId}`)
    } catch (e) {
      setConfirming(false)
      setError(e instanceof BookingError ? e.message : t('lp.bookError'))
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
        <div className="mb-4"><Alert tone="info">{t('lp.preview', { status: t(STATUS_LABEL[listing.status] ?? listing.status) })}</Alert></div>
      )}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{LISTING_TYPES[listing.type]} · {listing.municipality}, {listing.department}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">{listing.title}</h1>
          <p className="mt-1 text-muted">
            {rating !== null ? t('lp.reviewsCount', { rating, count: reviews.data?.length ?? 0 }) : t('lp.noReviewsYet')}
            {listing.isTestData && <> · <Badge tone="warn">{t('cat.testData')}</Badge></>}
          </p>
        </div>
        <FavoriteButton className="border border-line" item={{ kind: 'listing', refId: listing.id, title: listing.title, subtitle: listing.municipality }} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-8">
          <Gallery listing={listing} />

          <section aria-labelledby="about">
            <h2 id="about" className="text-2xl font-semibold text-navy">{t('lp.about')}</h2>
            <p className="mt-1 text-muted">
              {t('lc.guestsCount', { count: listing.capacity })} · {t('lc.bedrooms', { count: listing.bedrooms })} · {t('lc.beds', { count: listing.beds })} · {t('lc.bathrooms', { count: listing.bathrooms })}
            </p>
            <p className="mt-3 whitespace-pre-line text-ink">{listing.description || t('lp.noDescription')}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="amen">
              <h2 id="amen" className="text-2xl font-semibold text-navy">{t('lp.amenities')}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.amenities.map((a) => <li key={a} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">✓ {AMENITIES[a] ?? a}</li>)}
              </ul>
            </section>
          )}

          <section aria-labelledby="where">
            <h2 id="where" className="text-2xl font-semibold text-navy">{t('lp.where')}</h2>
            <p className="mt-1 text-muted">{listing.addressReference || `${listing.municipality}, ${listing.department}`}</p>
            <div className="mt-3">
              <LocusMap markers={[{ id: listing.id, lat: listing.lat, lon: listing.lon, kind: 'listing' }]} center={[listing.lat, listing.lon]} zoom={14} className="h-72" ariaLabel={t('lp.locationLabel')} />
            </div>
          </section>

          <StreetPhotos lat={listing.lat} lon={listing.lon} />
          <WeatherPanel lat={listing.lat} lon={listing.lon} title={t('lp.weatherIn', { place: listing.municipality })} />

          <section aria-labelledby="rules">
            <h2 id="rules" className="text-2xl font-semibold text-navy">{t('lp.rules')}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink">
              <li><strong>{t('lp.checkInLabel')}</strong> {listing.checkInTime || t('lp.toArrange')} · <strong>{t('lp.checkOutLabel')}</strong> {listing.checkOutTime || t('lp.toArrange')}</li>
              <li><strong>{t('lp.stayLabel')}</strong> {t('lp.stayRange', { min: listing.minNights, max: listing.maxNights })}</li>
              <li><strong>{t('lp.cancellation', { policy: policy.label.toLowerCase() })}</strong> {policy.description}</li>
              {listing.rules && <li className="whitespace-pre-line"><strong>{t('lp.hostRules')}</strong> {listing.rules}</li>}
            </ul>
          </section>

          <section aria-labelledby="host">
            <h2 id="host" className="text-2xl font-semibold text-navy">{t('lp.yourHost')}</h2>
            <p className="mt-2 text-ink">
              <strong>{host.data?.displayName ?? t('lp.hostDefault')}</strong>{' '}
              {host.data?.verified ? <Badge tone="teal">{t('lp.verified')}</Badge> : <Badge>{t('lp.notVerified')}</Badge>}
            </p>
            {host.data?.bio && <p className="mt-1 text-muted">{host.data.bio}</p>}
          </section>

          <section aria-labelledby="reviews">
            <h2 id="reviews" className="text-2xl font-semibold text-navy">{t('lp.reviews')}</h2>
            {(reviews.data ?? []).length === 0 ? (
              <p className="mt-2 text-muted">{t('lp.noReviews')}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {reviews.data!.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                    <p className="font-semibold text-ink">{r.guestName || t('lp.guestDefault')} · {'★'.repeat(r.rating)}<span className="text-muted">{'★'.repeat(5 - r.rating)}</span></p>
                    {r.text && <p className="mt-1 text-sm text-ink">{r.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Reserva */}
        <aside aria-label={t('lp.book')} className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-lg">
            <p className="text-2xl font-semibold text-ink">{formatCOP(listing.pricePerNight)} <span className="text-base font-normal text-muted">{t('common.perNight')}</span></p>

            <div className="mt-4">
              {calendar.loading ? (
                <Spinner label={t('lp.loadingAvailability')} />
              ) : (
                <MonthCalendar
                  today={today}
                  focusDate={checkIn || undefined}
                  ariaLabel={t('lp.calendarLabel')}
                  onSelect={pickDay}
                  cellState={(iso) => {
                    const occupied = iso in booked || iso in blocked
                    const choosingCheckout = Boolean(checkIn && !checkOut)
                    if (iso === checkIn || iso === checkOut) return { tone: 'selected' }
                    if (checkIn && checkOut && iso > checkIn && iso < checkOut) return { tone: 'range' }
                    if (occupied) return { tone: iso in booked ? 'booked' : 'blocked', disabled: !choosingCheckout, hint: t('lp.unavailable') }
                    return { tone: 'free' }
                  }}
                />
              )}
              <p className="mt-2 text-xs text-muted">{t('lp.calendarHint')}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="font-semibold">{t('lp.arrival')}</p><p>{checkIn ? formatDate(checkIn) : t('lp.pickDate')}</p></div>
              <div><p className="font-semibold">{t('lp.departure')}</p><p>{checkOut ? formatDate(checkOut) : t('lp.pickDate')}</p></div>
            </div>
            <div className="mt-3">
              <Counter label={t('ex.guests')} icon={Users} unit={t('ex.oneGuest')} value={guests} min={1} max={listing.capacity} onChange={setGuests} hint={guests > listing.includedGuests ? t('lp.extraGuestHint', { included: listing.includedGuests, fee: formatCOP(listing.extraGuestFee) }) : undefined} />
            </div>

            {stay.problem && <div className="mt-3"><Alert tone="info">{stay.problem}</Alert></div>}
            {error && <div className="mt-3"><Alert>{error}</Alert></div>}

            {stay.quote && (
              <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt>{t('lp.nights', { price: formatCOP(stay.quote.nightly), count: stay.quote.nights })}</dt><dd>{formatCOP(stay.quote.subtotal)}</dd></div>
                {stay.quote.cleaningFee > 0 && <div className="flex justify-between"><dt>{t('lp.cleaningFee')}</dt><dd>{formatCOP(stay.quote.cleaningFee)}</dd></div>}
                {stay.quote.extraGuestsFee > 0 && <div className="flex justify-between"><dt>{t('lp.extraGuests')}</dt><dd>{formatCOP(stay.quote.extraGuestsFee)}</dd></div>}
                <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>{t('lp.total')}</dt><dd>{formatCOP(stay.quote.total)}</dd></div>
              </dl>
            )}

            <div className="mt-4">
              {isOwner ? (
                <ButtonLink to={`/anfitrion/alojamientos/${listing.id}`} variant="secondary" className="w-full">{t('lp.editMine')}</ButtonLink>
              ) : !user ? (
                <ButtonLink to={`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`} className="w-full">{t('lp.signInToBook')}</ButtonLink>
              ) : (
                <Button className="w-full" disabled={!stay.ready || listing.status !== 'published'} onClick={() => setConfirming(true)}>
                  {listing.bookingMode === 'instant' ? t('lp.book') : t('lp.requestBooking')}
                </Button>
              )}
              <p className="mt-2 text-center text-xs text-muted">
                {listing.bookingMode === 'instant' ? t('lp.instant') : t('lp.hostMustAccept')} {t('lp.noChargeYet')}
              </p>
            </div>
          </div>
          {!isOwner && <p className="mt-3 text-center text-xs text-muted">{t('lp.questions')} <Link to="/perfil" className="underline">{t('lp.talkToCompanion')}</Link> {t('lp.floatingButton')}</p>}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={listing.bookingMode === 'instant' ? t('lp.confirmBooking') : t('lp.confirmRequest')}
        confirmLabel={listing.bookingMode === 'instant' ? t('lp.confirmBookingBtn') : t('lp.sendRequest')}
        busy={busy}
        onConfirm={reserve}
        onCancel={() => setConfirming(false)}
      >
        {stay.quote && (
          <div className="flex flex-col gap-2">
            <p><strong>{listing.title}</strong></p>
            <p>{formatDate(checkIn)} → {formatDate(checkOut)} · {t('common.nights', { count: nightsSelected })} · {t('common.guests', { count: guests })}</p>
            <p>{t('lp.totalLine')} <strong>{formatCOP(stay.quote.total)}</strong></p>
            <p className="rounded-xl bg-surface-2 p-3"><strong>{t('lp.simulatedPayment')}</strong> {t('lp.simulatedBody')}</p>
            <p><strong>{t('lp.cancellation', { policy: policy.label.toLowerCase() })}</strong> {policy.description}</p>
          </div>
        )}
      </ConfirmDialog>
    </Container>
  )
}
