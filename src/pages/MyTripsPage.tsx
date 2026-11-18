/**
 * MIS VIAJES: el centro de lo que el usuario planea.
 *  - Próximo viaje destacado, próximos, realizados e ideas guardadas.
 *  - Borrador: el plan del planificador que todavía no se guardó.
 *  - Reservas próximas (enlazan a Mis reservas).
 *  - Acciones reales: abrir, renombrar, duplicar, compartir y eliminar (con confirmación).
 * El estado de cada viaje se DERIVA de sus fechas (no se guarda): ver lib/trips/tripStatus.ts.
 */
import { Heart, History, Luggage, Plus, Search, Sparkles } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FavoriteButton } from '../components/FavoriteButton'
import { useToast } from '../components/Toast'
import { NextTripCard, TripCard, type TripActions } from '../components/trips/TripCard'
import { Alert, Button, ButtonLink, CardGridSkeleton, Container, EmptyState, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { openAgent } from '../lib/agent/openAgent'
import { fetchBookings } from '../lib/catalog/repo'
import { FEATURED_DESTINATIONS } from '../lib/featuredDestinations'
import { db } from '../lib/firebase/client'
import { useTripFlow } from '../lib/flow/tripFlowContext'
import { formatDateRange, todayISO } from '../lib/format'
import { duplicateItinerary, listItineraries, removeItinerary, renameItinerary, type SavedItinerary } from '../lib/itinerary/itineraryStore'
import { useFavorites } from '../lib/profile/favorites'
import { filterTrips, groupTrips, nextTrip, shareSummary, tripPlace } from '../lib/trips/tripStatus'
import { useAsync } from '../lib/useAsync'
import { bookingLink, bookingWhen } from './TripsPage'

type Tab = 'upcoming' | 'past' | 'ideas'

export default function MyTripsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { trip: flowTrip, itinerary: flowItinerary } = useTripFlow()
  const { favorites } = useFavorites()
  const today = todayISO()

  const trips = useAsync(() => listItineraries(db, user!.uid), [user?.uid])
  const bookings = useAsync(() => fetchBookings(db, 'guest', user!.uid), [user?.uid])

  const tab: Tab = params.get('tab') === 'past' ? 'past' : params.get('tab') === 'ideas' ? 'ideas' : 'upcoming'
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<SavedItinerary | null>(null)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<SavedItinerary | null>(null)
  const [busy, setBusy] = useState(false)

  const all = trips.data ?? []
  const grouped = useMemo(() => groupTrips(all, today), [all, today])
  const featured = useMemo(() => nextTrip(all, today), [all, today])
  const ideas = favorites.filter((f) => f.kind === 'destination')
  const upcomingBookings = (bookings.data ?? [])
    .filter((b) => (b.status === 'confirmed' || b.status === 'pending') && (b.kind === 'listing' ? b.checkOut! : b.date!) >= today)
    .slice(0, 3)

  // El borrador (plan sin guardar) solo se ofrece si no hay ya un viaje guardado igual.
  const draft =
    flowTrip && flowItinerary && !all.some((t) => t.startDate === flowTrip.startDate && t.endDate === flowTrip.endDate && tripPlace(t) === flowTrip.destination.displayName.split(',')[0].trim())
      ? flowTrip
      : null

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params)
    if (next === 'upcoming') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
    setQuery('')
  }

  const actions: TripActions = {
    onRename: (t) => {
      setRenaming(t)
      setNewName(t.title)
    },
    onDuplicate: async (t) => {
      try {
        const id = await duplicateItinerary(db, user!.uid, t)
        toast('Viaje duplicado', { action: { label: 'Abrir copia', to: `/mis-viajes/${id}` } })
        trips.reload()
      } catch {
        toast('No pudimos duplicar el viaje. Inténtalo de nuevo.', { tone: 'error' })
      }
    },
    onShare: async (t) => {
      const text = shareSummary(t, formatDateRange)
      try {
        if (navigator.share) await navigator.share({ title: t.title, text })
        else {
          await navigator.clipboard.writeText(text)
          toast('Copiamos el resumen del viaje para que lo pegues donde quieras', { tone: 'info' })
        }
      } catch {
        // El usuario canceló el menú de compartir: no es un error.
      }
    },
    onDelete: (t) => setDeleting(t),
  }

  async function confirmRename() {
    if (!renaming || !user || !newName.trim()) return
    setBusy(true)
    try {
      await renameItinerary(db, user.uid, renaming.id, newName)
      setRenaming(null)
      toast('Nombre actualizado')
      trips.reload()
    } catch {
      toast('No pudimos cambiar el nombre.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting || !user) return
    setBusy(true)
    try {
      await removeItinerary(db, user.uid, deleting.id)
      setDeleting(null)
      toast('Viaje eliminado', { tone: 'info' })
      trips.reload()
    } catch {
      toast('No pudimos eliminar el viaje.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const list = tab === 'upcoming' ? grouped.upcoming : grouped.past
  const visible = filterTrips(list, query)
  const rest = tab === 'upcoming' && !query && featured ? visible.filter((t) => t.id !== featured.id) : visible

  const tabButton = (id: Tab, label: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={tab === id}
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${tab === id ? 'border-navy bg-navy text-surface' : 'border-line bg-surface text-ink hover:bg-surface-2'}`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-xs ${tab === id ? 'bg-surface/25' : 'bg-surface-2 text-muted'}`}>{count}</span>
    </button>
  )

  return (
    <Container className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader eyebrow="Tu espacio" title="Mis viajes">
          Itinerarios, viajes próximos y por hacer, todo en un solo lugar.
        </PageHeader>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/" className="!py-2.5"><Plus aria-hidden="true" className="size-4" />Planear un viaje</ButtonLink>
          <Button variant="secondary" className="!py-2.5" onClick={() => openAgent('Organízame un viaje por Colombia')}><Sparkles aria-hidden="true" className="size-4" />Pedirle a LOCUS</Button>
        </div>
      </div>

      {draft && (
        <div className="anim-rise mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4">
          <div>
            <p className="font-semibold text-ink">Tienes un plan sin guardar: {draft.destination.displayName.split(',')[0]}</p>
            <p className="text-sm text-muted">{formatDateRange(draft.startDate, draft.endDate)} · termínalo y guárdalo en tu cuenta para encontrarlo aquí.</p>
          </div>
          <ButtonLink to="/planear" className="!py-2">Continuar plan</ButtonLink>
        </div>
      )}

      {upcomingBookings.length > 0 && (
        <section aria-label="Reservas próximas" className="mb-6 rounded-3xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-sans text-base font-semibold text-ink">Reservas próximas</h2>
            <Link to="/reservas" className="text-sm font-semibold text-teal-soft underline-offset-2 hover:underline">Ver todas</Link>
          </div>
          <ul className="anim-stagger mt-3 grid gap-2 sm:grid-cols-3">
            {upcomingBookings.map((b, i) => (
              <li key={b.id} style={{ '--i': i } as CSSProperties}>
                <Link to={bookingLink(b)} className="block rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-teal/10">
                  <span className="block truncate text-sm font-semibold text-ink">{b.itemTitle}</span>
                  <span className="block text-xs text-muted">{bookingWhen(b)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de viajes">
          {tabButton('upcoming', 'Próximos', grouped.upcoming.length)}
          {tabButton('past', 'Realizados', grouped.past.length)}
          {tabButton('ideas', 'Ideas guardadas', ideas.length)}
        </div>
        {tab !== 'ideas' && all.length > 0 && (
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Buscar en mis viajes</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o destino"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
        )}
      </div>

      {trips.loading ? (
        <CardGridSkeleton count={3} label="Cargando tus viajes" />
      ) : trips.error ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>No pudimos cargar tus viajes.</Alert>
          <Button variant="secondary" onClick={trips.reload}>Reintentar</Button>
        </div>
      ) : tab === 'ideas' ? (
        <Ideas ideas={ideas} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title="Aquí vivirán tus viajes"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/">Planear mi primer viaje</ButtonLink>
              <Button variant="secondary" onClick={() => openAgent('Organízame un viaje por Colombia')}>Pedirle ideas a LOCUS</Button>
            </div>
          }
        >
          Arma un itinerario día a día con lugares reales y se guardará aquí. También puedes pedirle a tu compañero LOCUS que lo organice por ti.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={tab === 'past' ? History : Search} title={query ? 'No encontramos viajes con ese nombre' : tab === 'past' ? 'Todavía no tienes viajes realizados' : 'No tienes viajes próximos'}>
          {query ? 'Prueba con otro nombre o destino.' : tab === 'past' ? 'Cuando termine uno de tus viajes, quedará aquí como recuerdo.' : 'Planea tu próxima escapada y aparecerá aquí.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {tab === 'upcoming' && !query && featured && <NextTripCard trip={featured} today={today} actions={actions} />}
          {rest.length > 0 && (
            <ul className="anim-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((t, i) => (
                <li key={t.id} style={{ '--i': i } as CSSProperties}>
                  <TripCard trip={t} today={today} actions={actions} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(renaming)}
        title="Renombrar viaje"
        confirmLabel="Guardar nombre"
        busy={busy}
        onConfirm={() => void confirmRename()}
        onCancel={() => setRenaming(null)}
      >
        <label htmlFor="trip-new-name" className="font-semibold text-ink">Nuevo nombre</label>
        <input
          id="trip-new-name"
          value={newName}
          maxLength={120}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void confirmRename()}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </ConfirmDialog>

      <ConfirmDialog open={Boolean(deleting)} title="¿Eliminar este viaje?" confirmLabel="Eliminar" danger busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)}>
        <p>
          Se eliminará <strong>{deleting?.title}</strong> de tu cuenta. Esta acción no se puede deshacer.
        </p>
      </ConfirmDialog>
    </Container>
  )
}

/** Ideas guardadas: destinos que el usuario marcó con el corazón; se convierten en viaje con un clic. */
function Ideas({ ideas }: { ideas: { refId: string; title: string; subtitle?: string }[] }) {
  const saved = new Set(ideas.map((i) => i.refId))
  const suggestions = FEATURED_DESTINATIONS.filter((d) => !saved.has(d.id)).slice(0, 3)
  const Card = ({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) => {
    const dest = FEATURED_DESTINATIONS.find((d) => d.id === id)
    return (
      <article className="card-photo group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-navy to-teal-soft">
          {dest && <img src={dest.image} alt="" loading="lazy" style={{ objectPosition: dest.imagePosition }} className="size-full object-cover" />}
          <FavoriteButton className="absolute right-3 top-3" item={{ kind: 'destination', refId: id, title, subtitle }} />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div>
            <h3 className="font-serif text-xl font-semibold text-navy">{title}</h3>
            {(dest?.tagline || subtitle) && <p className="text-sm text-muted">{dest?.tagline ?? subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/?destino=${id}`} className="rounded-xl bg-coral px-3.5 py-2 text-sm font-bold text-on-coral transition hover:brightness-105">Planear este viaje</Link>
            <Link to={`/destinos/${id}`} className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2">Ver destino</Link>
          </div>
        </div>
      </article>
    )
  }
  return (
    <div className="flex flex-col gap-8">
      {ideas.length > 0 ? (
        <ul className="anim-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((i, n) => (
            <li key={i.refId} style={{ '--i': n } as CSSProperties}><Card id={i.refId} title={i.title} subtitle={i.subtitle} /></li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Heart} title="Guarda destinos para decidir después">
          Toca el corazón en cualquier destino y lo verás aquí, listo para convertirlo en un viaje con un clic.
        </EmptyState>
      )}
      {suggestions.length > 0 && (
        <section aria-label="Ideas de LOCUS">
          <h2 className="mb-3 text-xl font-semibold text-navy">Ideas para tu próxima escapada</h2>
          <ul className="anim-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((d, n) => (
              <li key={d.id} style={{ '--i': n } as CSSProperties}><Card id={d.id} title={d.name} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
