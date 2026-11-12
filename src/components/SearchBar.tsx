import { useState, type KeyboardEvent, type Ref } from 'react'
import type { DestinationOption } from '../lib/flow/destinationOptions'

interface SearchBarProps {
  value: string
  /** Se llama en cada tecla: la página despliega el formulario en Modo A. */
  onChange: (value: string) => void
  /** Lugares que coinciden con lo escrito (ver destinationOptions.ts). */
  options: DestinationOption[]
  /** El usuario eligió una sugerencia (clic o Enter). */
  onSelectOption: (option: DestinationOption) => void
  /** Botón "Sugiéreme un lugar": la página despliega el formulario en Modo B. */
  onSuggest: () => void
  inputRef: Ref<HTMLInputElement>
  /** ID del panel que abre el botón "Sugiéreme un lugar" (para aria-controls). */
  panelId: string
  suggestActive: boolean
  error?: string
  disabled?: boolean
}

const LISTBOX_ID = 'destination-options'
const optionId = (index: number) => `destination-option-${index}`

/**
 * Barra de búsqueda tipo página de viajes: campo de destino con sugerencias
 * mientras se escribe + botón "Sugiéreme un lugar". En Modo A, este campo ES
 * el destino del formulario.
 *
 * Las sugerencias siguen el patrón "combobox" de WAI-ARIA: flechas para
 * moverse, Enter para elegir, Escape para cerrar; el lector de pantalla
 * anuncia la opción activa (aria-activedescendant) sin mover el foco.
 */
export function SearchBar({
  value,
  onChange,
  options,
  onSelectOption,
  onSuggest,
  inputRef,
  panelId,
  suggestActive,
  error,
  disabled,
}: SearchBarProps) {
  // La lista se abre al escribir y se cierra al elegir, con Escape o al salir del campo.
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listVisible = open && !disabled && options.length > 0
  const active = listVisible && activeIndex < options.length ? activeIndex : -1

  function close() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function select(option: DestinationOption) {
    close()
    onSelectOption(option)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || options.length === 0) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        setActiveIndex(listVisible ? (active + 1) % options.length : 0)
        break
      case 'ArrowUp':
        event.preventDefault()
        setOpen(true)
        setActiveIndex(active <= 0 ? options.length - 1 : active - 1)
        break
      case 'Enter':
        // Con una opción marcada, Enter la elige; si no, envía el formulario.
        if (active >= 0) {
          event.preventDefault()
          select(options[active])
        }
        break
      case 'Escape':
        if (listVisible) {
          event.preventDefault()
          event.stopPropagation()
          close()
        }
        break
    }
  }

  return (
    <div className="relative">
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
            onChange={(e) => {
              onChange(e.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onKeyDown={handleKeyDown}
            onBlur={close}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listVisible}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            // readOnly (no disabled) mientras se busca el destino: un campo
            // deshabilitado no se puede enfocar, y si el destino no existe
            // necesitamos devolverle el foco para mostrar el error.
            readOnly={disabled}
            aria-busy={disabled || undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'destination-error' : undefined}
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder:text-muted focus:outline-none sm:text-lg"
          />
        </div>
        <button
          type="button"
          onClick={onSuggest}
          aria-controls={panelId}
          aria-expanded={suggestActive}
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-coral px-6 py-3 text-base font-bold text-on-coral transition hover:brightness-105 active:brightness-95 sm:rounded-full"
        >
          Sugiéreme un lugar
        </button>
      </div>

      {/* El listbox existe siempre (aria-controls apunta a él); se ve solo con opciones. */}
      <ul
        id={LISTBOX_ID}
        role="listbox"
        aria-label="Destinos sugeridos"
        hidden={!listVisible}
        className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-left shadow-xl shadow-navy/10"
      >
        {listVisible &&
          options.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // mousedown + preventDefault: el campo no pierde el foco antes del clic.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(option)}
              onMouseMove={() => index !== active && setActiveIndex(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                index === active ? 'bg-surface-2' : ''
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 text-teal-soft" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-ink">{option.name}</span>
                <span className="truncate text-sm text-muted">{option.detail}</span>
              </span>
            </li>
          ))}
      </ul>

      {/* Anuncio para lectores de pantalla: cuántas sugerencias hay. */}
      <p className="sr-only" aria-live="polite">
        {listVisible
          ? `${options.length} ${options.length === 1 ? 'sugerencia' : 'sugerencias'}. Usa las flechas para elegir.`
          : ''}
      </p>

      {error && (
        // Fondo claro propio: la barra está sobre la foto del hero.
        <p id="destination-error" className="mt-2 inline-flex rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-danger shadow-sm">
          {error}
        </p>
      )}
    </div>
  )
}
