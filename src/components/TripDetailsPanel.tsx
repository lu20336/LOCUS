/**
 * Panel del Paso 1 que se despliega bajo la barra de búsqueda.
 * Modo A: fechas + presupuesto (el destino está en la barra).
 * Modo B: clima + actividades → sugerencias, y luego fechas + presupuesto.
 */
import { BedDouble, Users } from 'lucide-react'
import { MAX_TRAVELERS, type TripDetailsForm } from '../lib/flow/useTripDetailsForm'
import { formatThousands, parseBudget } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import { Counter } from './Counter'
import { DestinationSuggester } from './DestinationSuggester'
import { FormField, inputClassName } from './FormField'

interface TripDetailsPanelProps {
  form: TripDetailsForm
  onClose: () => void
  /** Cambiar a Modo A: la página lleva el foco a la barra de búsqueda. */
  onUseSearchBar: () => void
  /** Cambiar a Modo B. */
  onSuggest: () => void
  /** Cambia cuando una tarjeta de actividad reinicia la búsqueda del Modo B. */
  suggesterKey?: number
}

export function TripDetailsPanel({ form, onClose, onUseSearchBar, onSuggest, suggesterKey }: TripDetailsPanelProps) {
  const { t } = useI18n()
  const { mode, draft, update, errors, registerField, isGeocoding, today } = form

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{t('flow.step1')}</p>
          <h2 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">
            {mode === 'suggested' ? t('flow.suggestTitle') : t('flow.tellTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'suggested' ? (
              <>
                {t('flow.pickClimateAndLikes')}{' '}
                <button type="button" onClick={onUseSearchBar} className="font-semibold text-ink underline underline-offset-2">
                  {t('flow.alreadyKnow')}
                </button>
              </>
            ) : (
              <>
                {draft.destination.trim() ? (
                  <>
                    {t('flow.destinationLabel')} <strong className="text-ink">{draft.destination.trim()}</strong>.{' '}
                  </>
                ) : (
                  t('flow.writeDestination')
                )}
                <button type="button" onClick={onSuggest} className="font-semibold text-ink underline underline-offset-2">
                  {t('flow.dontKnow')}
                </button>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('flow.closeForm')}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {mode === 'suggested' && (
          <DestinationSuggester
            key={suggesterKey}
            ref={registerField('destinationSuggester')}
            search={form.search}
            onChange={form.setSearch}
            error={errors.destination}
          />
        )}

        <fieldset className="grid min-w-0 gap-6 sm:grid-cols-2">
          <legend className="sr-only">{t('flow.tripDates')}</legend>
          <FormField id="startDate" label={t('flow.startDate')} error={errors.startDate}>
            {(control) => (
              <input
                {...control}
                ref={registerField('startDate')}
                type="date"
                name="startDate"
                min={today}
                value={draft.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                disabled={isGeocoding}
                className={inputClassName}
              />
            )}
          </FormField>
          <FormField id="endDate" label={t('flow.endDate')} error={errors.endDate}>
            {(control) => (
              <input
                {...control}
                ref={registerField('endDate')}
                type="date"
                name="endDate"
                min={draft.startDate || today}
                value={draft.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                disabled={isGeocoding}
                className={inputClassName}
              />
            )}
          </FormField>
        </fieldset>

        <fieldset className="grid gap-6 sm:grid-cols-2">
          <legend className="sr-only">{t('flow.travelersRooms')}</legend>
          <Counter
            label={t('flow.travelers')}
            icon={Users}
            unit={t('flow.oneTraveler')}
            value={form.travelers}
            min={1}
            max={MAX_TRAVELERS}
            onChange={form.setTravelers}
            disabled={isGeocoding}
          />
          <Counter
            label={t('flow.rooms')}
            icon={BedDouble}
            unit={t('flow.oneRoom')}
            value={form.rooms}
            min={1}
            max={form.travelers}
            onChange={form.setRooms}
            hint={form.rooms === form.travelers && form.travelers > 1 ? t('flow.roomPerTraveler') : undefined}
            disabled={isGeocoding}
          />
        </fieldset>

        <FormField id="budget" label={t('flow.budget')} error={errors.budget} hint={form.budgetHint}>
          {(control) => (
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted" aria-hidden="true">
                $
              </span>
              <input
                {...control}
                ref={registerField('budget')}
                type="text"
                inputMode="numeric"
                name="budget"
                autoComplete="off"
                placeholder="2.500.000"
                value={draft.budget}
                onChange={(e) => {
                  // Mostramos el número con puntos de miles mientras se escribe.
                  const value = parseBudget(e.target.value)
                  update('budget', value === null ? '' : formatThousands(value))
                }}
                disabled={isGeocoding}
                className={`${inputClassName} pl-8 pr-16`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">
                COP
              </span>
            </div>
          )}
        </FormField>

        {form.serviceError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {form.serviceError}
          </div>
        )}

        <button
          type="submit"
          disabled={isGeocoding}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-coral px-6 py-4 text-lg font-bold text-on-coral shadow-sm transition hover:brightness-105 active:brightness-95 disabled:cursor-wait disabled:opacity-80 sm:w-auto sm:self-end"
        >
          {isGeocoding ? (
            <>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 animate-spin" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {t('flow.searchingDestination')}
            </>
          ) : (
            <>
              {t('common.continue')}
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
        {/* Anuncia el estado de carga a lectores de pantalla. */}
        <p className="sr-only" aria-live="polite">
          {isGeocoding ? t('flow.searchingDestinationMap') : ''}
        </p>
      </div>
    </div>
  )
}
