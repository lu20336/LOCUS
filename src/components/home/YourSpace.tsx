/**
 * "Tu espacio" en la portada (solo con sesión): saludo, próximo viaje, últimos
 * itinerarios, reservas próximas y favoritos recientes, con atajos. Si todavía no
 * hay nada, invita a empezar con estados vacíos útiles. No agrega consultas
 * nuevas: usa las mismas funciones de Mis viajes, Reservas y Favoritos.
 */
import { Compass, Heart, Luggage, Scale, Sparkles, Wallet } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { bookingLink, bookingWhen } from '../../pages/TripsPage'
import { openAgent } from '../../lib/agent/openAgent'
import { useAuth } from '../../lib/auth/authContext'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { fetchBookings } from '../../lib/catalog/repo'
import { FEATURED_DESTINATIONS } from '../../lib/featuredDestinations'
import { db } from '../../lib/firebase/client'
import { formatDateRange, todayISO } from '../../lib/format'
import { listItineraries } from '../../lib/itinerary/itineraryStore'
import { useFavorites } from '../../lib/profile/favorites'
import { daysUntil, groupTrips, tripDays, tripPlace, tripStatus } from '../../lib/trips/tripStatus'
import { useAsync } from '../../lib/useAsync'
import { tripImage } from '../trips/TripCard'
import { Skeleton } from '../ui'

const greetingKey = (hour: number) => (hour < 12 ? 'space.greeting.morning' : hour < 19 ? 'space.greeting.afternoon' : 'space.greeting.evening')

function Panel({ title, to, linkLabel, children }: { title: string; to: string; linkLabel: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-sans text-base font-semibold text-ink">{title}</h2>
        <Link to={to} className="text-sm font-semibold text-teal-soft underline-offset-2 hover:underline">{linkLabel}</Link>
      </div>
      {children}
    </section>
  )
}

