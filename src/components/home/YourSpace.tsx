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
import { fetchBookings } from '../../lib/catalog/repo'
import { FEATURED_DESTINATIONS } from '../../lib/featuredDestinations'
import { db } from '../../lib/firebase/client'
import { formatDateRange, todayISO } from '../../lib/format'
import { listItineraries } from '../../lib/itinerary/itineraryStore'
import { useFavorites } from '../../lib/profile/favorites'
import { TRIP_STATUS_LABEL, daysUntil, groupTrips, tripDays, tripPlace, tripStatus } from '../../lib/trips/tripStatus'
import { useAsync } from '../../lib/useAsync'
import { tripImage } from '../trips/TripCard'
import { Skeleton } from '../ui'

const greeting = (hour: number) => (hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches')

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
    { to: '/mis-viajes', label: 'Mis viajes', icon: Luggage },
    { to: '/favoritos', label: 'Favoritos', icon: Heart },
    { to: '/reservas', label: 'Reservas', icon: Wallet },
    { to: '/comparar', label: 'Comparar precios', icon: Scale },
  ]

  return (
    <section aria-label="Tu espacio" className="mx-auto w-full max-w-6xl px-4 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-soft">Tu espacio</p>
          <h2 className="mt-1 text-3xl font-semibold text-navy sm:text-4xl">{greeting(new Date().getHours())}{name ? `, ${name}` : ''}</h2>
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
              Preguntar a LOCUS
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
                  {tripStatus(next, today) === 'upcoming' ? `Faltan ${daysUntil(next.startDate, today)} días` : TRIP_STATUS_LABEL[tripStatus(next, today)]}
                </span>
                <p className="font-serif text-2xl font-semibold sm:text-3xl">{next.title}</p>
                <p className="text-sm text-white/90">{tripPlace(next)} · {formatDateRange(next.startDate, next.endDate)} · {tripDays(next)} días</p>
              </div>
            </Link>
          ) : (
            <div className="anim-rise flex flex-col items-start gap-3 rounded-3xl border border-dashed border-line bg-surface p-6">
              <Luggage aria-hidden="true" className="size-8 text-teal-soft" />
              <p className="font-serif text-2xl font-semibold text-navy">Planea tu primer viaje</p>
              <p className="max-w-lg text-muted">Elige un destino, tus fechas y lo que te gusta hacer: armamos el itinerario día a día y lo guardamos en Mis viajes.</p>
              <button type="button" onClick={() => document.getElementById('step-title')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-coral px-5 py-2.5 font-bold text-on-coral transition hover:brightness-105">Empezar a planear</button>
            </div>
          )}

          {recent.length > 0 && (
            <Panel title="Últimos itinerarios" to="/mis-viajes" linkLabel="Ver todos">
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
          <Panel title="Reservas próximas" to="/reservas" linkLabel="Ver reservas">
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
              <p className="text-sm text-muted">Aún no tienes reservas. <Link to="/explorar" className="font-semibold text-teal-soft underline">Explora hospedajes</Link>.</p>
            )}
          </Panel>

          <Panel title="Favoritos recientes" to="/favoritos" linkLabel="Ver favoritos">
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
              <p className="text-sm text-muted">Toca el corazón en un hospedaje, experiencia o destino para guardarlo aquí.</p>
            )}
          </Panel>
        </div>
      </div>
    </section>
  )
}
