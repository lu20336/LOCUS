import type { ReactNode } from 'react'

/** Atributos de accesibilidad que FormField le pasa al control (input). */
export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FormFieldProps {
  id: string
  label: string
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode
  /** Mensaje de error; si existe, el campo se marca como inválido. */
  error?: string
  children: (control: FieldControlProps) => ReactNode
}

/**
 * Envoltura de un campo: etiqueta + control + ayuda + error. Conecta el error
 * y la ayuda con el input vía aria-describedby, para que los lectores de
 * pantalla los lean al enfocar el campo.
 */
export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-.9 4h1.8v5H9.1V6zm0 6.5h1.8v1.8H9.1v-1.8z" />
          </svg>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Estilo común de los inputs; el borde cambia a color de error si es inválido. */
export const inputClassName =
  'w-full rounded-xl border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted ' +
  'border-line transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30 ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger/25 disabled:opacity-60'
