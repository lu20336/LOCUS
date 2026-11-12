import { useEffect, useId, useState, type ReactNode } from 'react'

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
  /**
   * Lugares para visitar: al pasar el mouse (o enfocar con teclado) sube un
   * panel "Qué visitar" y los lugares se deslizan uno tras otro sobre la foto.
   */
  places?: string[]
  onClick: () => void
  /** Tamaño y ubicación en la cuadrícula (alto, col-span…). */
  className?: string
  titleClassName?: string
}

/** Tiempo que se muestra cada lugar antes de pasar al siguiente. */
const PLACE_INTERVAL_MS = 1800

const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches

/**
 * Tarjeta con foto de fondo y texto sobre un degradado oscuro.
 * Hover: la foto hace un leve zoom, la tarjeta se eleva con sombra y, si
 * tiene `places`, aparecen los lugares para visitar.
 */
export function PhotoCard({
  image,
  imagePosition,
  title,
  subtitle,
  badge,
  srPrefix,
  places,
  onClick,
  className = '',
  titleClassName = 'text-2xl',
}: PhotoCardProps) {
  const placesId = useId()
  const hasPlaces = Boolean(places?.length)
  // En pantallas táctiles no hay "pasar el mouse": el panel queda siempre visible.
  const [touchOnly] = useState(() => matches('(hover: none)'))
  const [hovered, setHovered] = useState(false)
  const showPlaces = hasPlaces && (hovered || touchOnly)

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-describedby={hasPlaces ? placesId : undefined}
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
        {/* Con los lugares visibles, la foto se oscurece un poco más para que se lean bien. */}
        {hasPlaces && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 transition-opacity duration-300 ${showPlaces ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {badge && <span className="absolute left-4 top-4">{badge}</span>}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
          {srPrefix && <span className="sr-only">{srPrefix} </span>}
          <span className={`font-serif font-semibold leading-tight text-white ${titleClassName}`}>{title}</span>
          {subtitle && <span className="text-sm text-white/90">{subtitle}</span>}
          {hasPlaces && (
            // Despliegue suave: la fila del grid pasa de 0fr a 1fr (altura automática).
            <span
              aria-hidden="true"
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${showPlaces ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <span className="min-h-0 overflow-hidden">
                <PlacesTicker places={places!} running={showPlaces} />
              </span>
            </span>
          )}
        </span>
      </button>
      {/* Para lectores de pantalla: la lista completa, una sola vez (el carrusel es visual). */}
      {hasPlaces && (
        <span id={placesId} hidden>
          Lugares para visitar: {places!.join(', ')}.
        </span>
      )}
    </>
  )
}

/** Muestra un lugar a la vez; cada uno entra deslizándose desde la derecha. */
function PlacesTicker({ places, running }: { places: string[]; running: boolean }) {
  const [index, setIndex] = useState(0)
  const [reducedMotion] = useState(() => matches('(prefers-reduced-motion: reduce)'))

  useEffect(() => {
    if (!running || reducedMotion) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % places.length), PLACE_INTERVAL_MS)
    // Al salir de la tarjeta, la próxima vez empieza desde el primer lugar.
    return () => {
      clearInterval(timer)
      setIndex(0)
    }
  }, [running, reducedMotion, places.length])

  return (
    <span className="mt-3 flex flex-col gap-2 border-t border-white/25 pt-3">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-light">Qué visitar</span>
      {reducedMotion ? (
        // Sin animaciones: todos los lugares a la vista.
        <span className="text-sm leading-relaxed text-white">{places.join(' · ')}</span>
      ) : (
        <>
          <span className="flex h-7 items-center overflow-hidden">
            <span
              key={index}
              className="flex items-center gap-2 truncate text-base font-semibold text-white animate-[place-in_450ms_ease-out]"
            >
              <PinIcon />
              <span className="truncate">{places[index]}</span>
            </span>
          </span>
          <span className="flex gap-1.5">
            {places.map((place, i) => (
              <span
                key={place}
                className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`}
              />
            ))}
          </span>
        </>
      )}
    </span>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-teal-light" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
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
