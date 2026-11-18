/** Mis reservas (huésped): próximas, pasadas y canceladas; cancelar y dejar reseñas. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { doc, getDoc } from 'firebase/firestore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Wallet } from 'lucide-react'
import { Alert, Badge, Button, ButtonLink, Card, Container, EmptyState, PageHeader, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { BookingError, cancelBooking } from '../lib/booking/bookingService'
import { fetchBookings } from '../lib/catalog/repo'
import { submitReview } from '../lib/catalog/reviews'
import { refundFor } from '../lib/domain/pricing'
import type { Booking, BookingStatus, StayPricing } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { formatCOP, formatDate, todayISO } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useAsync } from '../lib/useAsync'

/** Tono de cada estado; el texto está en las claves book.status.* (se traduce con t() al mostrarlo). */
export const STATUS_LABELS: Record<BookingStatus, { label: string; tone: 'teal' | 'warn' | 'danger' | 'neutral' }> = {
  pending: { label: 'book.status.pending', tone: 'warn' },
  confirmed: { label: 'book.status.confirmed', tone: 'teal' },
  cancelled_by_guest: { label: 'book.status.cancelled_by_guest', tone: 'danger' },
  cancelled_by_host: { label: 'book.status.cancelled_by_host', tone: 'danger' },
  completed: { label: 'book.status.completed', tone: 'neutral' },
}

export const bookingLink = (b: Booking) => (b.kind === 'listing' ? `/hospedajes/${b.itemId}` : `/experiencias/${b.itemId}`)
export const bookingWhen = (b: Booking) =>
  b.kind === 'listing' ? `${formatDate(b.checkIn!)} → ${formatDate(b.checkOut!)}` : `${formatDate(b.date!)} · ${b.startTime}`
const lastDay = (b: Booking) => (b.kind === 'listing' ? b.checkOut! : b.date!)
const isCancelled = (b: Booking) => b.status === 'cancelled_by_guest' || b.status === 'cancelled_by_host'

function ReviewForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!user) return
    setBusy(true)
    try {
      await submitReview(db, booking.id, { kind: booking.kind, itemId: booking.itemId, guestId: user.uid, guestName: booking.guestName, rating, text })
      onDone()
    } catch {
      setError(t('book.review.error'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 p-4">
      <p className="font-semibold text-ink">{t('book.review.title')}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t('book.review.rating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t('book.review.stars', { count: n })} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-muted'}`}>★</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} placeholder={t('book.review.placeholder')} className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
      {error && <Alert>{error}</Alert>}
      <Button className="mt-2" onClick={send} disabled={busy}>{busy ? t('book.review.sending') : t('book.review.publish')}</Button>
    </div>
  )
}

function BookingCard({ booking, onChanged, highlight }: { booking: Booking; onChanged: () => void; highlight: boolean }) {
  const { t } = useI18n()
  const today = todayISO()
  const [cancelling, setCancelling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = STATUS_LABELS[booking.status]
  const reviewed = useAsync(async () => (booking.status === 'completed' ? (await getDoc(doc(db, 'reviews', booking.id))).exists() : true), [booking.id, booking.status])
  const [reviewedNow, setReviewedNow] = useState(false)

  const total = (booking.pricing as { total: number }).total
  const refund =
    booking.kind === 'listing'
      ? refundFor(booking.cancellationPolicy, total, (booking.pricing as StayPricing).nightly, booking.checkIn!, today)
      : refundFor(booking.cancellationPolicy, total, total, booking.date!, today)
  const canCancel = (booking.status === 'confirmed' || booking.status === 'pending') && lastDay(booking) >= today

  async function doCancel() {
    setBusy(true)
    try {
      await cancelBooking(db, booking, 'guest', today)
      setCancelling(false)
      onChanged()
    } catch (e) {
      setError(e instanceof BookingError ? e.message : t('book.cancelError'))
      setCancelling(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={highlight ? 'ring-2 ring-teal' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{booking.kind === 'listing' ? t('book.kind.listing') : t('book.kind.experience')}</p>
          <h3 className="font-serif text-xl font-semibold text-navy"><Link to={bookingLink(booking)} className="hover:underline">{booking.itemTitle}</Link></h3>
          <p className="text-sm text-muted">{bookingWhen(booking)} · {booking.kind === 'listing' ? t('book.guests', { count: booking.guests ?? 1 }) : t('book.people', { count: booking.people ?? 1 })}</p>
        </div>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
      </div>
      <p className="mt-2 text-ink">{t('book.total')} <strong>{formatCOP(total)}</strong> <span className="text-xs text-muted">{t('book.simulated')}</span></p>
      {isCancelled(booking) && booking.refundAmount !== undefined && <p className="text-sm text-muted">{t('book.refund', { amount: formatCOP(booking.refundAmount) })}</p>}
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      {canCancel && <Button variant="danger" className="mt-3" onClick={() => setCancelling(true)}>{t('book.cancel')}</Button>}
      {booking.status === 'completed' && reviewed.data === false && !reviewedNow && <ReviewForm booking={booking} onDone={() => setReviewedNow(true)} />}
      {reviewedNow && <p className="mt-2 text-sm text-teal-soft">{t('book.thanks')}</p>}

      <ConfirmDialog open={cancelling} title={t('book.cancelTitle')} confirmLabel={t('book.cancelConfirm')} danger busy={busy} onConfirm={doCancel} onCancel={() => setCancelling(false)}>
        <p>{t('book.cancelBody', { policy: booking.cancellationPolicy, amount: formatCOP(refund) })}</p>
        <p className="mt-2">{t('book.cancelWarning')}</p>
      </ConfirmDialog>
    </Card>
  )
}

export default function TripsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const newId = params.get('nueva')
  const bookings = useAsync(() => fetchBookings(db, 'guest', user!.uid), [user?.uid])
  const today = todayISO()

  const list = bookings.data ?? []
  const upcoming = list.filter((b) => !isCancelled(b) && b.status !== 'completed' && lastDay(b) >= today)
  const past = list.filter((b) => !isCancelled(b) && !upcoming.includes(b))
  const cancelled = list.filter(isCancelled)

  const section = (title: string, items: Booking[]) =>
    items.length > 0 && (
      <section aria-label={title} className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-navy">{title}</h2>
        {items.map((b) => <BookingCard key={b.id} booking={b} onChanged={bookings.reload} highlight={b.id === newId} />)}
      </section>
    )

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow={t('nav.yourSpace')} title={t('nav.myBookings')}>{t('book.intro')}</PageHeader>
      {newId && <div className="mb-6"><Alert tone="success">{t('book.created')}</Alert></div>}
      {bookings.loading ? <Spinner /> : bookings.error ? <Alert>{bookings.error}</Alert> : list.length === 0 ? (
        <EmptyState icon={Wallet} title={t('book.emptyTitle')} action={<div className="flex gap-3"><ButtonLink to="/explorar">{t('book.searchStays')}</ButtonLink><ButtonLink to="/experiencias" variant="secondary">{t('book.seeExperiences')}</ButtonLink></div>}>
          {t('book.emptyText')}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {section(t('book.section.upcoming'), upcoming)}
          {section(t('book.section.past'), past)}
          {section(t('book.section.cancelled'), cancelled)}
        </div>
      )}
    </Container>
  )
}
