/**
 * Experiencias y actividades: 1) experiencias reservables publicadas por
 * anfitriones de LOCUS; 2) para un destino, lugares y actividades de
 * referencia tomados de OpenStreetMap (no reservables).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router'
import { ExperienceCard } from '../components/ListingCard'
import { Alert, Badge, ButtonLink, CardGridSkeleton, Container, EmptyState, PageHeader, selectClassName } from '../components/ui'
import { inputClassName } from '../components/FormField'
import { fetchPublished } from '../lib/catalog/repo'
import { filterExperiences } from '../lib/catalog/search'
import { EXPERIENCE_CATEGORIES, type Experience, type ExperienceCategory } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { useDestinationOptions } from '../lib/flow/destinationOptions'
import { formatCOP } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import { LocusMap, type MapMarker } from '../lib/maps/MapLazy'
import { useAsync } from '../lib/useAsync'

export default function ExperiencesPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')
  const [categories, setCategories] = useState<ExperienceCategory[]>([])
  const [maxPrice, setMaxPrice] = useState('')
  const all = useAsync(() => fetchPublished<Experience>(db, 'experiences'), [])
  const options = useDestinationOptions(text)

  useEffect(() => {
    setParams(text ? { q: text } : {}, { replace: true })
  }, [text, setParams])

  const results = useMemo(
    () => filterExperiences(all.data ?? [], { text, categories, maxPrice: maxPrice ? Number(maxPrice) : null }),
    [all.data, text, categories, maxPrice],
  )
  const markers: MapMarker[] = results.map((e) => ({ id: e.id, lat: e.lat, lon: e.lon, label: formatCOP(e.pricePerPerson), kind: 'experience' }))
  const toggle = (c: ExperienceCategory) => setCategories((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader eyebrow={t('nav.experiences')} title={t('xs.title')}>{t('xs.intro')}</PageHeader>

      <div className="mb-5 grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm md:grid-cols-[1.5fr_1fr]" role="search">
        <div>
          <label htmlFor="eq" className="text-sm font-semibold text-ink">{t('ex.destination')}</label>
          <input id="eq" list="exp-options" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ex.destinationPlaceholder')} className={`${inputClassName} mt-1`} />
          <datalist id="exp-options">{options.map((o) => <option key={o.id} value={o.name}>{o.detail}</option>)}</datalist>
        </div>
        <div>
          <label htmlFor="emax" className="text-sm font-semibold text-ink">{t('xs.maxPerPerson')}</label>
          <select id="emax" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`${selectClassName} mt-1`}>
            <option value="">{t('ex.noLimit')}</option>
            {[50000, 100000, 200000, 400000].map((p) => <option key={p} value={p}>{formatCOP(p)}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('xs.categories')}>
        {(Object.keys(EXPERIENCE_CATEGORIES) as ExperienceCategory[]).map((c) => (
          <button key={c} type="button" aria-pressed={categories.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${categories.includes(c) ? 'border-teal bg-teal/15' : 'border-line bg-surface hover:bg-surface-2'}`}>
            {EXPERIENCE_CATEGORIES[c]}
          </button>
        ))}
      </div>

      {all.loading ? <CardGridSkeleton count={4} label={t('xs.loading')} /> : all.error ? <Alert>{all.error}</Alert> : results.length === 0 ? (
        <EmptyState title={(all.data?.length ?? 0) === 0 ? t('xs.emptyNone') : t('xs.emptyFiltered')} action={<ButtonLink to="/anfitrion" variant="secondary">{t('xs.publishOne')}</ButtonLink>}>
          {(all.data?.length ?? 0) === 0 ? t('xs.emptyNoneText') : t('xs.emptyFilteredText')}
          <p className="mt-3"><ButtonLink to="/" variant="ghost" className="border border-line">{t('xs.buildItinerary')}</ButtonLink></p>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_28rem]">
          <ul className="anim-stagger grid gap-5 sm:grid-cols-2">{results.map((e, i) => <li key={e.id} style={{ '--i': Math.min(i, 8) } as CSSProperties}><ExperienceCard experience={e} /></li>)}</ul>
          <div className="lg:sticky lg:top-24 lg:self-start"><LocusMap markers={markers} className="h-96 lg:h-[34rem]" ariaLabel={t('xs.mapLabel')} /></div>
        </div>
      )}
      <p className="mt-6"><Badge>{t('xs.source')}</Badge> <span className="text-sm text-muted">{t('xs.sourceText')}</span></p>
    </Container>
  )
}
