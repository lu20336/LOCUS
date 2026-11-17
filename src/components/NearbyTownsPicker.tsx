/**
 * Paso 2 · "¿Quieres conocer pueblos cercanos?"
 *
 * Un interruptor (checkbox nativo) y, si se activa, la lista de pueblos
 * turísticos cercanos (nearbyTowns.ts) para elegir. Cada pueblo elegido es un
 * día de excursión en el itinerario, así que se pueden elegir como máximo
 * tantos como días tenga el viaje menos uno.
 */
import { Check, MapPinned } from 'lucide-react'
import type { Excursion } from '../types/itinerary'

interface NearbyTownsPickerProps {
  placeName: string
  tripDays: number
  towns: readonly Excursion[]
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
  enabled,
  onEnabledChange,
  selectedIds,
  onToggle,
  max,
}: NearbyTownsPickerProps) {
  const unavailable = tripDays < 2 ? 'Necesitas un viaje de al menos 2 días.' : towns.length === 0 ? `Aún no tenemos pueblos turísticos registrados cerca de ${placeName}.` : null
  const full = selectedIds.length >= max

  return (
    <fieldset>
      <legend className="text-lg font-semibold text-ink">
        Pueblos cercanos <span className="text-sm font-normal text-muted">· opcional</span>
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
            Quiero conocer pueblos cerca de {placeName}
          </span>
          <span id="towns-help" className="mt-0.5 block text-sm text-muted">
            {unavailable ?? 'Cada pueblo que elijas será un día de excursión en tu itinerario, con sus propios lugares.'}
          </span>
        </span>
      </label>

      {enabled && !unavailable && (
        <div className="mt-4">
          <p className="text-sm text-muted" aria-live="polite">
            {selectedIds.length === 0
              ? `Elige hasta ${max} ${max === 1 ? 'pueblo' : 'pueblos'} (uno por día; al menos un día se queda en ${placeName}).`
              : `${selectedIds.length} de ${max} ${max === 1 ? 'pueblo elegido' : 'pueblos posibles'}.`}
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
                        {town.region} · a {town.distanceKm} km en línea recta
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Por carretera la distancia puede ser bastante mayor, sobre todo en la montaña. Revisa el tiempo de viaje antes
            de ir.
          </p>
        </div>
      )}
    </fieldset>
  )
}
