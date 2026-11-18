/**
 * Piezas visuales compartidas. Siguen el lenguaje de LOCUS: tarjetas
 * redondeadas con borde `line`, titulares serif en navy, teal como color de
 * marca y coral SOLO para la llamada a la acción principal de cada pantalla.
 */
import type { LucideIcon } from 'lucide-react'
import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
const variants: Record<Variant, string> = {
  primary: 'bg-coral text-on-coral shadow-sm hover:brightness-105 active:brightness-95 font-bold',
  secondary: 'border-2 border-teal text-ink hover:bg-teal/10',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'border border-danger/50 text-danger hover:bg-danger/10',
}

export const buttonClass = (variant: Variant = 'primary', extra = '') => `${base} ${variants[variant]} ${extra}`

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />
}

/** Dentro del área de cuenta (con barra lateral) los contenedores no se centran ni agregan margen lateral. */
export const EmbeddedContext = createContext(false)

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  const embedded = useContext(EmbeddedContext)
  if (embedded) return <div className={`w-full ${className.replace(/max-w-\S+/g, '')}`}>{children}</div>
  return <div className={`mx-auto w-full max-w-6xl px-4 ${className}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{eyebrow}</p>}
      <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        {title}
      </h1>
      {children && <div className="mt-2 max-w-2xl text-muted sm:text-lg">{children}</div>}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'warn' | 'danger' }) {
  const tones = {
    neutral: 'border-line bg-surface-2 text-ink',
    teal: 'border-teal/40 bg-teal/15 text-ink',
    warn: 'border-amber-500/50 bg-amber-500/15 text-ink',
    danger: 'border-danger/40 bg-danger/10 text-danger',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-muted">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 animate-spin" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label}
    </div>
  )
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const tones = {
    error: 'border-danger/40 bg-danger/10 text-danger',
    info: 'border-line bg-surface-2 text-ink',
    success: 'border-teal/40 bg-teal/10 text-ink',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone]}`}>
      {children}
    </div>
  )
}

export function EmptyState({ title, children, action, icon: Icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="anim-rise rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-teal/15 text-teal-soft">
          <Icon className="size-7" />
        </span>
      )}
      <h2 className="text-xl font-semibold text-navy">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-xl text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Marcador de carga con brillo (mejor que un giro cuando se conoce la forma del contenido). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

/** Rejilla de tarjetas "fantasma" mientras cargan los datos. */
export function CardGridSkeleton({ count = 3, label = 'Cargando…' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-line bg-surface">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export const selectClassName =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30'
