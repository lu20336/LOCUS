/**
 * Modo B del Paso 1: "Sugiéreme un destino".
 * El usuario elige clima + actividades, buscamos con suggestDestination() y
 * muestra las 3 mejores opciones como tarjetas seleccionables.
 *
 * Lo que debe sobrevivir al volver al Paso 1 (filtros, resultado, selección)
 * vive en `search`, controlado por el componente padre. El estado de la
 * búsqueda en curso (progreso, errores) es local.
 */
import { forwardRef, useEffect, useRef, useState } from 'react'
import { getT } from '../lib/i18n/store'
import { Shuffle } from 'lucide-react'
import { CATEGORIES } from '../lib/itinerary/categories'
import { describeItineraryError } from '../lib/itinerary/errors'
import { suggestionDeps } from '../lib/itinerary/browserClient'
import {
  CLIMATES,
  hasMoreSuggestions,
  moreSuggestions,
  suggestDestination,
  type SuggestionProgress,
} from '../lib/itinerary/suggestDestination'
import { formatThousands } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import type { SuggestionSearch } from '../types/flow'
import { ChipGroup } from './ChipGroup'
import { CATEGORY_OPTIONS, CLIMATE_OPTIONS } from './choiceOptions'

interface DestinationSuggesterProps {
  search: SuggestionSearch
  onChange: (search: SuggestionSearch) => void
  /** Error que viene del formulario (ej. "elige uno de los sugeridos"). */
  error?: string
}

/** El motor emite el progreso con texto en español; aquí se reconstruye según la fase y el idioma activo. */
function localizeProgress(p: SuggestionProgress, climateId: string | null | undefined): SuggestionProgress {
  const t = getT()
  if (p.phase === 'towns') return { ...p, message: t('sug.phase.towns') }
  if (p.phase === 'elevation') {
    const climate = climateId && climateId in CLIMATES ? CLIMATES[climateId as keyof typeof CLIMATES].label.toLowerCase() : ''
    return { ...p, message: t('sug.phase.elevation', { climate }) }
  }
  return { ...p, message: t('sug.phase.activities', { town: p.town, current: p.current, total: p.total }) }
}

