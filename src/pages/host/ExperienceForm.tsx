/** Formulario de publicación/edición de experiencias (anfitrión). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useNavigate, useParams } from 'react-router'
import { FormField, inputClassName } from '../../components/FormField'
import { LocationPicker } from '../../components/host/LocationPicker'
import { PhotoUploader, type EditablePhoto } from '../../components/host/PhotoUploader'
import { Alert, Button, Card, Container, PageHeader, Spinner, selectClassName } from '../../components/ui'
import { useAuth } from '../../lib/auth/authContext'
import { fetchItem, fetchPhotos, replacePhotos, saveItem, type ExperienceInput } from '../../lib/catalog/repo'
import { CANCELLATION_POLICIES, EXPERIENCE_CATEGORIES, type Experience, type ExperienceCategory } from '../../lib/domain/types'
import { DEPARTMENTS, hasFormErrors, validateExperienceDraft, type ExperienceDraft, type FormErrors } from '../../lib/domain/validation'
import { db } from '../../lib/firebase/client'
import { placeholderCover, thumbFromDataUrl } from '../../lib/images/compress'
import { useAsync } from '../../lib/useAsync'

const EMPTY: ExperienceDraft = {
  title: '', description: '', category: 'caminata', department: '', municipality: '', addressReference: '', lat: null, lon: null,
  durationMinutes: 180, pricePerPerson: 60000, capacity: 8, minAge: 0, languages: ['es'], weekdays: [0, 6], startTimes: ['09:00'],
  requirements: '', cancellationPolicy: 'flexible', providerName: '', photoCount: 0,
}
/** Idiomas en que se ofrece una experiencia: se muestran con su nombre propio. */
const LANGS: Record<string, string> = { es: 'Español', en: 'English', fr: 'Français', pt: 'Português', de: 'Deutsch' }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card><h2 className="mb-4 text-xl font-semibold text-navy">{title}</h2><div className="flex flex-col gap-4">{children}</div></Card>
}