export function YourSpace() {
  const { t } = useI18n()
  const { user, profile } = useAuth()
  const { favorites } = useFavorites()
  const today = todayISO()
  const trips = useAsync(() => listItineraries(db, user!.uid), [user?.uid])
  const bookings = useAsync(() => fetchBookings(db, 'guest', user!.uid), [user?.uid])

  const name = (profile?.displayName || user?.displayName || '').split(' ')[0]
  const grouped = groupTrips(trips.data ?? [], today)
  const next = grouped.upcoming[0]
  const recent = [...(trips.data ?? [])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).filter((t) => t.id !== next?.id).slice(0, 3)
  const upcomingBookings = (bookings.data ?? [])
    .filter((b) => (b.status === 'confirmed' || b.status === 'pending') && (b.kind === 'listing' ? b.checkOut! : b.date!) >= today)
    .slice(0, 3)
  const favs = favorites.slice(-4).reverse()
  const loading = trips.loading

  const quick = [
    { to: '/mis-viajes', label: t('nav.myTrips'), icon: Luggage },
    { to: '/favoritos', label: t('nav.favorites'), icon: Heart },
    { to: '/reservas', label: t('nav.myBookings'), icon: Wallet },
    { to: '/comparar', label: t('nav.comparePrices'), icon: Scale },
  ]

  return (
    <section aria-label={t('nav.yourSpace')} className="mx-auto w-full max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-soft">{t('nav.yourSpace')}</p>
          <h2 className="mt-1 text-3xl font-semibold text-navy sm:text-4xl">{t(greetingKey(new Date().getHours()))}{name ? `, ${name}` : ''}</h2>
        </div>
        <ul className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <li key={q.to}>
              <Link to={q.to} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-teal hover:shadow-sm">
                <q.icon aria-hidden="true" className="size-4 text-teal-soft" />
                {q.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => openAgent()} className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold text-on-coral shadow-sm transition hover:brightness-105">
              <Sparkles aria-hidden="true" className="size-4" />
              {t('space.askLocus')}
            </button>
          </li>
        </ul>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          {loading ? (
            <Skeleton className="h-52 w-full rounded-3xl" />
          ) : next ? (
            <Link to={`/mis-viajes/${next.id}`} className="card-photo group relative isolate flex min-h-52 overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-teal-soft shadow-sm transition hover:shadow-lg">
              {tripImage(next) && <img src={tripImage(next)!} alt="" className="absolute inset-0 -z-10 size-full object-cover" />}
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
              <div className="mt-auto flex w-full flex-col gap-1 p-5 text-white">
                <span className="w-fit rounded-full bg-teal px-3 py-1 text-xs font-bold text-on-coral">
                  {tripStatus(next, today) === 'upcoming' ? t('space.nextIn', { count: daysUntil(next.startDate, today) }) : t(`trips.status.${tripStatus(next, today)}`)}
                </span>
                <p className="font-serif text-2xl font-semibold sm:text-3xl">{next.title}</p>
                <p className="text-sm text-white/90">{tripPlace(next)} · {formatDateRange(next.startDate, next.endDate)} · {t('common.days', { count: tripDays(next) })}</p>
              </div>
            </Link>
          ) : (
            <div className="anim-rise flex flex-col items-start gap-3 rounded-3xl border border-dashed border-line bg-surface p-6">
              <Luggage aria-hidden="true" className="size-8 text-teal-soft" />
              <p className="font-serif text-2xl font-semibold text-navy">{t('space.firstTripTitle')}</p>
              <p className="max-w-lg text-muted">{t('space.firstTripText')}</p>
              <button type="button" onClick={() => document.getElementById('step-title')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-coral px-5 py-2.5 font-bold text-on-coral transition hover:brightness-105">{t('space.startPlanning')}</button>
            </div>
          )}

          {recent.length > 0 && (
            <Panel title={t('space.latestTrips')} to="/mis-viajes" linkLabel={t('home.seeAll')}>
              <ul className="anim-stagger grid gap-3 sm:grid-cols-3">
                {recent.map((t, i) => (
                  <li key={t.id} style={{ '--i': i } as CSSProperties}>
                    <Link to={`/mis-viajes/${t.id}`} className="block rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-teal/10">
                      <span className="block truncate text-sm font-semibold text-ink">{t.title}</span>
                      <span className="block truncate text-xs text-muted">{tripPlace(t)} · {formatDateRange(t.startDate, t.endDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={t('space.upcomingBookings')} to="/reservas" linkLabel={t('space.seeBookings')}>
            {upcomingBookings.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {upcomingBookings.map((b) => (
                  <li key={b.id}>
                    <Link to={bookingLink(b)} className="block rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-teal/10">
                      <span className="block truncate text-sm font-semibold text-ink">{b.itemTitle}</span>
                      <span className="block text-xs text-muted">{bookingWhen(b)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('space.noBookings')} <Link to="/explorar" className="font-semibold text-teal-soft underline">{t('space.exploreStays')}</Link>.</p>
            )}
          </Panel>

          <Panel title={t('space.recentFavorites')} to="/favoritos" linkLabel={t('space.seeFavorites')}>
            {favs.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {favs.map((f) => {
                  const dest = f.kind === 'destination' ? FEATURED_DESTINATIONS.find((d) => d.id === f.refId) : undefined
                  return (
                    <li key={f.key}>
                      <Link
                        to={f.kind === 'listing' ? `/hospedajes/${f.refId}` : f.kind === 'experience' ? `/experiencias/${f.refId}` : f.kind === 'destination' ? `/destinos/${f.refId}` : '/favoritos'}
                        className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2 transition-colors hover:bg-teal/10"
                      >
                        {dest ? <img src={dest.image} alt="" loading="lazy" className="size-10 rounded-xl object-cover" /> : <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-teal/15 text-teal-soft"><Compass className="size-5" /></span>}
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">{f.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('space.favoritesHint')}</p>
            )}
          </Panel>
        </div>
      </div>
    </section>
  )
}
