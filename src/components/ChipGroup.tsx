/**
 * Grupo de "chips" seleccionables. Por dentro son inputs nativos (radio para
 * selección única, checkbox para múltiple) ocultos visualmente: así el teclado
 * (Tab, flechas, Espacio) y los lectores de pantalla funcionan sin código extra.
 */
export interface ChipOption<T extends string> {
  value: T
  label: string
  /** Emoji o símbolo decorativo (no lo leen los lectores de pantalla). */
  icon?: string
  /** Texto pequeño bajo la etiqueta, ej. "12 a 17 °C". */
  description?: string
}

interface ChipGroupProps<T extends string> {
  name: string
  legend: string
  type: 'radio' | 'checkbox'
  options: ChipOption<T>[]
  /** Valores seleccionados (en modo radio, como máximo uno). */
  value: T[]
  onChange: (value: T[]) => void
  error?: string
  disabled?: boolean
}

export function ChipGroup<T extends string>({ name, legend, type, options, value, onChange, error, disabled }: ChipGroupProps<T>) {
  const errorId = error ? `${name}-error` : undefined

  function toggle(option: T, checked: boolean) {
    if (type === 'radio') onChange([option])
    else onChange(checked ? [...value, option] : value.filter((v) => v !== option))
  }

  return (
    <fieldset aria-describedby={errorId} aria-invalid={Boolean(error)} disabled={disabled}>
      <legend className="text-sm font-semibold text-ink">
        {legend}
        {type === 'checkbox' && <span className="font-normal text-muted"> · puedes elegir varias</span>}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors select-none hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal/15 has-checked:font-semibold has-focus-visible:ring-2 has-focus-visible:ring-teal-soft has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type={type}
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={(e) => toggle(option.value, e.target.checked)}
              className="peer sr-only"
            />
            {option.icon && <span aria-hidden="true">{option.icon}</span>}
            <span className="flex flex-col leading-tight">
              {option.label}
              {option.description && <span className="text-xs font-normal text-muted">{option.description}</span>}
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="hidden size-4 text-teal-soft peer-checked:block" fill="currentColor">
              <path d="M7.6 13.6 4 10l-1.4 1.4 5 5 10-10L16.2 5z" />
            </svg>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
