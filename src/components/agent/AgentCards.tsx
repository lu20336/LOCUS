import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../lib/auth/authContext'
import { db } from '../../lib/firebase/client'
import { saveNewItinerary, toPayload } from '../../lib/itinerary/itineraryStore'
import { FavoriteButton } from '../FavoriteButton'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useToast } from '../Toast'
import type { AgentCard } from '../../lib/agent/types'

const cardBox = 'rounded-2xl border border-line bg-surface p-3 text-sm text-ink shadow-sm'

function ItineraryCardView({ card }: { card: Extract<AgentCard, { kind: 'itinerary' }> }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedId, setSavedId] = useState<string | null>(null)

  async function save() {
    if (!user) return
    setState('saving')
    try {
      const id = await saveNewItinerary(db, user.uid, toPayload(card.itinerary, 1, 'agent'))
      setSavedId(id)
      setState('saved')
      toast(t('trips.toast.savedInTrips'), { action: { label: t('trips.toast.viewTrip'), to: `/mis-viajes/${id}` } })
    } catch {
      setState('error')
    }
  }

  return (
    <div className={cardBox}>
      <p className="font-semibold text-navy">{card.title}</p>
      <p className="text-muted">{t('agent.card.itinerarySummary', { days: t('common.days', { count: card.days }), places: card.places })}</p>
      <ol className="mt-2 flex flex-col gap-1">
        {card.itinerary.days.slice(0, 5).map((d) => (
          <li key={d.date}>{t('agent.card.itineraryLine', { day: d.day, places: d.places.map((p) => p.name).slice(0, 4).join(' → ') || t('agent.card.free') })}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === 'saved' ? (
          <>
            <Link to={`/mis-viajes/${savedId}`} className="font-semibold text-teal-soft underline">{t('agent.card.saved')}</Link>
            <Link to="/mis-viajes" className="text-muted underline">{t('agent.card.allTrips')}</Link>
          </>
        ) : user ? (
          <button type="button" onClick={save} disabled={state === 'saving'} className="rounded-xl bg-coral px-3 py-1.5 font-bold text-on-coral disabled:opacity-60">{state === 'saving' ? t('agent.card.saving') : t('agent.card.save')}</button>
        ) : (
          <Link to="/ingresar" className="font-semibold underline">{t('agent.card.signInToSave')}</Link>
        )}
        {state === 'error' && <span className="text-danger">{t('agent.card.saveError')}</span>}
      </div>
    </div>
  )
}

export function AgentCardView({ card }: { card: AgentCard }) {
  const { t } = useI18n()
  switch (card.kind) {
    case 'listing':
    case 'experience':
      return (
        <Link to={card.href} className={`${cardBox} relative flex gap-3 pr-12 transition-colors hover:bg-surface-2`}>
          <FavoriteButton className="absolute right-2 top-2 border border-line" item={{ kind: card.kind, refId: card.id, title: card.title, subtitle: card.subtitle }} />
          {card.cover ? <img src={card.cover} alt="" className="size-16 shrink-0 rounded-xl object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs text-muted">Sin foto</div>}
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-teal-soft">{card.kind === 'listing' ? t('agent.card.listing') : t('agent.card.experience')}</span>
            <span className="block truncate font-semibold text-navy">{card.title}</span>
            <span className="block truncate text-muted">{card.subtitle}</span>
            <span className="block font-semibold">{card.price}</span>
          </span>
        </Link>
      )
    case 'destination':
      return (
        <Link to={card.href} className={`${cardBox} relative flex gap-3 pr-12 transition-colors hover:bg-surface-2`}>
          <FavoriteButton className="absolute right-2 top-2 border border-line" item={{ kind: 'destination', refId: card.id, title: card.title, subtitle: card.subtitle }} />
          <img src={card.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          <span className="min-w-0"><span className="block font-serif text-lg font-semibold text-navy">{card.title}</span><span className="block text-muted">{card.subtitle}</span></span>
        </Link>
      )
    case 'itinerary':
      return <ItineraryCardView card={card} />
    case 'flights':
      return (
        <div className={cardBox}>
          <p className="font-semibold text-navy">{t('agent.card.flightsTitle', { origin: card.origin, destination: card.destination })}</p>
          <p className="text-xs text-muted">{t('agent.card.flightsNote')}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {card.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-block rounded-lg border border-line px-3 py-1.5 font-semibold text-teal-soft hover:bg-surface-2">{l.provider} ↗</a></li>)}
          </ul>
        </div>
      )
    case 'weather':
      return (
        <div className={cardBox}>
          <p className="font-semibold text-navy">{card.title}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted">{card.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="mt-1 text-xs text-muted">{t('agent.card.weatherNote')}</p>
        </div>
      )
    case 'places':
      return (
        <div className={cardBox}>
          <p className="font-semibold text-navy">{card.title}</p>
          <ul className="mt-1 flex flex-col gap-0.5">{card.items.map((p) => <li key={p.href}><a href={p.href} target="_blank" rel="noreferrer noopener" className="hover:underline">{p.name}</a> <span className="text-muted">· {p.kind}</span></li>)}</ul>
          <p className="mt-1 text-xs text-muted">{t('agent.card.placesNote')}</p>
        </div>
      )
    case 'note':
      return <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">📝 {card.text}</p>
  }
}
