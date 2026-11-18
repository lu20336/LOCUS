/**
 * Avisos breves ("Guardado en Mis viajes", "Plan cambiado"): confirmación
 * visual sin interrumpir. Región aria-live para lectores de pantalla.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

export interface ToastOptions {
  tone?: 'success' | 'info' | 'error'
  /** Enlace de acción, ej. "Ver en Mis viajes". */
  action?: { label: string; to: string }
}

interface ToastItem extends ToastOptions {
  id: number
  message: string
}

const ToastContext = createContext<((message: string, options?: ToastOptions) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++counter.current
    setItems((prev) => [...prev.slice(-2), { id, message, ...options }])
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), options.action ? 6500 : 4000)
  }, [])

  const value = useMemo(() => show, [show])
  const tones = { success: 'border-teal/50', info: 'border-line', error: 'border-danger/60' } as const

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-xl ${tones[t.tone ?? 'success']}`}
          >
            {(t.tone ?? 'success') === 'success' && (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="anim-check size-5 shrink-0 text-teal-soft" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{t.message}</span>
            {t.action && (
              <Link to={t.action.to} className="shrink-0 font-bold text-teal-soft underline underline-offset-2">
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Muestra un aviso. Fuera del proveedor no hace nada (pruebas y Storybooks). */
export function useToast(): (message: string, options?: ToastOptions) => void {
  return useContext(ToastContext) ?? (() => {})
}
