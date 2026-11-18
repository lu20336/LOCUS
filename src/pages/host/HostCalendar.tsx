/** Calendario de un alojamiento: ver noches reservadas y bloquear/liberar noches propias. */
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { MonthCalendar } from '../../components/MonthCalendar'
import { Alert, Badge, Container, PageHeader, Spinner } from '../../components/ui'
import { BookingError, setHostBlockedDates } from '../../lib/booking/bookingService'
import { fetchBookings, fetchCalendar, fetchItem } from '../../lib/catalog/repo'
import type { Listing } from '../../lib/domain/types'
import { db } from '../../lib/firebase/client'
import { todayISO } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useAuth } from '../../lib/auth/authContext'
import { useAsync } from '../../lib/useAsync'

export default function HostCalendar() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const { user } = useAuth()
  const today = todayISO()
  const listing = useAsync(() => fetchItem<Listing>(db, 'listings', id), [id])
  const calendar = useAsync(() => fetchCalendar(db, id), [id])
  const bookings = useAsync(() => fetchBookings(db, 'host', user!.uid), [user?.uid])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (listing.loading || calendar.loading) return <Container><Spinner /></Container>
  if (!listing.data || listing.data.hostId !== user?.uid) return <Container className="py-10"><Alert>{t('hf.notFoundListing')}</Alert></Container>

  const booked = calendar.data?.booked ?? {}
  const blocked = calendar.data?.hostBlocked ?? {}
  const upcoming = (bookings.data ?? []).filter((b) => b.itemId === id && (b.status === 'confirmed' || b.status === 'pending') && (b.checkOut ?? '') > today)

  async function toggle(iso: string) {
    setBusy(true)
    setError(null)
    try {
      await setHostBlockedDates(db, id, [iso], !(iso in blocked))
      calendar.reload()
    } catch (e) {
      setError(e instanceof BookingError ? e.message : t('hf.calendarError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow={t('hb.eyebrow')} title={`${t('hd.calendar')} · ${listing.data.title}`}>
        {t('hf.calendarHelp')}
      </PageHeader>
      <p className="mb-4"><Link to="/anfitrion" className="text-sm font-semibold underline">{t('hf.backPanel')}</Link></p>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <div aria-busy={busy} className={busy ? 'opacity-70' : ''}>
        <MonthCalendar
          today={today}
          ariaLabel={t('hf.calendarLabel')}
          onSelect={toggle}
          cellState={(iso) =>
            iso in booked ? { tone: 'booked', disabled: true, hint: 'reservado por un huésped' } : iso in blocked ? { tone: 'blocked', hint: 'bloqueado por ti' } : { tone: 'free', hint: 'libre' }
          }
        />
      </div>
      <p className="mt-3 flex flex-wrap gap-3 text-sm text-muted"><Badge tone="danger">{t('hf.booked')}</Badge><Badge>{t('hf.blocked')}</Badge><Badge tone="teal">{t('hf.free')}</Badge></p>

      <section aria-labelledby="up" className="mt-8">
        <h2 id="up" className="text-xl font-semibold text-navy">{t('hf.upcomingHere')}</h2>
        {upcoming.length === 0 ? <p className="mt-2 text-muted">{t('hf.noUpcoming')}</p> : (
          <ul className="mt-3 flex flex-col gap-2">{upcoming.map((b) => <li key={b.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">{b.guestName} · {b.checkIn} → {b.checkOut} · {b.status === 'pending' ? 'pendiente' : 'confirmada'}</li>)}</ul>
        )}
      </section>
    </Container>
  )
}
