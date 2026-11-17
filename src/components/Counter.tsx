import type { LucideIcon } from 'lucide-react'
import { useId } from 'react'

interface CounterProps {
  label: string
  /** Icono decorativo de Lucide antes de la etiqueta. */
  icon: LucideIcon
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  /** Sustantivo con artículo para los botones: "una habitación" → "Quitar una habitación". */
  unit: string
  hint?: string
  disabled?: boolean
}

/** Contador con botones − / +. El valor se anuncia a lectores de pantalla al cambiar. */
export function Counter({ label, icon: Icon, value, min, max, onChange, unit, hint, disabled }: CounterProps) {
  const id = useId()
  const buttonClass =
    'grid size-11 place-items-center rounded-full border border-line text-xl font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-teal-soft" />
        {label}
      </span>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={disabled || value <= min}
          aria-label={`Quitar ${unit}`}
          className={buttonClass}
        >
          <span aria-hidden="true">−</span>
        </button>
        <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold text-ink">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={disabled || value >= max}
          aria-label={`Agregar ${unit}`}
          className={buttonClass}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
