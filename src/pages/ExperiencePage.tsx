import { Users } from 'lucide-react'
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
import { useI18n } from '../lib/i18n/I18nProvider'
import { LocusMap } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'

export default function ExperiencePage() {
  const { t, meta } = useI18n()
  const dayNames = Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(meta.bcp47, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d))))
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
  if (!e) return <Container className="py-12"><EmptyState title={t('xp.notFound')} action={<ButtonLink to="/experiencias">{t('xp.seeExperiences')}</ButtonLink>} /></Container>

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
      const bookingId = await placeExperienceBooking(db, { experience: e, guestId: user.uid, guestName: profile?.displayName || user.displayName || t('lp.guestDefault'), date, startTime: time, people, today })
      navigate(`/reservas?nueva=${bookingId}`)
    } catch (err) {
      setConfirming(false)
      setError(err instanceof BookingError ? err.message : t('lp.bookError'))
      booked.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="py-8 sm:py-10">
      {e.status !== 'published' && <div className="mb-4"><Alert tone="info">{t('xp.preview')}</Alert></div>}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{EXPERIENCE_CATEGORIES[e.category]} · {e.municipality}, {e.department}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">{e.title}</h1>
          <p className="mt-1 text-muted">{rating !== null ? t('xp.reviewsShort', { rating, count: reviews.data?.length ?? 0 }) : t('lp.noReviewsYet')} · {t('xp.upTo', { hours: Math.round((e.durationMinutes / 60) * 10) / 10, count: e.capacity })} {e.isTestData && <Badge tone="warn">{t('cat.testData')}</Badge>}</p>
        </div>
        <FavoriteButton className="border border-line" item={{ kind: 'experience', refId: e.id, title: e.title, subtitle: e.municipality }} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-8">
          {urls.length > 0 ? (
            <div>
              <img src={urls[Math.min(index, urls.length - 1)]} alt={t('xp.photoAlt', { n: index + 1, title: e.title })} className="aspect-[16/9] w-full rounded-3xl object-cover" />
              {urls.length > 1 && <ul className="mt-2 flex gap-2 overflow-x-auto">{urls.map((u, i) => <li key={i}><button type="button" onClick={() => setIndex(i)} aria-label={t('lp.viewPhoto', { n: i + 1 })} className={`overflow-hidden rounded-xl border-2 ${i === index ? 'border-teal' : 'border-transparent'}`}><img src={u} alt="" className="h-16 w-24 object-cover" /></button></li>)}</ul>}
            </div>
          ) : <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-surface-2 text-muted">{t('xp.noPhotos')}</div>}

          <section aria-labelledby="about"><h2 id="about" className="text-2xl font-semibold text-navy">{t('xp.whatYouDo')}</h2><p className="mt-2 whitespace-pre-line text-ink">{e.description}</p></section>
          <section aria-labelledby="det">
            <h2 id="det" className="text-2xl font-semibold text-navy">{t('xp.details')}</h2>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-ink">
              <li><strong>{t('xp.days')}</strong> {e.weekdays.map((d) => dayNames[d]).join(', ')}</li>
              <li><strong>{t('xp.times')}</strong> {e.startTimes.join(', ')}</li>
              <li><strong>{t('xp.minAge')}</strong> {e.minAge > 0 ? t('xp.years', { count: e.minAge }) : t('xp.noLimit')}</li>
              <li><strong>{t('xp.languages')}</strong> {e.languages.join(', ')}</li>
              {e.requirements && <li className="whitespace-pre-line"><strong>{t('xp.requirements')}</strong> {e.requirements}</li>}
              <li><strong>{t('lp.cancellation', { policy: policy.label.toLowerCase() })}</strong> {policy.description}</li>
              <li><strong>{t('xp.operator')}</strong> {e.providerName} {host.data?.verified ? <Badge tone="teal">{t('xp.verified')}</Badge> : <Badge>{t('lp.notVerified')}</Badge>}</li>
            </ul>
          </section>
          <section aria-labelledby="where"><h2 id="where" className="text-2xl font-semibold text-navy">{t('xp.meetingPoint')}</h2><p className="mt-1 text-muted">{e.addressReference}</p><div className="mt-3"><LocusMap markers={[{ id: e.id, lat: e.lat, lon: e.lon, kind: 'experience' }]} center={[e.lat, e.lon]} zoom={14} className="h-72" ariaLabel={t('xp.meetingPoint')} /></div></section>
          <StreetPhotos lat={e.lat} lon={e.lon} />
          <WeatherPanel lat={e.lat} lon={e.lon} title={t('lp.weatherIn', { place: e.municipality })} />
          <section aria-labelledby="rev">
            <h2 id="rev" className="text-2xl font-semibold text-navy">{t('lp.reviews')}</h2>
            {(reviews.data ?? []).length === 0 ? <p className="mt-2 text-muted">{t('xp.noReviews')}</p> : (
              <ul className="mt-3 flex flex-col gap-3">{reviews.data!.map((r) => <li key={r.id} className="rounded-2xl border border-line bg-surface p-4"><p className="font-semibold">{r.guestName || t('xp.travelerDefault')} · {'★'.repeat(r.rating)}</p>{r.text && <p className="mt-1 text-sm">{r.text}</p>}</li>)}</ul>
            )}
          </section>
        </div>

        <aside aria-label={t('lp.book')} className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-lg">
            <p className="text-2xl font-semibold">{formatCOP(e.pricePerPerson)} <span className="text-base font-normal text-muted">{t('common.perPerson')}</span></p>
            <div className="mt-4 flex flex-col gap-3">
              <div><label htmlFor="xdate" className="text-sm font-semibold">{t('xp.date')}</label><input id="xdate" type="date" min={today} value={date} onChange={(ev) => setDate(ev.target.value)} className={`${inputClassName} mt-1`} />{!dayOk && <p className="mt-1 text-sm font-medium text-danger">{t('xp.onlyOn', { days: e.weekdays.map((d) => dayNames[d]).join(', ') })}</p>}</div>
              <div><label htmlFor="xtime" className="text-sm font-semibold">{t('xp.time')}</label><select id="xtime" value={time} onChange={(ev) => setTime(ev.target.value)} className={`${selectClassName} mt-1`}><option value="">{t('xp.choose')}</option>{e.startTimes.map((t) => <option key={t}>{t}</option>)}</select></div>
              <Counter label={t('xp.people')} icon={Users} unit={t('xp.onePerson')} value={people} min={1} max={peopleMax} onChange={setPeople} />
              {slotKey && !booked.loading && <p className="text-sm text-muted" aria-live="polite">{remaining > 0 ? t('xp.spotsLeft', { count: remaining }) : t('xp.full')}</p>}
            </div>
            {ready && <dl className="mt-4 border-t border-line pt-3 text-sm"><div className="flex justify-between text-base font-semibold"><dt>{people} × {formatCOP(e.pricePerPerson)}</dt><dd>{formatCOP(quote.total)}</dd></div></dl>}
            {error && <div className="mt-3"><Alert>{error}</Alert></div>}
            <div className="mt-4">
              {isOwner ? <ButtonLink to={`/anfitrion/experiencias/${e.id}`} variant="secondary" className="w-full">{t('xp.editMine')}</ButtonLink>
                : !user ? <ButtonLink to={`/ingresar?next=${encodeURIComponent(location.pathname)}`} className="w-full">{t('lp.signInToBook')}</ButtonLink>
                : <Button className="w-full" disabled={!ready || e.status !== 'published'} onClick={() => setConfirming(true)}>{t('lp.book')}</Button>}
              <p className="mt-2 text-center text-xs text-muted">{t('xp.instantNote')}</p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog open={confirming} title={t('lp.confirmBooking')} confirmLabel={t('lp.confirmBookingBtn')} busy={busy} onConfirm={reserve} onCancel={() => setConfirming(false)}>
        <div className="flex flex-col gap-2">
          <p><strong>{e.title}</strong></p>
          <p>{date && formatDate(date)} · {time} · {t('common.persons', { count: people })}</p>
          <p>{t('lp.totalLine')} <strong>{formatCOP(quote.total)}</strong></p>
          <p className="rounded-xl bg-surface-2 p-3"><strong>{t('lp.simulatedPayment')}</strong> {t('xp.simulatedBody')}</p>
          <p><strong>{t('lp.cancellation', { policy: policy.label.toLowerCase() })}</strong> {policy.description}</p>
        </div>
      </ConfirmDialog>
    </Container>
  )
}
