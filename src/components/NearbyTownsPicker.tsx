/**
 * Paso 2 · "¿Quieres conocer pueblos cercanos?"
 *
 * Un interruptor (checkbox nativo) y, si se activa, la lista de pueblos
 * turísticos cercanos (nearbyTowns.ts) para elegir. Cada pueblo elegido es un
 * día de excursión en el itinerario, así que se pueden elegir como máximo
 * tantos como días tenga el viaje menos uno.
 */
import { Check, MapPinned } from 'lucide-react'
import { formatDuration } from '../lib/format'
import { useI18n } from '../lib/i18n/I18nProvider'
import { FALLBACK_MAX_KM, MAX_DRIVE_MINUTES } from '../lib/flow/nearbyTowns'
import type { Excursion } from '../types/itinerary'

interface NearbyTownsPickerProps {
  placeName: string
  tripDays: number
  towns: readonly Excursion[]
  /** Calculando los tiempos en carro. */
  loading: boolean
  /** true si los pueblos se filtraron por tiempo en carro (si no, por línea recta). */
  byRoad: boolean
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  selectedIds: readonly string[]
  onToggle: (id: string, checked: boolean) => void
  max: number
}

export function NearbyTownsPicker({
  placeName,
  tripDays,
  towns,
  loading,
  byRoad,
  enabled,
  onEnabledChange,
  selectedIds,
  onToggle,
  max,
}: NearbyTownsPickerProps) {
  const { t } = useI18n()
  const limit = byRoad ? t('town.limitDrive', { duration: formatDuration(MAX_DRIVE_MINUTES) }) : t('town.limitKm', { km: FALLBACK_MAX_KM })
  const unavailable =
    tripDays < 2
      ? t('town.minTwoDays')
      : !loading && towns.length === 0
        ? t('town.none', { limit, place: placeName })
        : null
  const full = selectedIds.length >= max

  return (
    <fieldset>
      <legend className="text-lg font-semibold text-ink">
        {t('town.title')} <span className="text-sm font-normal text-muted">{t('town.optional')}</span>
      </legend>

      <label
        className={`mt-3 flex items-start gap-3 rounded-2xl border border-line p-4 transition-colors has-checked:border-teal has-checked:bg-teal/10 has-focus-visible:ring-2 has-focus-visible:ring-teal-soft ${
          unavailable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-surface-2'
        }`}
      >
        <input
          type="checkbox"
          checked={enabled && !unavailable}
          disabled={Boolean(unavailable)}
          onChange={(e) => onEnabledChange(e.target.checked)}
          aria-describedby="towns-help"
          className="peer sr-only"
        />
        {/* Interruptor visual; el control real es el checkbox de arriba. */}
        <span
          aria-hidden="true"
          className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-teal after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
        <span>
          <span className="flex items-start gap-2 font-semibold text-ink">
            <MapPinned aria-hidden="true" className="mt-1 size-4 shrink-0 text-teal-soft" />
            {t('town.want', { place: placeName })}
          </span>
          <span id="towns-help" className="mt-0.5 block text-sm text-muted">
            {unavailable ??
              t('town.help', { limit })}
          </span>
        </span>
      </label>

      {enabled && !unavailable && loading && (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {t('town.calculating')}
        </p>
      )}
      {enabled && !unavailable && !loading && (
        <div className="mt-4">
          <p className="text-sm text-muted" aria-live="polite">
            {selectedIds.length === 0
              ? t('town.pickUpTo', { max, place: placeName })
              : t('town.picked', { selected: selectedIds.length, max })}
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {towns.map((town) => {
              const checked = selectedIds.includes(town.id)
              const disabled = !checked && full
              return (
                <li key={town.id}>
                  <label
                    className={`flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors has-checked:border-teal has-checked:bg-teal/10 has-focus-visible:ring-2 has-focus-visible:ring-teal-soft ${
                      disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-surface-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => onToggle(town.id, e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-line bg-surface text-transparent peer-checked:border-teal peer-checked:bg-teal peer-checked:text-white"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{town.name}</span>
                      <span className="block text-sm text-ink">{town.tagline}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {town.region} ·{' '}
                        {town.driveMinutes !== undefined
                          ? t('town.byCar', { duration: formatDuration(town.driveMinutes) })
                          : t('town.straight', { km: town.distanceKm })}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {byRoad
              ? t('town.noteRoad')
              : t('town.noteStraight')}
          </p>
        </div>
      )}
    </fieldset>
  )
}
