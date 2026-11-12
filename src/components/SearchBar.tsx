import type { Ref } from 'react'

interface SearchBarProps {
  value: string
  /** Se llama en cada tecla: la página despliega el formulario en Modo A. */
  onChange: (value: string) => void
  /** Botón "Sugiéreme algo": la página despliega el formulario en Modo B. */
  onSuggest: () => void
  inputRef: Ref<HTMLInputElement>
  /** ID del panel que controla la barra (para aria-controls). */
  panelId: string
  expanded: boolean
  suggestActive: boolean
  error?: string
  disabled?: boolean
}

/**
 * Barra de búsqueda tipo página de viajes: campo de destino + botón
 * "Sugiéreme algo". En Modo A, este campo ES el destino del formulario.
 */
export function SearchBar({
  value,
  onChange,
  onSuggest,
  inputRef,
  panelId,
  expanded,
  suggestActive,
  error,
  disabled,
}: SearchBarProps) {
  return (
    <div>
      {/* En celular: campo arriba y botón abajo. Desde tablet: una sola barra. */}
      <div className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-2 shadow-lg shadow-navy/5 transition-shadow has-[input:focus]:border-teal has-[input:focus]:ring-2 has-[input:focus]:ring-teal/30 has-aria-invalid:border-danger sm:flex-row sm:items-center sm:rounded-full sm:p-1.5 sm:pl-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:px-0">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label htmlFor="destination" className="sr-only">
            ¿A dónde quieres ir?
          </label>
          <input
            ref={inputRef}
            id="destination"
            type="text"
            name="destination"
            autoComplete="off"
            placeholder="¿A dónde quieres ir?"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            // readOnly (no disabled) mientras se busca el destino: un campo
            // deshabilitado no se puede enfocar, y si el destino no existe
            // necesitamos devolverle el foco para mostrar el error.
            readOnly={disabled}
            aria-busy={disabled || undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'destination-error' : undefined}
            aria-controls={panelId}
            aria-expanded={expanded}
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder:text-muted focus:outline-none sm:text-lg"
          />
        </div>
        <button
          type="button"
          onClick={onSuggest}
          aria-controls={panelId}
          aria-expanded={suggestActive}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-coral px-6 py-3 text-base font-bold text-on-coral transition hover:brightness-105 active:brightness-95 sm:rounded-full"
        >
          <span aria-hidden="true">✨</span>
          Sugiéreme algo
        </button>
      </div>
      {error && (
        // Fondo claro propio: la barra está sobre la foto del hero.
        <p id="destination-error" className="mt-2 inline-flex rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-danger shadow-sm">
          {error}
        </p>
      )}
    </div>
  )
}
