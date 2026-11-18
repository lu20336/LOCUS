/** Detalle de un viaje guardado (/mis-viajes/:id): ver y editar el itinerario, renombrar, duplicar, compartir y eliminar. */
import { ArrowLeft, Copy, Share2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ItineraryView } from '../components/ItineraryView'
import { StaysSection } from '../components/StaysSection'
import { useToast } from '../components/Toast'
import { tripImage } from '../components/trips/TripCard'
import { Alert, Badge, Button, ButtonLink, Container, EmptyState, Skeleton } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { useI18n } from '../lib/i18n/I18nProvider'
import { db } from '../lib/firebase/client'
import { formatDateRange, todayISO } from '../lib/format'
import { duplicateItinerary, getItinerary, removeItinerary, updateItinerary, type SavedItinerary } from '../lib/itinerary/itineraryStore'
import { shareSummary, tripDays, tripPlace, tripPlaces, tripStatus } from '../lib/trips/tripStatus'
import { useAsync } from '../lib/useAsync'

export default function TripDetailPage() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const loaded = useAsync(() => getItinerary(db, user!.uid, id), [id, user?.uid])
  const [draft, setDraft] = useState<SavedItinerary | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loaded.data) {
      setDraft(loaded.data)
      setDirty(false)
    }
  }, [loaded.data])

  // Avisa antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  if (loaded.loading) {
    return (
      <Container className="py-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-56 w-full" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </Container>
    )
  }
  if (!draft) {
    return (
      <Container className="py-10">
        <EmptyState title={t('trips.detail.notFound')} action={<ButtonLink to="/mis-viajes">{t('trips.detail.goTrips')}</ButtonLink>}>
          {t('trips.detail.notFoundText')}
        </EmptyState>
      </Container>
    )
  }

  const today = todayISO()
  const status = tripStatus(draft, today)
  const photo = tripImage(draft)
  const place = tripPlace(draft)
  const days = tripDays(draft)
  const stops = tripPlaces(draft)

  async function save() {
    if (!draft || !user) return
    setBusy(true)
    setError(null)
    try {
      await updateItinerary(db, user.uid, draft)
      setDirty(false)
      toast(t('trips.toast.saved'))
    } catch {
      setError(t('trips.detail.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function duplicate() {
    if (!draft || !user) return
    try {
      const copyId = await duplicateItinerary(db, user.uid, draft)
      toast(t('trips.toast.duplicated'), { action: { label: t('trips.toast.openCopy'), to: `/mis-viajes/${copyId}` } })
    } catch {
      toast(t('trips.toast.duplicateError'), { tone: 'error' })
    }
  }

  async function share() {
    if (!draft) return
    const text = shareSummary(draft, formatDateRange, t)
    try {
      if (navigator.share) await navigator.share({ title: draft.title, text })
      else {
        await navigator.clipboard.writeText(text)
        toast(t('trips.toast.copiedSummary'), { tone: 'info' })
      }
    } catch {
      // Compartir cancelado.
    }
  }

  async function remove() {
    if (!draft || !user) return
    setBusy(true)
    try {
      await removeItinerary(db, user.uid, draft.id)
      toast(t('trips.toast.deleted'), { tone: 'info' })
      navigate('/mis-viajes', { replace: true })
    } catch {
      setBusy(false)
      setConfirmDelete(false)
      setError(t('trips.toast.deleteError'))
    }
  }

  return (
    <Container className="py-6 sm:py-8">
      <Link to="/mis-viajes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-teal-soft">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('trips.detail.back')}
      </Link>

      <header className="card-photo relative isolate mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-teal-soft">
        {photo && <img src={photo} alt="" className="absolute inset-0 -z-10 size-full object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        <div className="flex min-h-48 flex-col justify-end gap-2 p-5 sm:min-h-60 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status === 'past' ? 'neutral' : 'teal'}>{t(`trips.status.${status}`)}</Badge>
            <span className="text-sm text-white/90">{place}</span>
          </div>
          <label htmlFor="trip-title" className="sr-only">{t('trips.detail.name')}</label>
          <input
            id="trip-title"
            value={draft.title}
            maxLength={120}
            onChange={(e) => {
              setDraft({ ...draft, title: e.target.value })
              setDirty(true)
            }}
            className="w-full rounded-xl border border-transparent bg-transparent px-0 font-serif text-3xl font-semibold text-white placeholder:text-white/60 hover:border-white/30 focus:border-white/60 focus:px-3 focus:outline-none sm:text-4xl"
          />
          <h1 id="page-title" tabIndex={-1} className="sr-only focus:outline-none">{draft.title}</h1>
          <p className="text-sm text-white/90">
            {formatDateRange(draft.startDate, draft.endDate)} · {t('common.days', { count: days })} · {t('common.persons', { count: draft.travelers })} · {t('common.places', { count: stops })}
          </p>
        </div>
      </header>

      <div className="sticky top-16 z-10 -mx-1 mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-header px-3 py-2 backdrop-blur">
        <Button onClick={save} disabled={!dirty || busy} className="!py-2">{busy ? t('trips.detail.saving') : dirty ? t('trips.detail.saveChanges') : t('trips.detail.saved')}</Button>
        <Button variant="ghost" className="border border-line !py-2" onClick={() => void duplicate()}><Copy aria-hidden="true" className="size-4" />{t('trips.card.duplicate')}</Button>
        <Button variant="ghost" className="border border-line !py-2" onClick={() => void share()}><Share2 aria-hidden="true" className="size-4" />{t('trips.card.share')}</Button>
        <Button variant="danger" className="ml-auto !py-2" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden="true" className="size-4" />{t('trips.card.delete')}</Button>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <ItineraryView
        itinerary={draft}
        onChange={(next) => {
          setDraft(next)
          setDirty(true)
        }}
      />

      <div className="mt-10">
        <StaysSection lat={draft.destination.lat} lon={draft.destination.lon} placeName={place} checkIn={draft.startDate} checkOut={draft.endDate} guests={draft.travelers} />
      </div>

      <ConfirmDialog open={confirmDelete} title={t('trips.deleteTitle')} confirmLabel={t('common.delete')} danger busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirmDelete(false)}>
        <p>{t('trips.deleteBody', { title: draft.title })}</p>
      </ConfirmDialog>
    </Container>
  )
}
