/** Reservas y solicitudes recibidas por el anfitrión. */
import { useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Alert, Badge, Button, Card, Container, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../lib/auth/authContext'
import { BookingError, cancelBooking, completeBooking, hostDecideBooking } from '../../lib/booking/bookingService'
import { fetchBookings } from '../../lib/catalog/repo'
import type { Booking } from '../../lib/domain/types'
import { db } from '../../lib/firebase/client'
import { formatCOP, todayISO } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useAsync } from '../../lib/useAsync'
import { STATUS_LABELS, bookingLink, bookingWhen } from '../TripsPage'

type Filter = 'pending' | 'upcoming' | 'history'

function Row({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const { t } = useI18n()
  const today = todayISO()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const status = STATUS_LABELS[booking.status]
  const ended = (booking.kind === 'listing' ? booking.checkOut! : booking.date!) <= today

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setCancelling(false)
      onChanged()
    } catch (e) {
      setError(e instanceof BookingError ? e.message : t('hb.actionError'))
      setCancelling(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{booking.kind === 'listing' ? t('book.kind.listing') : t('book.kind.experience')}</p>
          <h3 className="font-serif text-xl font-semibold text-navy"><Link to={bookingLink(booking)} className="hover:underline">{booking.itemTitle}</Link></h3>
          <p className="text-sm text-muted">{bookingWhen(booking)} · {booking.kind === 'listing' ? t('book.guests', { count: booking.guests ?? 1 }) : t('book.people', { count: booking.people ?? 1 })}</p>
          <p className="mt-1 text-sm text-ink">{t('hb.guest')} <strong>{booking.guestName || t('hb.noName')}</strong></p>
        </div>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
      </div>
      <p className="mt-2 text-ink">{t('book.total')} <strong>{formatCOP((booking.pricing as { total: number }).total)}</strong> <span className="text-xs text-muted">{t('hb.simulated')}</span></p>
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status === 'pending' && (
          <>
            <Button disabled={busy} onClick={() => run(() => hostDecideBooking(db, booking, 'confirm', today))}>{t('hb.accept')}</Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => hostDecideBooking(db, booking, 'reject', today))}>{t('hb.reject')}</Button>
          </>
        )}
        {booking.status === 'confirmed' && !ended && <Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>{t('book.cancel')}</Button>}
        {booking.status === 'confirmed' && ended && <Button variant="secondary" disabled={busy} onClick={() => run(() => completeBooking(db, booking))}>{t('hb.complete')}</Button>}
      </div>
      <ConfirmDialog open={cancelling} title={t('book.cancelTitle')} confirmLabel={t('book.cancelConfirm')} danger busy={busy} onConfirm={() => run(() => cancelBooking(db, booking, 'host', today))} onCancel={() => setCancelling(false)}>
        <p>{t('hb.cancelBody', { name: booking.guestName })}</p>
      </ConfirmDialog>
    </Card>
  )
}

export default function HostBookings() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('pending')
  const bookings = useAsync(() => fetchBookings(db, 'host', user!.uid), [user?.uid])
  const today = todayISO()
  const all = bookings.data ?? []
  const last = (b: Booking) => (b.kind === 'listing' ? b.checkOut! : b.date!)
  const groups: Record<Filter, Booking[]> = {
    pending: all.filter((b) => b.status === 'pending'),
    upcoming: all.filter((b) => b.status === 'confirmed' && last(b) > today),
    history: all.filter((b) => !(b.status === 'pending' || (b.status === 'confirmed' && last(b) > today))),
  }
  const labels: Record<Filter, string> = { pending: t('hb.filter.pending'), upcoming: t('hb.filter.upcoming'), history: t('hb.filter.history') }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow={t('hb.eyebrow')} title={t('hb.title')}>{t('hb.intro')}</PageHeader>
      <div role="tablist" aria-label={t('hb.filtersLabel')} className="mb-6 flex gap-2">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === f ? 'border-teal bg-teal/15' : 'border-line bg-surface'}`}>
            {labels[f]} ({groups[f].length})
          </button>
        ))}
      </div>
      {bookings.loading ? <Spinner /> : bookings.error ? <Alert>{bookings.error}</Alert> : groups[filter].length === 0 ? (
        <EmptyState title={t('hb.emptyTitle')}>{t('hb.emptyText')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">{groups[filter].map((b) => <Row key={b.id} booking={b} onChanged={bookings.reload} />)}</div>
      )}
    </Container>
  )
}
