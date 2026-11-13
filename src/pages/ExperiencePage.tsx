import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { doc, getDoc } from 'firebase/firestore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Counter } from '../components/Counter'
import { FavoriteButton } from '../components/FavoriteButton'
import { inputClassName } from '../components/FormField'
import { StreetPhotos } from '../components/StreetPhotos'
import { WeatherPanel } from '../components/WeatherPanel'
import { Alert, Badge, Button, ButtonLink, Container, EmptyState, Spinner, selectClassName } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { BookingError, placeExperienceBooking, slotId } from '../lib/booking/bookingService'
import { fetchItem, fetchPhotos, fetchSlot } from '../lib/catalog/repo'
import { averageRating, fetchReviews } from '../lib/catalog/reviews'
import { quoteExperience } from '../lib/domain/pricing'
import { CANCELLATION_POLICIES, EXPERIENCE_CATEGORIES, type Experience } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { formatCOP, formatDate, todayISO } from '../lib/format'
import { LocusMap } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export default function ExperiencePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const today = todayISO()
  const exp = useAsync(() => fetchItem<Experience>(db, 'experiences', id), [id])
  const photos = useAsync(() => fetchPhotos(db, 'experiences', id), [id])
  const reviews = useAsync(() => fetchReviews(db, id), [id])
  const host = useAsync(async () => {
    if (!exp.data) return null
    const s = await getDoc(doc(db, 'hosts', exp.data.hostId))
    return s.exists() ? (s.data() as { displayName: string; verified: boolean }) : null
  }, [exp.data?.hostId])

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [people, setPeople] = useState(1)
  const [index, setIndex] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const e = exp.data
  const slotKey = date && time ? slotId(date, time) : ''
  const booked = useAsync(() => (e && slotKey ? fetchSlot(db, e.id, slotKey) : Promise.resolve(0)), [e?.id, slotKey])

  if (exp.loading) return <Container className="py-10"><Spinner /></Container>
  if (!e) return <Container className="py-12"><EmptyState title="No encontramos esta experiencia" action={<ButtonLink to="/experiencias">Ver experiencias</ButtonLink>} /></Container>

  const weekday = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : -1
  const dayOk = !date || e.weekdays.includes(weekday)
  const remaining = Math.max(0, e.capacity - (booked.data ?? 0))
  const peopleMax = slotKey ? Math.max(1, Math.min(remaining, e.capacity)) : e.capacity
  const ready = Boolean(date && time && dayOk && date >= today && remaining >= people && remaining > 0)
  const quote = quoteExperience(e.pricePerPerson, people)
  const urls = photos.data && photos.data.length > 0 ? photos.data.map((p) => p.dataUrl) : e.cover && e.photoCount > 0 ? [e.cover] : []
  const rating = averageRating(reviews.data ?? [])
  const policy = CANCELLATION_POLICIES[e.cancellationPolicy]
  const isOwner = user?.uid === e.hostId

  async function reserve() {
    if (!user || !e) return
    setBusy(true)
    setError(null)
    try {
      const bookingId = await placeExperienceBooking(db, { experience: e, guestId: user.uid, guestName: profile?.displayName || user.displayName || 'Huésped', date, startTime: time, people, today })
      navigate(`/reservas?nueva=${bookingId}`)
    } catch (err) {
      setConfirming(false)
      setError(err instanceof BookingError ? err.message : 'No pudimos completar la reserva.')
      booked.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="py-8 sm:py-10">
      {e.status !== 'published' && <div className="mb-4"><Alert tone="info">Vista previa para ti: esta experiencia no es visible para otros viajeros todavía.</Alert></div>}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{EXPERIENCE_CATEGORIES[e.category]} · {e.municipality}, {e.department}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">{e.title}</h1>
          <p className="mt-1 text-muted">{rating !== null ? `★ ${rating} (${reviews.data?.length})` : 'Aún sin reseñas'} · {Math.round((e.durationMinutes / 60) * 10) / 10} h · hasta {e.capacity} personas {e.isTestData && <Badge tone="warn">Dato de prueba</Badge>}</p>
        </div>
        <FavoriteButton className="border border-line" item={{ kind: 'experience', refId: e.id, title: e.title, subtitle: e.municipality }} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-8">
          {urls.length > 0 ? (
            <div>
              <img src={urls[Math.min(index, urls.length - 1)]} alt={`Foto ${index + 1} de ${e.title}`} className="aspect-[16/9] w-full rounded-3xl object-cover" />
              {urls.length > 1 && <ul className="mt-2 flex gap-2 overflow-x-auto">{urls.map((u, i) => <li key={i}><button type="button" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1}`} className={`overflow-hidden rounded-xl border-2 ${i === index ? 'border-teal' : 'border-transparent'}`}><img src={u} alt="" className="h-16 w-24 object-cover" /></button></li>)}</ul>}
            </div>
          ) : <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-surface-2 text-muted">Sin fotos todavía</div>}

          <section aria-labelledby="about"><h2 id="about" className="text-2xl font-semibold text-navy">Qué vas a hacer</h2><p className="mt-2 whitespace-pre-line text-ink">{e.description}</p></section>
          <section aria-labelledby="det">
            <h2 id="det" className="text-2xl font-semibold text-navy">Detalles</h2>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-ink">
              <li><strong>Días:</strong> {e.weekdays.map((d) => DAY_NAMES[d]).join(', ')}</li>
              <li><strong>Horarios:</strong> {e.startTimes.join(', ')}</li>
              <li><strong>Edad mínima:</strong> {e.minAge > 0 ? `${e.minAge} años` : 'sin límite'}</li>
              <li><strong>Idiomas:</strong> {e.languages.join(', ')}</li>
              {e.requirements && <li className="whitespace-pre-line"><strong>Requisitos:</strong> {e.requirements}</li>}
              <li><strong>Cancelación {policy.label.toLowerCase()}:</strong> {policy.description}</li>
              <li><strong>Operador:</strong> {e.providerName} {host.data?.verified ? <Badge tone="teal">Verificado</Badge> : <Badge>Aún sin verificar</Badge>}</li>
            </ul>
          </section>
          <section aria-labelledby="where"><h2 id="where" className="text-2xl font-semibold text-navy">Punto de encuentro</h2><p className="mt-1 text-muted">{e.addressReference}</p><div className="mt-3"><LocusMap markers={[{ id: e.id, lat: e.lat, lon: e.lon, kind: 'experience' }]} center={[e.lat, e.lon]} zoom={14} className="h-72" ariaLabel="Punto de encuentro" /></div></section>
          <StreetPhotos lat={e.lat} lon={e.lon} />
          <WeatherPanel lat={e.lat} lon={e.lon} title={`El clima en ${e.municipality}`} />
          <section aria-labelledby="rev">
            <h2 id="rev" className="text-2xl font-semibold text-navy">Reseñas</h2>
            {(reviews.data ?? []).length === 0 ? <p className="mt-2 text-muted">Todavía no hay reseñas.</p> : (
              <ul className="mt-3 flex flex-col gap-3">{reviews.data!.map((r) => <li key={r.id} className="rounded-2xl border border-line bg-surface p-4"><p className="font-semibold">{r.guestName || 'Viajero'} · {'★'.repeat(r.rating)}</p>{r.text && <p className="mt-1 text-sm">{r.text}</p>}</li>)}</ul>
            )}
          </section>
        </div>

        <aside aria-label="Reservar" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-lg">
            <p className="text-2xl font-semibold">{formatCOP(e.pricePerPerson)} <span className="text-base font-normal text-muted">por persona</span></p>
            <div className="mt-4 flex flex-col gap-3">
              <div><label htmlFor="xdate" className="text-sm font-semibold">Fecha</label><input id="xdate" type="date" min={today} value={date} onChange={(ev) => setDate(ev.target.value)} className={`${inputClassName} mt-1`} />{!dayOk && <p className="mt-1 text-sm font-medium text-danger">Se ofrece solo: {e.weekdays.map((d) => DAY_NAMES[d]).join(', ')}.</p>}</div>
              <div><label htmlFor="xtime" className="text-sm font-semibold">Horario</label><select id="xtime" value={time} onChange={(ev) => setTime(ev.target.value)} className={`${selectClassName} mt-1`}><option value="">Elige…</option>{e.startTimes.map((t) => <option key={t}>{t}</option>)}</select></div>
              <Counter label="Personas" icon="👥" unit="una persona" value={people} min={1} max={peopleMax} onChange={setPeople} />
              {slotKey && !booked.loading && <p className="text-sm text-muted" aria-live="polite">{remaining > 0 ? `Quedan ${remaining} cupos en esa sesión.` : 'Esa sesión está llena. Prueba otro horario o fecha.'}</p>}
            </div>
            {ready && <dl className="mt-4 border-t border-line pt-3 text-sm"><div className="flex justify-between text-base font-semibold"><dt>{people} × {formatCOP(e.pricePerPerson)}</dt><dd>{formatCOP(quote.total)}</dd></div></dl>}
            {error && <div className="mt-3"><Alert>{error}</Alert></div>}
            <div className="mt-4">
              {isOwner ? <ButtonLink to={`/anfitrion/experiencias/${e.id}`} variant="secondary" className="w-full">Editar mi experiencia</ButtonLink>
                : !user ? <ButtonLink to={`/ingresar?next=${encodeURIComponent(location.pathname)}`} className="w-full">Ingresa para reservar</ButtonLink>
                : <Button className="w-full" disabled={!ready || e.status !== 'published'} onClick={() => setConfirming(true)}>Reservar</Button>}
              <p className="mt-2 text-center text-xs text-muted">Reserva inmediata. No se cobra dinero: los pagos están en modo de prueba.</p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog open={confirming} title="Confirma tu reserva" confirmLabel="Confirmar reserva" busy={busy} onConfirm={reserve} onCancel={() => setConfirming(false)}>
        <div className="flex flex-col gap-2">
          <p><strong>{e.title}</strong></p>
          <p>{date && formatDate(date)} · {time} · {people} {people === 1 ? 'persona' : 'personas'}</p>
          <p>Total: <strong>{formatCOP(quote.total)}</strong></p>
          <p className="rounded-xl bg-surface-2 p-3"><strong>Pago simulado:</strong> LOCUS aún no cobra dinero real.</p>
          <p><strong>Cancelación {policy.label.toLowerCase()}:</strong> {policy.description}</p>
        </div>
      </ConfirmDialog>
    </Container>
  )
}
