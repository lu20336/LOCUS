/** Mis itinerarios (lista) y detalle editable (/itinerarios/:id). Sin sesión, invita a armar uno. */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ItineraryView } from '../components/ItineraryView'
import { StaysSection } from '../components/StaysSection'
import { Alert, Button, ButtonLink, Card, Container, EmptyState, PageHeader, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { formatDate } from '../lib/format'
import { getItinerary, listItineraries, removeItinerary, updateItinerary, type SavedItinerary } from '../lib/itinerary/itineraryStore'
import { useAsync } from '../lib/useAsync'

function Detail({ id }: { id: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const loaded = useAsync(() => getItinerary(db, user!.uid, id), [id, user?.uid])
  const [draft, setDraft] = useState<SavedItinerary | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (loaded.data) {
      setDraft(loaded.data)
      setDirty(false)
    }
  }, [loaded.data])

  if (loaded.loading) return <Container><Spinner /></Container>
  if (!draft) return <Container className="py-10"><EmptyState title="No encontramos este itinerario" action={<ButtonLink to="/itinerarios">Ver mis itinerarios</ButtonLink>} /></Container>

  async function save() {
    if (!draft || !user) return
    setBusy(true)
    try {
      await updateItinerary(db, user.uid, draft)
      setDirty(false)
      setMessage({ tone: 'success', text: 'Cambios guardados.' })
    } catch {
      setMessage({ tone: 'error', text: 'No pudimos guardar los cambios.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="py-8 sm:py-10">
      <p className="mb-2"><Link to="/itinerarios" className="text-sm font-semibold underline">← Mis itinerarios</Link></p>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="it-title" className="text-sm font-semibold text-muted">Nombre del itinerario</label>
          <input id="it-title" value={draft.title} maxLength={120} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDirty(true) }} className="block w-full rounded-xl border border-line bg-surface px-4 py-2 font-serif text-2xl font-semibold text-navy focus:border-teal focus:outline-none" />
          <p className="mt-1 text-sm text-muted">{formatDate(draft.startDate)} – {formatDate(draft.endDate)} · {draft.destination.displayName.split(',')[0]}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={!dirty || busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
          <Button variant="danger" onClick={async () => { if (window.confirm('¿Eliminar este itinerario?')) { await removeItinerary(db, user!.uid, draft.id); navigate('/itinerarios') } }}>Eliminar</Button>
        </div>
      </div>
      <h1 id="page-title" tabIndex={-1} className="sr-only focus:outline-none">{draft.title}</h1>
      {message && <div className="mb-4"><Alert tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Alert></div>}
      <ItineraryView itinerary={draft} onChange={(next) => { setDraft(next); setDirty(true); setMessage(null) }} />
      <div className="mt-10">
        <StaysSection lat={draft.destination.lat} lon={draft.destination.lon} placeName={draft.destination.displayName.split(',')[0]} checkIn={draft.startDate} checkOut={draft.endDate} guests={draft.travelers} />
      </div>
    </Container>
  )
}

export default function ItinerariesPage() {
  const { id } = useParams()
  const { user, loading } = useAuth()
  const list = useAsync(() => (user ? listItineraries(db, user.uid) : Promise.resolve([])), [user?.uid])

  if (id) return <Detail id={id} />
  if (loading) return <Container><Spinner /></Container>

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Planes de viaje" title="Itinerarios">Armamos tu plan día a día con lugares reales y la ruta que menos te hace recorrer.</PageHeader>
      <div className="mb-8 flex flex-wrap gap-3">
        <ButtonLink to="/">Armar un itinerario nuevo</ButtonLink>
      </div>
      {!user ? (
        <Card><p className="text-muted">Ingresa para guardar, editar y consultar tus itinerarios cuando quieras.</p><div className="mt-3"><ButtonLink to="/ingresar?next=/itinerarios" variant="secondary">Ingresar</ButtonLink></div></Card>
      ) : list.loading ? <Spinner /> : (list.data ?? []).length === 0 ? (
        <EmptyState title="Todavía no guardas itinerarios">Arma uno desde la portada o pídele a tu compañero LOCUS que te organice el viaje.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data!.map((it) => (
            <li key={it.id}>
              <Link to={`/itinerarios/${it.id}`} className="block rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:bg-surface-2">
                <p className="font-serif text-xl font-semibold text-navy">{it.title}</p>
                <p className="text-sm text-muted">{formatDate(it.startDate)} – {formatDate(it.endDate)} · {it.days.reduce((s, d) => s + d.places.length, 0)} lugares · {it.source === 'agent' ? 'creado con tu compañero' : 'creado en el planificador'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
