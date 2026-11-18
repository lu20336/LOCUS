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
import { useI18n } from '../lib/i18n/I18nProvider'
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
  const { t: tr } = useI18n()
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
        toast(tr('trips.toast.duplicated'), { action: { label: tr('trips.toast.openCopy'), to: `/mis-viajes/${id}` } })
        trips.reload()
      } catch {
        toast(tr('trips.toast.duplicateError'), { tone: 'error' })
      }
    },
    onShare: async (t) => {
      const text = shareSummary(t, formatDateRange, tr)
      try {
        if (navigator.share) await navigator.share({ title: t.title, text })
        else {
          await navigator.clipboard.writeText(text)
          toast(tr('trips.toast.copiedSummary'), { tone: 'info' })
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
      toast(tr('trips.toast.renamed'))
      trips.reload()
    } catch {
      toast(tr('trips.toast.renameError'), { tone: 'error' })
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
      toast(tr('trips.toast.deleted'), { tone: 'info' })
      trips.reload()
    } catch {
      toast(tr('trips.toast.deleteError'), { tone: 'error' })
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
        <PageHeader eyebrow={tr('nav.yourSpace')} title={tr('nav.myTrips')}>
          {tr('trips.intro')}
        </PageHeader>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/" className="!py-2.5"><Plus aria-hidden="true" className="size-4" />{tr('trips.planTrip')}</ButtonLink>
          <Button variant="secondary" className="!py-2.5" onClick={() => openAgent(tr('trips.askPrompt'))}><Sparkles aria-hidden="true" className="size-4" />{tr('trips.askLocus')}</Button>
        </div>
      </div>

      {draft && (
        <div className="anim-rise mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4">
          <div>
            <p className="font-semibold text-ink">{tr('trips.draftTitle', { place: draft.destination.displayName.split(',')[0] })}</p>
            <p className="text-sm text-muted">{tr('trips.draftText', { dates: formatDateRange(draft.startDate, draft.endDate) })}</p>
          </div>
          <ButtonLink to="/planear" className="!py-2">{tr('trips.draftCta')}</ButtonLink>
        </div>
      )}

      {upcomingBookings.length > 0 && (
        <section aria-label={tr('trips.upcomingBookings')} className="mb-6 rounded-3xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-sans text-base font-semibold text-ink">{tr('trips.upcomingBookings')}</h2>
            <Link to="/reservas" className="text-sm font-semibold text-teal-soft underline-offset-2 hover:underline">{tr('trips.seeAll')}</Link>
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
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr('trips.tabsLabel')}>
          {tabButton('upcoming', tr('trips.tab.upcoming'), grouped.upcoming.length)}
          {tabButton('past', tr('trips.tab.past'), grouped.past.length)}
          {tabButton('ideas', tr('trips.tab.ideas'), ideas.length)}
        </div>
        {tab !== 'ideas' && all.length > 0 && (
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">{tr('trips.searchLabel')}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('trips.searchPlaceholder')}
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
        )}
      </div>

      {trips.loading ? (
        <CardGridSkeleton count={3} label={tr('trips.loading')} />
      ) : trips.error ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{tr('trips.loadError')}</Alert>
          <Button variant="secondary" onClick={trips.reload}>{tr('common.retry')}</Button>
        </div>
      ) : tab === 'ideas' ? (
        <Ideas ideas={ideas} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title={tr('trips.emptyTitle')}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/">{tr('trips.planFirst')}</ButtonLink>
              <Button variant="secondary" onClick={() => openAgent(tr('trips.askPrompt'))}>{tr('trips.askIdeas')}</Button>
            </div>
          }
        >
          {tr('trips.emptyText')}
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={tab === 'past' ? History : Search} title={query ? tr('trips.noMatch') : tab === 'past' ? tr('trips.noPast') : tr('trips.noUpcoming')}>
          {query ? tr('trips.noMatchHint') : tab === 'past' ? tr('trips.noPastHint') : tr('trips.noUpcomingHint')}
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
        title={tr('trips.renameTitle')}
        confirmLabel={tr('trips.renameConfirm')}
        busy={busy}
        onConfirm={() => void confirmRename()}
        onCancel={() => setRenaming(null)}
      >
        <label htmlFor="trip-new-name" className="font-semibold text-ink">{tr('trips.newName')}</label>
        <input
          id="trip-new-name"
          value={newName}
          maxLength={120}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void confirmRename()}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </ConfirmDialog>

      <ConfirmDialog open={Boolean(deleting)} title={tr('trips.deleteTitle')} confirmLabel={tr('common.delete')} danger busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)}>
        <p>{tr('trips.deleteBody', { title: deleting?.title ?? '' })}</p>
      </ConfirmDialog>
    </Container>
  )
}

/** Ideas guardadas: destinos que el usuario marcó con el corazón; se convierten en viaje con un clic. */
function Ideas({ ideas }: { ideas: { refId: string; title: string; subtitle?: string }[] }) {
  const { t: tr } = useI18n()
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
            <Link to={`/?destino=${id}`} className="rounded-xl bg-coral px-3.5 py-2 text-sm font-bold text-on-coral transition hover:brightness-105">{tr('trips.ideas.planThis')}</Link>
            <Link to={`/destinos/${id}`} className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2">{tr('trips.ideas.seeDestination')}</Link>
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
        <EmptyState icon={Heart} title={tr('trips.ideas.emptyTitle')}>
          {tr('trips.ideas.emptyText')}
        </EmptyState>
      )}
      {suggestions.length > 0 && (
        <section aria-label={tr('trips.ideas.label')}>
          <h2 className="mb-3 text-xl font-semibold text-navy">{tr('trips.ideas.suggestions')}</h2>
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
