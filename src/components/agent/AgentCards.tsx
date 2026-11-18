import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../lib/auth/authContext'
import { db } from '../../lib/firebase/client'
import { saveNewItinerary, toPayload } from '../../lib/itinerary/itineraryStore'
import { FavoriteButton } from '../FavoriteButton'
import { useToast } from '../Toast'
import type { AgentCard } from '../../lib/agent/types'

const cardBox = 'rounded-2xl border border-line bg-surface p-3 text-sm text-ink shadow-sm'

function ItineraryCardView({ card }: { card: Extract<AgentCard, { kind: 'itinerary' }> }) {
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
      toast('Guardado en Mis viajes', { action: { label: 'Ver viaje', to: `/mis-viajes/${id}` } })
    } catch {
      setState('error')
    }
  }

  return (
    <div className={cardBox}>
      <p className="font-semibold text-navy">{card.title}</p>
      <p className="text-muted">{card.days} {card.days === 1 ? 'día' : 'días'} · {card.places} lugares reales (OpenStreetMap)</p>
      <ol className="mt-2 flex flex-col gap-1">
        {card.itinerary.days.slice(0, 5).map((d) => (
          <li key={d.date}><strong>Día {d.day}:</strong> {d.places.map((p) => p.name).slice(0, 4).join(' → ') || 'libre'}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === 'saved' ? (
          <>
            <Link to={`/mis-viajes/${savedId}`} className="font-semibold text-teal-soft underline">Guardado en Mis viajes: ver y editar</Link>
            <Link to="/mis-viajes" className="text-muted underline">Todos mis viajes</Link>
          </>
        ) : user ? (
          <button type="button" onClick={save} disabled={state === 'saving'} className="rounded-xl bg-coral px-3 py-1.5 font-bold text-on-coral disabled:opacity-60">{state === 'saving' ? 'Guardando…' : 'Guardar en Mis viajes'}</button>
        ) : (
          <Link to="/ingresar" className="font-semibold underline">Ingresa para guardarlo</Link>
        )}
        {state === 'error' && <span className="text-danger">No se pudo guardar.</span>}
      </div>
    </div>
  )
}

export function AgentCardView({ card }: { card: AgentCard }) {
  switch (card.kind) {
    case 'listing':
    case 'experience':
      return (
        <Link to={card.href} className={`${cardBox} relative flex gap-3 pr-12 transition-colors hover:bg-surface-2`}>
          <FavoriteButton className="absolute right-2 top-2 border border-line" item={{ kind: card.kind, refId: card.id, title: card.title, subtitle: card.subtitle }} />
          {card.cover ? <img src={card.cover} alt="" className="size-16 shrink-0 rounded-xl object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs text-muted">Sin foto</div>}
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-teal-soft">{card.kind === 'listing' ? 'Alojamiento LOCUS' : 'Experiencia LOCUS'}</span>
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
          <p className="font-semibold text-navy">Vuelos {card.origin} → {card.destination}</p>
          <p className="text-xs text-muted">LOCUS no vende tiquetes ni conoce tarifas: estos enlaces abren la búsqueda en el proveedor.</p>
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
          <p className="mt-1 text-xs text-muted">Pronóstico estimado: puede cambiar. Open-Meteo.</p>
        </div>
      )
    case 'places':
      return (
        <div className={cardBox}>
          <p className="font-semibold text-navy">{card.title}</p>
          <ul className="mt-1 flex flex-col gap-0.5">{card.items.map((p) => <li key={p.href}><a href={p.href} target="_blank" rel="noreferrer noopener" className="hover:underline">{p.name}</a> <span className="text-muted">· {p.kind}</span></li>)}</ul>
          <p className="mt-1 text-xs text-muted">Datos de OpenStreetMap contributors; sin horarios ni precios.</p>
        </div>
      )
    case 'note':
      return <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">📝 {card.text}</p>
  }
}
