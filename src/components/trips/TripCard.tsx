/**
 * Tarjeta de un viaje (itinerario guardado): foto del destino, estado derivado de
 * las fechas, datos clave y un menú de acciones que SÍ actúan sobre los datos
 * (abrir, renombrar, duplicar, compartir, eliminar).
 */
import { CalendarDays, Copy, EllipsisVertical, MapPin, Pencil, Share2, Trash2, Users, Wallet } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'
import { findFeaturedNear } from '../../lib/featuredDestinations'
import { formatCOP, formatDateRange } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import type { SavedItinerary } from '../../lib/itinerary/itineraryStore'
import { daysUntil, tripDays, tripPlace, tripPlaces, tripStatus } from '../../lib/trips/tripStatus'
import { useDismiss } from '../nav/useDismiss'

export interface TripActions {
  onRename: (trip: SavedItinerary) => void
  onDuplicate: (trip: SavedItinerary) => void
  onShare: (trip: SavedItinerary) => void
  onDelete: (trip: SavedItinerary) => void
}

const STATUS_STYLE = {
  upcoming: 'bg-teal text-on-coral',
  ongoing: 'bg-coral text-on-coral',
  past: 'bg-surface text-ink',
} as const

export function tripImage(trip: Pick<SavedItinerary, 'destination'>): string | null {
  return findFeaturedNear(trip.destination)?.image ?? null
}

function Cover({ trip, className = '' }: { trip: SavedItinerary; className?: string }) {
  const src = tripImage(trip)
  return (
    <div className={`card-photo relative overflow-hidden bg-gradient-to-br from-navy to-teal-soft ${className}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div aria-hidden="true" className="grid size-full place-items-center font-serif text-5xl font-semibold text-white/80">
          {tripPlace(trip).slice(0, 1)}
        </div>
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  )
}

function Menu({ trip, actions }: { trip: SavedItinerary; actions: TripActions }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2'
  const run = (fn: (t: SavedItinerary) => void) => () => {
    setOpen(false)
    fn(trip)
  }
  return (
    <div ref={ref} className="absolute right-3 top-3 z-10">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('trips.card.actions', { title: trip.title })}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition hover:scale-105"
      >
        <EllipsisVertical aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div role="menu" className="anim-menu absolute right-0 top-11 w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
          <button role="menuitem" type="button" className={item} onClick={run(actions.onRename)}><Pencil aria-hidden="true" className="size-4 text-teal-soft" />{t('trips.card.rename')}</button>
          <button role="menuitem" type="button" className={item} onClick={run(actions.onDuplicate)}><Copy aria-hidden="true" className="size-4 text-teal-soft" />{t('trips.card.duplicate')}</button>
          <button role="menuitem" type="button" className={item} onClick={run(actions.onShare)}><Share2 aria-hidden="true" className="size-4 text-teal-soft" />{t('trips.card.share')}</button>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" type="button" className={`${item} text-danger`} onClick={run(actions.onDelete)}><Trash2 aria-hidden="true" className="size-4" />{t('trips.card.delete')}</button>
        </div>
      )}
    </div>
  )
}

function Facts({ trip }: { trip: SavedItinerary }) {
  const { t } = useI18n()
  const days = tripDays(trip)
  const stops = tripPlaces(trip)
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink'
  return (
    <ul className="flex flex-wrap gap-1.5">
      <li className={chip}><CalendarDays aria-hidden="true" className="size-3.5 text-teal-soft" />{t('common.days', { count: days })}</li>
      <li className={chip}><Users aria-hidden="true" className="size-3.5 text-teal-soft" />{t('common.persons', { count: trip.travelers })}</li>
      <li className={chip}><MapPin aria-hidden="true" className="size-3.5 text-teal-soft" />{t('common.places', { count: stops })}</li>
      {trip.budgetCOP > 0 && <li className={chip}><Wallet aria-hidden="true" className="size-3.5 text-teal-soft" />{formatCOP(trip.budgetCOP)}</li>}
    </ul>
  )
}

function StatusBadge({ trip, today }: { trip: SavedItinerary; today: string }) {
  const { t } = useI18n()
  const status = tripStatus(trip, today)
  const left = daysUntil(trip.startDate, today)
  const label = status === 'upcoming' && left <= 30 ? (left === 0 ? t('trips.leavesToday') : t('trips.inDays', { count: left })) : t(`trips.status.${status}`)
  return <span className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${STATUS_STYLE[status]}`}>{label}</span>
}

/** Tarjeta normal de la rejilla. */
export function TripCard({ trip, today, actions }: { trip: SavedItinerary; today: string; actions: TripActions }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Cover trip={trip} className="aspect-[16/10]" />
      <StatusBadge trip={trip} today={today} />
      <Menu trip={trip} actions={actions} />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{tripPlace(trip)}</p>
        <h3 className="font-serif text-xl font-semibold leading-snug text-navy">
          <Link to={`/mis-viajes/${trip.id}`} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
            {trip.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate)}</p>
        <Facts trip={trip} />
      </div>
    </article>
  )
}

/** Tarjeta grande del próximo viaje (la que más importa). */
export function NextTripCard({ trip, today, actions }: { trip: SavedItinerary; today: string; actions: TripActions }) {
  const { t } = useI18n()
  const left = daysUntil(trip.startDate, today)
  const status = tripStatus(trip, today)
  return (
    <article className="group relative grid overflow-hidden rounded-3xl border border-line bg-surface shadow-sm sm:grid-cols-[1.1fr_1fr]">
      <Cover trip={trip} className="min-h-52 sm:min-h-72" />
      <StatusBadge trip={trip} today={today} />
      <Menu trip={trip} actions={actions} />
      <div className="flex flex-col justify-center gap-3 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{status === 'ongoing' ? t('trips.card.todaysTrip') : t('trips.card.nextTrip')}</p>
        <h3 className="font-serif text-2xl font-semibold leading-snug text-navy sm:text-3xl">{trip.title}</h3>
        <p className="text-muted">
          {tripPlace(trip)} · {formatDateRange(trip.startDate, trip.endDate)}
          {status === 'upcoming' && left > 0 && <> · {t('trips.card.inDaysShort', { count: left })}</>}
        </p>
        <Facts trip={trip} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to={`/mis-viajes/${trip.id}`} className="inline-flex items-center rounded-xl bg-coral px-5 py-2.5 font-bold text-on-coral shadow-sm transition hover:brightness-105">
            {t('trips.card.open')}
          </Link>
          <Link
            to={`/comparar?${new URLSearchParams({ destino: tripPlace(trip), llegada: trip.startDate, salida: trip.endDate, huespedes: String(trip.travelers) })}`}
            className="inline-flex items-center rounded-xl border-2 border-teal px-4 py-2.5 font-semibold text-ink transition hover:bg-teal/10"
          >
            {t('trips.card.compareStays')}
          </Link>
        </div>
      </div>
    </article>
  )
}