export const DestinationSuggester = forwardRef<HTMLDivElement, DestinationSuggesterProps>(function DestinationSuggester(
  { search, onChange, error },
  ref,
) {
  const { t } = useI18n()
  const [progress, setProgress] = useState<SuggestionProgress | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [filterErrors, setFilterErrors] = useState<{ climate?: string; categories?: string }>({})
  const abortRef = useRef<AbortController | null>(null)
  const isSearching = progress !== null

  // Si el usuario sale de este modo o del paso, cancelamos la búsqueda en curso.
  useEffect(() => () => abortRef.current?.abort(), [])

  function cancelSearch() {
    abortRef.current?.abort()
    abortRef.current = null
    setProgress(null)
  }

  // Cambiar filtros invalida el resultado anterior.
  function updateFilters(patch: Partial<Pick<SuggestionSearch, 'climate' | 'categories'>>) {
    cancelSearch()
    setSearchError(null)
    setFilterErrors({})
    onChange({ ...search, ...patch, result: null, selectedId: null })
  }

  async function runSearch() {
    const errors = {
      climate: search.climate ? undefined : t('sug.needClimate'),
      categories: search.categories.length ? undefined : t('sug.needCategory'),
    }
    setFilterErrors(errors)
    if (!search.climate || errors.categories) return

    cancelSearch()
    const controller = new AbortController()
    abortRef.current = controller
    setSearchError(null)
    setProgress({ phase: 'towns', message: t('sug.phase.towns') })

    try {
      const result = await suggestDestination(search.climate, search.categories, suggestionDeps, {
        signal: controller.signal,
        onProgress: (p) => {
          if (!controller.signal.aborted) setProgress(localizeProgress(p, search.climate))
        },
      })
      if (controller.signal.aborted) return
      onChange({ ...search, result, selectedId: null })
    } catch (err) {
      if (controller.signal.aborted) return // cancelada: no es un error
      setSearchError(describeItineraryError(err, 'sug.unexpected'))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setProgress(null)
      }
    }
  }

  const resultsRef = useRef<HTMLFieldSetElement>(null)

  // "Sugiéreme otros destinos": los siguientes del ranking, al instante (sin volver a buscar).
  function showOthers() {
    if (!search.result) return
    onChange({ ...search, result: moreSuggestions(search.result), selectedId: null })
    // Las tarjetas nuevas quedan arriba del botón: llevamos la vista al inicio de la lista.
    requestAnimationFrame(() => {
      const el = resultsRef.current
      if (!el) return
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const result = search.result
  // Avance aproximado por fase (la búsqueda completa dura unos segundos).
  const percent = { towns: 15, elevation: 35, activities: 70 }[progress?.phase ?? 'towns'] ?? 0

  return (
    <div ref={ref} tabIndex={-1} className="flex flex-col gap-6 focus:outline-none">
      <ChipGroup
        name="climate"
        legend={t('sug.pickClimate')}
        type="radio"
        options={CLIMATE_OPTIONS}
        value={search.climate ? [search.climate] : []}
        onChange={([climate]) => updateFilters({ climate })}
        error={filterErrors.climate}
      />
      <ChipGroup
        name="suggestCategories"
        legend={t('sug.whatToDo')}
        type="checkbox"
        options={CATEGORY_OPTIONS}
        value={search.categories}
        onChange={(categories) => updateFilters({ categories })}
        error={filterErrors.categories}
      />

      {/* Con resultados, "Buscar de nuevo" daría lo mismo: solo sirve para reintentar si no se confirmaron actividades. */}
      {!isSearching && (!result || result.activitiesUnverified) && (
        <button
          type="button"
          onClick={runSearch}
          className="self-start rounded-xl border-2 border-teal px-5 py-2.5 font-semibold text-ink transition-colors hover:bg-teal/10"
        >
          {result ? t('sug.searchAgain') : t('sug.search')}
        </button>
      )}

      {/* Progreso: la búsqueda tarda como máximo unos segundos (ver osmClient.ts). */}
      {isSearching && (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p role="status" aria-live="polite" className="text-sm font-medium text-ink">
            {t('sug.searching')}
          </p>
          <p className="mt-0.5 text-xs text-muted">{progress.message}</p>
          <div
            role="progressbar"
            aria-label={t('sug.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full animate-pulse rounded-full bg-teal transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={cancelSearch} className="text-sm font-semibold text-ink underline underline-offset-2">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {searchError && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {searchError}
        </div>
      )}

      {result && !isSearching && (
        <fieldset ref={resultsRef} aria-describedby={error ? 'suggestion-error' : undefined} className="scroll-mt-24">
          <legend className="text-sm font-semibold text-ink">
            {t('sug.resultsLegend', { climate: CLIMATES[result.climate].label.toLowerCase() })}
          </legend>

          {result.activitiesUnverified ? (
            <p role="status" className="mt-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
              {t('sug.unverified')}
            </p>
          ) : (
            result.climateOnly && (
              <p role="status" className="mt-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
                {t('sug.climateOnly')}
              </p>
            )
          )}

          {result.restarted && (
            <p role="status" className="mt-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
              {t('sug.restarted')}
            </p>
          )}

          <div className="mt-3 grid gap-3">
            {result.suggestions.map((suggestion) => {
              const { candidate } = suggestion
              return (
                <label
                  key={candidate.id}
                  className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal/10 has-focus-visible:ring-2 has-focus-visible:ring-teal-soft"
                >
                  <input
                    type="radio"
                    name="suggestion"
                    value={candidate.id}
                    checked={search.selectedId === candidate.id}
                    onChange={() => onChange({ ...search, selectedId: candidate.id })}
                    className="mt-1.5 size-4 accent-[var(--primary)]"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-serif text-xl font-semibold text-navy">{candidate.name}</span>
                    <span className="text-sm text-muted">
                      {t('sug.elevation', { meters: formatThousands(Math.round(suggestion.elevation)), climate: CLIMATES[suggestion.climate].label.toLowerCase() })}
                    </span>
                    {suggestion.activitiesChecked ? (
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {result.categories.map((category) => {
                          const found = suggestion.matchedCategories.includes(category)
                          return (
                            <span key={category} className={found ? 'font-semibold text-ink' : 'text-muted line-through'}>
                              {CATEGORIES[category].label} <span aria-hidden="true">{found ? '✓' : '✗'}</span>
                              <span className="sr-only">{found ? t('sug.nearYes') : t('sug.nearNo')}</span>
                            </span>
                          )
                        })}
                      </span>
                    ) : (
                      <span className="mt-1 text-sm text-muted">{t('sug.notConfirmed')}</span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>

          {hasMoreSuggestions(result) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={showOthers}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-teal px-5 py-2.5 font-semibold text-ink transition-colors hover:bg-teal/10"
              >
                <Shuffle aria-hidden="true" className="size-4" />
                {t('sug.others')}
              </button>
            </div>
          )}
        </fieldset>
      )}

      {error && (
        <p id="suggestion-error" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
})
