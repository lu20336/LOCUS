/** Panel del anfitrión: registro, publicaciones, estado de moderación y estadísticas básicas. */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { FormField, inputClassName } from '../../components/FormField'
import { CalendarCheck, Sparkles } from 'lucide-react'
import { Alert, Badge, Button, ButtonLink, Card, CardGridSkeleton, Container, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../lib/auth/authContext'
import { deleteItem, fetchBookings, fetchByHost, setItemStatus, type CatalogKind } from '../../lib/catalog/repo'
import type { Booking, Experience, Listing, ListingStatus, StayPricing } from '../../lib/domain/types'
import { db } from '../../lib/firebase/client'
import { formatCOP, todayISO } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { usePlans } from '../../lib/plans/planContext'
import { useAsync } from '../../lib/useAsync'
import { STATUS_LABELS, bookingLink, bookingWhen } from '../TripsPage'

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: 'teal' | 'warn' | 'danger' | 'neutral' }> = {
  draft: { label: 'ls.draft', tone: 'neutral' },
  pending: { label: 'hd.inReview', tone: 'warn' },
  published: { label: 'ls.published', tone: 'teal' },
  rejected: { label: 'ls.rejected', tone: 'danger' },
  suspended: { label: 'ls.suspended', tone: 'danger' },
}