export default function ExperienceForm() {
  const { t, meta } = useI18n()
  const DAYS = Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(meta.bcp47, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d))))
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ExperienceDraft>({ ...EMPTY, providerName: profile?.displayName ?? '' })
  const [photos, setPhotos] = useState<EditablePhoto[]>([])
  const [errors, setErrors] = useState<FormErrors<ExperienceDraft>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [existing, setExisting] = useState<Experience | null>(null)
  const [newTime, setNewTime] = useState('')
  const topRef = useRef<HTMLDivElement | null>(null)

  const loaded = useAsync(async () => {
    if (!id) return null
    const [item, ph] = await Promise.all([fetchItem<Experience>(db, 'experiences', id), fetchPhotos(db, 'experiences', id)])
    return { item, ph }
  }, [id])

  useEffect(() => {
    const data = loaded.data
    if (!data?.item) return
    const i = data.item
    setExisting(i)
    setDraft({
      title: i.title, description: i.description, category: i.category, department: i.department, municipality: i.municipality, addressReference: i.addressReference,
      lat: i.lat, lon: i.lon, durationMinutes: i.durationMinutes, pricePerPerson: i.pricePerPerson, capacity: i.capacity, minAge: i.minAge, languages: i.languages,
      weekdays: i.weekdays, startTimes: i.startTimes, requirements: i.requirements, cancellationPolicy: i.cancellationPolicy, providerName: i.providerName, photoCount: i.photoCount,
    })
    setPhotos(data.ph.map((p) => ({ key: p.id, dataUrl: p.dataUrl, alt: p.alt })))
  }, [loaded.data])

  const set = <K extends keyof ExperienceDraft>(k: K, v: ExperienceDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  if (id && loaded.loading) return <Container><Spinner /></Container>
  if (id && !loaded.loading && !loaded.data?.item) return <Container className="py-10"><Alert>{t('hf.notFoundExp')}</Alert></Container>

  const keepsStatus = existing && (existing.status === 'pending' || existing.status === 'published')
  const canSubmitReview = !existing || existing.status === 'draft' || existing.status === 'rejected'

  async function save(target: 'draft' | 'pending') {
    if (!user) return
    const status = keepsStatus ? (existing!.status as 'pending' | 'published') : target
    const next = { ...draft, photoCount: photos.length }
    const found = validateExperienceDraft(next, status === 'pending')
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
      const input: ExperienceInput = { ...next, lat: next.lat!, lon: next.lon!, cover, startTimes: [...next.startTimes].sort() }
      const savedId = await saveItem(db, 'experiences', user.uid, input, status, existing ? { id: existing.id, createdAt: existing.createdAt } : undefined)
      await replacePhotos(db, 'experiences', savedId, photos.map((p) => ({ dataUrl: p.dataUrl, alt: p.alt })))
      navigate('/anfitrion', { replace: true })
    } catch {
      setMessage(t('hf.saveError'))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const num = (id: string, label: string, key: 'durationMinutes' | 'pricePerPerson' | 'capacity' | 'minAge', step = 1, hint?: string) => (
    <FormField id={id} label={label} error={errors[key]} hint={hint}>
      {(c) => <input {...c} type="number" inputMode="numeric" min={0} step={step} value={Number.isFinite(draft[key]) ? draft[key] : ''} onChange={(e) => set(key, e.target.value === '' ? NaN : Number(e.target.value))} className={inputClassName} />}
    </FormField>
  )

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <div ref={topRef} />
      <PageHeader eyebrow={t('hb.eyebrow')} title={existing ? t('hf.editExp') : t('hf.newExp')}>
        {t('hf.expIntro')}
      </PageHeader>
      {message && <div className="mb-4"><Alert>{message}</Alert></div>}

      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
        <Section title={t('hf.general')}>
          <FormField id="title" label={t('hf.expName')} error={errors.title}>{(c) => <input {...c} value={draft.title} maxLength={100} onChange={(e) => set('title', e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="desc" label={t('hf.description')} error={errors.description}>{(c) => <textarea {...c} rows={5} maxLength={4000} value={draft.description} onChange={(e) => set('description', e.target.value)} className={inputClassName} />}</FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cat" label={t('hf.category')}>{(c) => <select {...c} value={draft.category} onChange={(e) => set('category', e.target.value as ExperienceCategory)} className={selectClassName}>{Object.entries(EXPERIENCE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</FormField>
            <FormField id="prov" label={t('hf.provider')} error={errors.providerName}>{(c) => <input {...c} value={draft.providerName} maxLength={100} onChange={(e) => set('providerName', e.target.value)} className={inputClassName} />}</FormField>
          </div>
        </Section>

        <Section title={t('xp.meetingPoint')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="dep" label={t('hf.department')} error={errors.department}>{(c) => <select {...c} value={draft.department} onChange={(e) => set('department', e.target.value)} className={selectClassName}><option value="">{t('xp.choose')}</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>}</FormField>
            <FormField id="mun" label={t('hd.municipalityShort')} error={errors.municipality}>{(c) => <input {...c} value={draft.municipality} onChange={(e) => set('municipality', e.target.value)} className={inputClassName} />}</FormField>
          </div>
          <FormField id="addr" label={t('hf.meetingRef')}>{(c) => <input {...c} value={draft.addressReference} maxLength={300} onChange={(e) => set('addressReference', e.target.value)} className={inputClassName} />}</FormField>
          <LocationPicker lat={draft.lat} lon={draft.lon} onChange={(la, lo) => setDraft((d) => ({ ...d, lat: la, lon: lo }))} error={errors.lat} searchHint={draft.municipality} />
        </Section>

        <Section title={t('hf.photos')}><PhotoUploader photos={photos} onChange={setPhotos} minRecommended={1} />{errors.photoCount && <Alert>{errors.photoCount}</Alert>}</Section>

        <Section title={t('hf.durationPrice')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {num('dur', t('hf.duration'), 'durationMinutes', 15)}
            {num('price', t('hf.pricePerPerson'), 'pricePerPerson', 1000)}
            {num('cap', t('hf.maxSpots'), 'capacity', 1, t('hf.maxSpotsHint'))}
            {num('age', t('hf.minAge'), 'minAge')}
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('xp.languages').replace(/:$/, '')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">{Object.entries(LANGS).map(([k, l]) => <label key={k} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm"><input type="checkbox" checked={draft.languages.includes(k)} onChange={() => set('languages', toggle(draft.languages, k))} className="accent-[var(--primary)]" /> {l}</label>)}</div>
          </fieldset>
        </Section>

        <Section title={t('hf.schedule')}>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('hf.days')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">{DAYS.map((d, i) => <label key={d} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold ${draft.weekdays.includes(i) ? 'border-teal bg-teal/15' : 'border-line'}`}><input type="checkbox" className="sr-only" checked={draft.weekdays.includes(i)} onChange={() => set('weekdays', toggle(draft.weekdays, i).sort())} />{d}</label>)}</div>
            {errors.weekdays && <p className="mt-1 text-sm font-medium text-danger">{errors.weekdays}</p>}
          </fieldset>
          <div>
            <p className="text-sm font-semibold text-ink">{t('hf.startTimes')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {draft.startTimes.map((tm) => <li key={tm} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">{tm}<button type="button" aria-label={t('iv.remove', { name: tm })} onClick={() => set('startTimes', draft.startTimes.filter((x) => x !== tm))} className="text-danger">✕</button></li>)}
            </ul>
            <div className="mt-2 flex gap-2"><input type="time" aria-label={t('hf.newTime')} value={newTime} onChange={(e) => setNewTime(e.target.value)} className={`${inputClassName} max-w-40`} /><Button variant="secondary" onClick={() => { if (newTime && !draft.startTimes.includes(newTime) && draft.startTimes.length < 8) { set('startTimes', [...draft.startTimes, newTime]); setNewTime('') } }}>{t('bc.add')}</Button></div>
            {errors.startTimes && <p className="mt-1 text-sm font-medium text-danger">{errors.startTimes}</p>}
          </div>
        </Section>

        <Section title={t('hf.reqPolicies')}>
          <FormField id="req" label={t('hf.requirements')}>{(c) => <textarea {...c} rows={3} maxLength={1500} value={draft.requirements} onChange={(e) => set('requirements', e.target.value)} className={inputClassName} />}</FormField>
          <FormField id="pol" label={t('hf.cancelPolicy')} hint={CANCELLATION_POLICIES[draft.cancellationPolicy].description}>{(c) => <select {...c} value={draft.cancellationPolicy} onChange={(e) => set('cancellationPolicy', e.target.value as ExperienceDraft['cancellationPolicy'])} className={selectClassName}>{Object.entries(CANCELLATION_POLICIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}</FormField>
        </Section>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" className="border border-line" onClick={() => navigate('/anfitrion')} disabled={saving}>{t('common.cancel')}</Button>
          {keepsStatus ? <Button onClick={() => save('draft')} disabled={saving}>{saving ? t('trips.detail.saving') : t('trips.detail.saveChanges')}</Button> : (
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
