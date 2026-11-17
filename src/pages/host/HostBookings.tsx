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
import { useAsync } from '../../lib/useAsync'
import { STATUS_LABELS, bookingLink, bookingWhen } from '../TripsPage'

type Filter = 'pending' | 'upcoming' | 'history'

function Row({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
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
      setError(e instanceof BookingError ? e.message : 'No pudimos completar la acción.')
      setCancelling(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{booking.kind === 'listing' ? 'Alojamiento' : 'Experiencia'}</p>
          <h3 className="font-serif text-xl font-semibold text-navy"><Link to={bookingLink(booking)} className="hover:underline">{booking.itemTitle}</Link></h3>
          <p className="text-sm text-muted">{bookingWhen(booking)} · {booking.kind === 'listing' ? `${booking.guests} huéspedes` : `${booking.people} personas`}</p>
          <p className="mt-1 text-sm text-ink">Huésped: <strong>{booking.guestName || 'Sin nombre'}</strong></p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-2 text-ink">Total: <strong>{formatCOP((booking.pricing as { total: number }).total)}</strong> <span className="text-xs text-muted">(simulado)</span></p>
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status === 'pending' && (
          <>
            <Button disabled={busy} onClick={() => run(() => hostDecideBooking(db, booking, 'confirm', today))}>Aceptar solicitud</Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => hostDecideBooking(db, booking, 'reject', today))}>Rechazar</Button>
          </>
        )}
        {booking.status === 'confirmed' && !ended && <Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>Cancelar reserva</Button>}
        {booking.status === 'confirmed' && ended && <Button variant="secondary" disabled={busy} onClick={() => run(() => completeBooking(db, booking))}>Marcar como completada</Button>}
      </div>
      <ConfirmDialog open={cancelling} title="¿Cancelar esta reserva?" confirmLabel="Sí, cancelar" danger busy={busy} onConfirm={() => run(() => cancelBooking(db, booking, 'host', today))} onCancel={() => setCancelling(false)}>
        <p>Cancelarás la reserva de <strong>{booking.guestName}</strong> y se liberarán las fechas. Cancelar reservas confirmadas afecta tu reputación como anfitrión.</p>
      </ConfirmDialog>
    </Card>
  )
}

export default function HostBookings() {
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
  const labels: Record<Filter, string> = { pending: 'Solicitudes', upcoming: 'Próximas', history: 'Historial' }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Modo anfitrión" title="Reservas y solicitudes">Acepta o rechaza solicitudes, cancela reservas y marca las estadías terminadas.</PageHeader>
      <div role="tablist" aria-label="Filtrar reservas" className="mb-6 flex gap-2">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === f ? 'border-teal bg-teal/15' : 'border-line bg-surface'}`}>
            {labels[f]} ({groups[f].length})
          </button>
        ))}
      </div>
      {bookings.loading ? <Spinner /> : bookings.error ? <Alert>{bookings.error}</Alert> : groups[filter].length === 0 ? (
        <EmptyState title="Nada por aquí">No tienes reservas en esta sección.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">{groups[filter].map((b) => <Row key={b.id} booking={b} onChanged={bookings.reload} />)}</div>
      )}
    </Container>
  )
}