function HostRegistration() {
  const { t, meta } = useI18n()
  const { user, profile, becomeHost } = useAuth()
  const [name, setName] = useState(profile?.displayName || user?.displayName || '')
  const [bio, setBio] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [languages, setLanguages] = useState(meta.nativeName)
  const [rnt, setRnt] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError(t('hd.errName'))
    if (!accepted) return setError(t('hd.errAccept'))
    setBusy(true)
    setError(null)
    try {
      await becomeHost({ displayName: name.trim(), bio: bio.trim().slice(0, 1000), municipality: municipality.trim(), languages: languages.split(',').map((l) => l.trim()).filter(Boolean).slice(0, 6), rnt: rnt.trim().slice(0, 30) })
    } catch {
      setError(t('hd.errCreate'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="max-w-2xl py-8 sm:py-10">
      <PageHeader eyebrow={t('hb.eyebrow')} title={t('hd.regTitle')}>
        {t('hd.regIntro')}
      </PageHeader>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField id="h-name" label={t('hd.publicName')}>{(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="h-mun" label={t('hd.municipality')}>{(c) => <input {...c} value={municipality} onChange={(e) => setMunicipality(e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="h-bio" label={t('hd.bio')} hint={t('hd.bioHint')}>{(c) => <textarea {...c} rows={3} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="h-lang" label={t('hd.languages')}>{(c) => <input {...c} value={languages} onChange={(e) => setLanguages(e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="h-rnt" label={t('hd.rnt')} hint={t('hd.rntHint')}>{(c) => <input {...c} value={rnt} onChange={(e) => setRnt(e.target.value)} className={inputClassName} />}</FormField>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>{t('hd.accept')}</span>
          </label>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? t('hd.creating') : t('hd.createProfile')}</Button>
        </form>
      </Card>
    </Container>
  )
}

function ItemRow({ kind, item, onChanged }: { kind: CatalogKind; item: Listing | Experience; onChanged: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const s = LISTING_STATUS[item.status]
  const base = kind === 'listings' ? `/anfitrion/alojamientos/${item.id}` : `/anfitrion/experiencias/${item.id}`
  const view = kind === 'listings' ? `/hospedajes/${item.id}` : `/experiencias/${item.id}`

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch {
      setError(t('hb.actionError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        {item.cover ? <img src={item.cover} alt="" className="size-16 rounded-xl object-cover" /> : <div className="grid size-16 place-items-center rounded-xl bg-surface-2 text-xs text-muted">{t('hd.noPhoto')}</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{item.title}</p>
          <p className="text-sm text-muted">{item.municipality} · {kind === 'listings' ? t('hd.perNightShort', { price: formatCOP((item as Listing).pricePerNight) }) : t('hd.perPersonShort', { price: formatCOP((item as Experience).pricePerPerson) })}</p>
        </div>
        <Badge tone={s.tone}>{t(s.label)}</Badge>
      </div>
      {item.status === 'rejected' && item.rejectionReason && <p className="mt-2 text-sm text-danger">{t('hd.rejectionReason', { reason: item.rejectionReason })}</p>}
      {item.status === 'suspended' && <p className="mt-2 text-sm text-danger">{t('hd.suspended')}</p>}
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.status !== 'suspended' && <ButtonLink to={base} variant="secondary" className="px-3 py-1.5 text-sm">{t('common.edit')}</ButtonLink>}
        {kind === 'listings' && item.status !== 'suspended' && <ButtonLink to={`${base}/calendario`} variant="secondary" className="px-3 py-1.5 text-sm">{t('hd.calendar')}</ButtonLink>}
        <ButtonLink to={view} variant="ghost" className="border border-line px-3 py-1.5 text-sm">{t('ex.viewListing')}</ButtonLink>
        {item.status === 'draft' && <Button variant="ghost" className="border border-line px-3 py-1.5 text-sm" disabled={busy} onClick={() => run(() => setItemStatus(db, kind, item.id, 'pending'))}>{t('hd.sendReview')}</Button>}
        {item.status === 'pending' && <Button variant="ghost" className="border border-line px-3 py-1.5 text-sm" disabled={busy} onClick={() => run(() => setItemStatus(db, kind, item.id, 'draft'))}>{t('hd.backToDraft')}</Button>}
        {item.status === 'published' && <Button variant="ghost" className="border border-line px-3 py-1.5 text-sm" disabled={busy} onClick={() => run(() => setItemStatus(db, kind, item.id, 'draft'))}>{t('hd.unpublish')}</Button>}
        {(item.status === 'draft' || item.status === 'rejected') && (
          <Button variant="danger" className="px-3 py-1.5 text-sm" disabled={busy} onClick={() => { if (window.confirm(t('hd.confirmDelete'))) void run(() => deleteItem(db, kind, item.id)) }}>{t('common.delete')}</Button>
        )}
      </div>
    </li>
  )
}

function Stats({ bookings }: { bookings: Booking[] }) {
  const { t } = useI18n()
  const today = todayISO()
  const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed')
  const income = active.reduce((s, b) => s + (b.pricing as { total: number }).total, 0)
  const pending = bookings.filter((b) => b.status === 'pending').length
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && (b.kind === 'listing' ? b.checkOut! : b.date!) >= today).length
  const stat = (label: string, value: string) => (
    <div className="rounded-2xl bg-surface-2 p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold text-navy">{value}</dd></div>
  )
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stat(t('hd.statPending'), String(pending))}
      {stat(t('trips.upcomingBookings'), String(upcoming))}
      {stat(t('hd.statTotal'), String(bookings.length))}
      {stat(t('hd.statIncome'), formatCOP(income))}
    </dl>
  )
}

/** Plan del anfitrión (demostrativo) y publicaciones usadas, más lo que espera su respuesta. */
function HostStrip({ used, pending }: { used: number; pending: number }) {
  const { t } = useI18n()
  const { planFor } = usePlans()
  const plan = planFor('host')
  const limit = plan.maxListings
  return (
    <div className="mb-8 grid gap-3 md:grid-cols-2">
      <div className="anim-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{t('host.yourPlan')}</p>
          <p className="font-serif text-lg font-semibold text-navy">{plan.name}</p>
          <p className="text-sm text-muted">
            {limit === undefined ? t('host.listingsUsedUnlimited', { used }) : t('host.listingsUsed', { used, limit })} · {t('host.commission', { pct: plan.commissionPct ?? 0 })}
          </p>
        </div>
        <Link to="/planes" className="inline-flex items-center gap-1.5 rounded-xl border-2 border-teal px-3.5 py-2 text-sm font-bold text-ink transition hover:bg-teal/10">
          <Sparkles aria-hidden="true" className="size-4" />
          {t('promo.seePlans')}
        </Link>
      </div>
      {pending > 0 ? (
        <Link to="/anfitrion/reservas" className="anim-rise flex items-center gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 transition hover:bg-coral/15">
          <CalendarCheck aria-hidden="true" className="size-7 shrink-0 text-coral" />
          <span>
            <span className="block font-semibold text-ink">{t('host.pendingTitle', { count: pending })}</span>
            <span className="block text-sm text-muted">{t('host.pendingHint')}</span>
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <CalendarCheck aria-hidden="true" className="size-7 shrink-0 text-teal-soft" />
          <span>
            <span className="block font-semibold text-ink">{t('host.upToDate')}</span>
            <span className="block text-sm text-muted">{t('host.noPending')}</span>
          </span>
        </div>
      )}
    </div>
  )
}

export default function HostDashboard() {
  const { t } = useI18n()
  const { user, profile, loading } = useAuth()
  const listings = useAsync(() => fetchByHost<Listing>(db, 'listings', user!.uid), [user?.uid, profile?.isHost])
  const experiences = useAsync(() => fetchByHost<Experience>(db, 'experiences', user!.uid), [user?.uid, profile?.isHost])
  const bookings = useAsync(() => fetchBookings(db, 'host', user!.uid), [user?.uid, profile?.isHost])

  if (loading) return <Container><Spinner /></Container>
  if (!profile?.isHost) return <HostRegistration />

  const recent = (bookings.data ?? []).slice(0, 8)
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader eyebrow={t('hb.eyebrow')} title={t('hd.title')}>{t('hd.intro')}</PageHeader>

      <p className="-mt-4 mb-6 text-sm text-muted">
        {t('host.modeNotice')} <Link to="/mis-viajes" className="font-semibold text-teal-soft underline">{t('host.switchToTraveler')}</Link>
      </p>

      <div className="mb-8 flex flex-wrap gap-3">
        <ButtonLink to="/anfitrion/alojamientos/nuevo">{t('hd.newListing')}</ButtonLink>
        <ButtonLink to="/anfitrion/experiencias/nueva" variant="secondary">{t('hd.newExperience')}</ButtonLink>
        <ButtonLink to="/anfitrion/reservas" variant="ghost" className="border border-line">{t('hb.title')}</ButtonLink>
      </div>

      <HostStrip used={(listings.data?.length ?? 0) + (experiences.data?.length ?? 0)} pending={(bookings.data ?? []).filter((b) => b.status === 'pending').length} />

      {bookings.data && <div className="mb-10"><Stats bookings={bookings.data} /></div>}

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="my-listings">
          <h2 id="my-listings" className="mb-3 text-2xl font-semibold text-navy">{t('nav.stays')}</h2>
          {listings.loading ? <CardGridSkeleton count={1} label={t('hd.loadingListings')} /> : (listings.data ?? []).length === 0 ? <EmptyState title={t('hd.noListings')}>{t('hd.noListingsText')}</EmptyState> : (
            <ul className="flex flex-col gap-3">{listings.data!.map((l) => <ItemRow key={l.id} kind="listings" item={l} onChanged={listings.reload} />)}</ul>
          )}
        </section>
        <section aria-labelledby="my-exps">
          <h2 id="my-exps" className="mb-3 text-2xl font-semibold text-navy">{t('nav.experiences')}</h2>
          {experiences.loading ? <CardGridSkeleton count={1} label={t('hd.loadingExperiences')} /> : (experiences.data ?? []).length === 0 ? <EmptyState title={t('hd.noExperiences')}>{t('hd.noExperiencesText')}</EmptyState> : (
            <ul className="flex flex-col gap-3">{experiences.data!.map((x) => <ItemRow key={x.id} kind="experiences" item={x} onChanged={experiences.reload} />)}</ul>
          )}
        </section>
      </div>

      <section aria-labelledby="activity" className="mt-10">
        <h2 id="activity" className="mb-3 text-2xl font-semibold text-navy">{t('hd.recent')}</h2>
        {recent.length === 0 ? <p className="text-muted">{t('hd.noBookings')}</p> : (
          <ul className="flex flex-col gap-2">
            {recent.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                <span><Link to={bookingLink(b)} className="font-semibold hover:underline">{b.itemTitle}</Link> · {b.guestName} · {bookingWhen(b)}</span>
                <span className="flex items-center gap-2"><span>{formatCOP((b.pricing as StayPricing).total)}</span><Badge tone={STATUS_LABELS[b.status].tone}>{t(STATUS_LABELS[b.status].label)}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  )
}
