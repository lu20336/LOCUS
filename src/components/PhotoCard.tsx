import type { ReactNode } from 'react'

interface PhotoCardProps {
  image: string
  /** Encuadre de la foto (CSS object-position). */
  imagePosition?: string
  title: string
  subtitle?: string
  /** Contenido sobre la esquina superior de la foto (ej. chip de clima). */
  badge?: ReactNode
  /** Texto solo para lectores de pantalla antes del título, ej. "Planear un viaje a". */
  srPrefix?: string
  onClick: () => void
  /** Tamaño y ubicación en la cuadrícula (alto, col-span…). */
  className?: string
  titleClassName?: string
}

/**
 * Tarjeta con foto de fondo y texto sobre un degradado oscuro.
 * Hover: la foto hace un leve zoom y la tarjeta se eleva con sombra.
 */
export function PhotoCard({
  image,
  imagePosition,
  title,
  subtitle,
  badge,
  srPrefix,
  onClick,
  className = '',
  titleClassName = 'text-2xl',
}: PhotoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full overflow-hidden rounded-3xl bg-surface-2 text-left shadow-md shadow-navy/10 transition duration-300 ease-out hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-navy/25 focus-visible:-translate-y-1.5 focus-visible:ring-4 focus-visible:ring-teal-soft ${className}`}
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ objectPosition: imagePosition }}
        className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* Degradado para que el texto blanco se lea sobre cualquier foto. */}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {badge && <span className="absolute left-4 top-4">{badge}</span>}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
        {srPrefix && <span className="sr-only">{srPrefix} </span>}
        <span className={`font-serif font-semibold leading-tight text-white ${titleClassName}`}>{title}</span>
        {subtitle && <span className="text-sm text-white/90">{subtitle}</span>}
      </span>
    </button>
  )
}

/** Chip claro para poner sobre una foto (mismo estilo que los chips de la app). */
export function PhotoChip({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-surface/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}
