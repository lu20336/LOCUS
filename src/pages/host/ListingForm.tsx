/** Formulario de publicación/edición de alojamientos (anfitrión). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useNavigate, useParams } from 'react-router'
import { FormField, inputClassName } from '../../components/FormField'
import { LocationPicker } from '../../components/host/LocationPicker'
import { PhotoUploader, type EditablePhoto } from '../../components/host/PhotoUploader'
import { Alert, Button, Card, Container, PageHeader, Spinner, selectClassName } from '../../components/ui'
import { useAuth } from '../../lib/auth/authContext'
import { fetchItem, fetchPhotos, replacePhotos, saveItem, type ListingInput } from '../../lib/catalog/repo'
import { AMENITIES, CANCELLATION_POLICIES, LISTING_TYPES, type Listing, type ListingType } from '../../lib/domain/types'
import { DEPARTMENTS, hasFormErrors, validateListingDraft, type FormErrors, type ListingDraft } from '../../lib/domain/validation'
import { db } from '../../lib/firebase/client'
import { placeholderCover, thumbFromDataUrl } from '../../lib/images/compress'
import { useAsync } from '../../lib/useAsync'

const EMPTY: ListingDraft = {
  title: '', description: '', type: 'casa', capacity: 2, bedrooms: 1, beds: 1, bathrooms: 1,
  department: '', municipality: '', addressReference: '', lat: null, lon: null, amenities: [],
  pricePerNight: 150000, cleaningFee: 0, includedGuests: 2, extraGuestFee: 0, minNights: 1, maxNights: 30,
  bookingMode: 'instant', cancellationPolicy: 'flexible', checkInTime: '15:00', checkOutTime: '11:00', rules: '', photoCount: 0,
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card><h2 className="mb-4 text-xl font-semibold text-navy">{title}</h2><div className="flex flex-col gap-4">{children}</div></Card>
}

function NumberField({ id, label, value, onChange, error, hint, min = 0, step = 1 }: { id: string; label: string; value: number; onChange: (n: number) => void; error?: string; hint?: string; min?: number; step?: number }) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      {(c) => <input {...c} type="number" inputMode="numeric" min={min} step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} className={inputClassName} />}
    </FormField>
  )
}

export default function ListingForm() {
  const { t } = useI18n()
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ListingDraft>(EMPTY)
  const [photos, setPhotos] = useState<EditablePhoto[]>([])
  const [errors, setErrors] = useState<FormErrors<ListingDraft>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)
  const [existing, setExisting] = useState<Listing | null>(null)

  const loaded = useAsync(async () => {
    if (!id) return null
    const [item, ph] = await Promise.all([fetchItem<Listing>(db, 'listings', id), fetchPhotos(db, 'listings', id)])
    return { item, ph }
  }, [id])

  useEffect(() => {
    const data = loaded.data
    if (!data?.item) return
    const { item } = data
    setExisting(item)
    setDraft({
      title: item.title, description: item.description, type: item.type, capacity: item.capacity, bedrooms: item.bedrooms, beds: item.beds, bathrooms: item.bathrooms,
      department: item.department, municipality: item.municipality, addressReference: item.addressReference, lat: item.lat, lon: item.lon, amenities: item.amenities,
      pricePerNight: item.pricePerNight, cleaningFee: item.cleaningFee, includedGuests: item.includedGuests, extraGuestFee: item.extraGuestFee, minNights: item.minNights, maxNights: item.maxNights,
      bookingMode: item.bookingMode, cancellationPolicy: item.cancellationPolicy, checkInTime: item.checkInTime, checkOutTime: item.checkOutTime, rules: item.rules, photoCount: item.photoCount,
    })
    setPhotos(data.ph.map((p) => ({ key: p.id, dataUrl: p.dataUrl, alt: p.alt })))
  }, [loaded.data])

  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const toggleAmenity = (a: string) => set('amenities', draft.amenities.includes(a) ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a])

  if (id && loaded.loading) return <Container><Spinner /></Container>
  if (id && !loaded.loading && !loaded.data?.item) return <Container className="py-10"><Alert>{t('hf.notFound')}</Alert></Container>
  if (existing && existing.hostId !== user?.uid) return <Container className="py-10"><Alert>{t('hf.notYours')}</Alert></Container>

  const canSubmitReview = !existing || existing.status === 'draft' || existing.status === 'rejected'
  const keepsStatus = existing && (existing.status === 'pending' || existing.status === 'published')

  async function save(target: 'draft' | 'pending') {
    if (!user) return
    const status = keepsStatus ? (existing!.status as 'pending' | 'published') : target
    const next = { ...draft, photoCount: photos.length }
    const found = validateListingDraft(next, status === 'pending')
    setErrors(found)
    if (hasFormErrors(found)) {
      setMessage(t('hf.reviewFields'))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const cover = photos.length === 0 ? placeholderCover() : photos[0].thumb ?? (await thumbFromDataUrl(photos[0].dataUrl))
      const input: ListingInput = { ...next, lat: next.lat!, lon: next.lon!, cover }
      const savedId = await saveItem(db, 'listings', user.uid, input, status, existing ? { id: existing.id, createdAt: existing.createdAt } : undefined)
      await replacePhotos(db, 'listings', savedId, photos.map((p) => ({ dataUrl: p.dataUrl, alt: p.alt })))
      navigate('/anfitrion', { replace: true })
    } catch {
      setMessage(t('hf.saveError'))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <div ref={topRef} />
      <PageHeader eyebrow={t('hb.eyebrow')} title={existing ? t('hf.editListing') : t('hf.newListing')}>
        {t('hf.listingIntro')}
      </PageHeader>
      {message && <div className="mb-4"><Alert>{message}</Alert></div>}

      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
        <Section title={t('hf.general')}>
          <FormField id="title" label={t('hf.listingName')} error={errors.title}>{(c) => <input {...c} value={draft.title} maxLength={100} onChange={(e) => set('title', e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="desc" label={t('hf.description')} error={errors.description} hint={t('hf.descHint')}>{(c) => <textarea {...c} rows={5} maxLength={4000} value={draft.description} onChange={(e) => set('description', e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="type" label={t('hf.listingType')}>{(c) => <select {...c} value={draft.type} onChange={(e) => set('type', e.target.value as ListingType)} className={selectClassName}>{Object.entries(LISTING_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</FormField>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="cap" label={t('hf.capacity')} value={draft.capacity} min={1} onChange={(n) => set('capacity', n)} error={errors.capacity} />
            <NumberField id="bed" label={t('flow.rooms')} value={draft.bedrooms} onChange={(n) => set('bedrooms', n)} error={errors.bedrooms} />
            <NumberField id="beds" label={t('hf.beds')} value={draft.beds} min={1} onChange={(n) => set('beds', n)} error={errors.beds} />
            <NumberField id="bath" label={t('hf.baths')} value={draft.bathrooms} onChange={(n) => set('bathrooms', n)} error={errors.bathrooms} />
          </div>
        </Section>

        <Section title={t('hf.location')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="dep" label={t('hf.department')} error={errors.department}>{(c) => <select {...c} value={draft.department} onChange={(e) => set('department', e.target.value)} className={selectClassName}><option value="">{t('xp.choose')}</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>}</FormField>
            <FormField id="mun" label={t('hd.municipalityShort')} error={errors.municipality}>{(c) => <input {...c} value={draft.municipality} onChange={(e) => set('municipality', e.target.value)} className={inputClassName} />}</FormField>
          </div>
          <FormField id="addr" label={t('hf.address')} hint={t('hf.addressHint')}>{(c) => <input {...c} value={draft.addressReference} maxLength={300} onChange={(e) => set('addressReference', e.target.value)} className={inputClassName} />}</FormField>
          <LocationPicker lat={draft.lat} lon={draft.lon} onChange={(la, lo) => setDraft((d) => ({ ...d, lat: la, lon: lo }))} error={errors.lat} searchHint={draft.municipality} />
        </Section>

        <Section title={t('hf.photos')}>
          <PhotoUploader photos={photos} onChange={setPhotos} />
          {errors.photoCount && <Alert>{errors.photoCount}</Alert>}
        </Section>

        <Section title={t('lp.amenities')}>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(AMENITIES).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <input type="checkbox" checked={draft.amenities.includes(k)} onChange={() => toggleAmenity(k)} className="size-4 accent-[var(--primary)]" /> {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title={t('hf.rates')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="price" label={t('hf.pricePerNight')} value={draft.pricePerNight} step={1000} onChange={(n) => set('pricePerNight', n)} error={errors.pricePerNight} />
            <NumberField id="clean" label={t('hf.cleaning')} value={draft.cleaningFee} step={1000} onChange={(n) => set('cleaningFee', n)} error={errors.cleaningFee} />
            <NumberField id="inc" label={t('hf.included')} value={draft.includedGuests} min={1} onChange={(n) => set('includedGuests', n)} error={errors.includedGuests} />
            <NumberField id="extra" label={t('hf.extraFee')} value={draft.extraGuestFee} step={1000} onChange={(n) => set('extraGuestFee', n)} error={errors.extraGuestFee} />
            <NumberField id="min" label={t('hf.minNights')} value={draft.minNights} min={1} onChange={(n) => set('minNights', n)} error={errors.minNights} />
            <NumberField id="max" label={t('hf.maxNights')} value={draft.maxNights} min={1} onChange={(n) => set('maxNights', n)} error={errors.maxNights} />
          </div>
          <FormField id="mode" label={t('hf.bookingMode')}>{(c) => <select {...c} value={draft.bookingMode} onChange={(e) => set('bookingMode', e.target.value as 'instant' | 'request')} className={selectClassName}><option value="instant">{t('hf.modeInstant')}</option><option value="request">{t('hf.modeRequest')}</option></select>}</FormField>
          <FormField id="pol" label={t('hf.cancelPolicy')} hint={CANCELLATION_POLICIES[draft.cancellationPolicy].description}>{(c) => <select {...c} value={draft.cancellationPolicy} onChange={(e) => set('cancellationPolicy', e.target.value as ListingDraft['cancellationPolicy'])} className={selectClassName}>{Object.entries(CANCELLATION_POLICIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}</FormField>
          <p className="text-sm text-muted">{t('hf.availabilityNote')}</p>
        </Section>

        <Section title={t('hf.rulesTitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cin" label={t('hf.checkInTime')}>{(c) => <input {...c} type="time" value={draft.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} className={inputClassName} />}</FormField>
            <FormField id="cout" label={t('hf.checkOutTime')}>{(c) => <input {...c} type="time" value={draft.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} className={inputClassName} />}</FormField>
          </div>
          <FormField id="rules" label={t('hf.rules')} hint={t('hf.rulesHint')}>{(c) => <textarea {...c} rows={3} maxLength={2000} value={draft.rules} onChange={(e) => set('rules', e.target.value)} className={inputClassName} />}</FormField>
        </Section>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" className="border border-line" onClick={() => navigate('/anfitrion')} disabled={saving}>{t('common.cancel')}</Button>
          {keepsStatus ? (
            <Button onClick={() => save('draft')} disabled={saving}>{saving ? t('trips.detail.saving') : t('trips.detail.saveChanges')}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>{saving ? t('trips.detail.saving') : t('hf.saveDraft')}</Button>
              {canSubmitReview && <Button onClick={() => save('pending')} disabled={saving}>{t('hd.sendReview')}</Button>}
            </>
          )}
        </div>
      </form>
    </Container>
  )
}
