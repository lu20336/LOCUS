import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import type { PlaceToVisit } from '../lib/featuredDestinations'

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
   * Lugares para visitar: al pasar el mouse (o enfocar con teclado) la foto
   * de la tarjeta va cambiando por la de cada lugar y su nombre aparece en el
   * panel "Qué visitar".
   */
  places?: PlaceToVisit[]
  onClick: () => void
  /** Tamaño y ubicación en la cuadrícula (alto, col-span…). */
  className?: string
  titleClassName?: string
}

/** Tiempo que se muestra cada lugar antes de pasar al siguiente. */
const PLACE_INTERVAL_MS = 2200

const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches

/**
 * En pantallas táctiles no hay "pasar el mouse": los lugares se muestran
 * mientras la tarjeta está a la vista (así no se descargan todas las fotos
 * de golpe ni se animan tarjetas que nadie ve).
 */
function useInView(element: HTMLElement | null, enabled: boolean) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.6 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, enabled])
  return inView
}

/**
 * Tarjeta con foto de fondo y texto sobre un degradado oscuro.
 * Hover: la foto hace un leve zoom, la tarjeta se eleva con sombra y, si
 * tiene `places`, las fotos y nombres de los lugares se van turnando.
 */
export function PhotoCard({
  image,
  imagePosition,
  title,
  subtitle,
  badge,
  srPrefix,
  places = [],
  onClick,
  className = '',
  titleClassName = 'text-2xl',
}: PhotoCardProps) {
  const placesId = useId()
  const hasPlaces = places.length > 0
  const [button, setButton] = useState<HTMLButtonElement | null>(null)
  const [touchOnly] = useState(() => matches('(hover: none)'))
  const [hovered, setHovered] = useState(false)
  const inView = useInView(button, hasPlaces && touchOnly)
  const showPlaces = hasPlaces && (hovered || inView)

  // Las fotos de los lugares se piden recién la primera vez que se muestran.
  const [photosRequested, setPhotosRequested] = useState(false)
  if (showPlaces && !photosRequested) setPhotosRequested(true)

  // Lugar actual: avanza solo mientras se muestran; al salir vuelve al primero.
  const [index, setIndex] = useState(0)
  const placesCount = places.length
  useEffect(() => {
    if (!showPlaces) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % placesCount), PLACE_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      setIndex(0)
    }
  }, [showPlaces, placesCount])

  return (
    <>
      <button
        ref={setButton}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-describedby={hasPlaces ? placesId : undefined}
        // Las tarjetas con lugares se animan aunque el sistema pida reducir movimiento (index.css).
        data-force-motion={hasPlaces || undefined}
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
        {/*
          Fotos de los lugares, apiladas sobre la del destino. La actual entra
          desde la derecha con un fundido; las demás quedan transparentes.
        */}
        {photosRequested &&
          places.map((place, i) => {
            const isCurrent = showPlaces && i === index
            return (
              <img
                key={place.image}
                src={place.image}
                alt=""
                decoding="async"
                className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-700 ease-out ${
                  isCurrent ? 'translate-x-0 scale-105 opacity-100' : 'translate-x-[6%] scale-105 opacity-0'
                }`}
              />
            )
          })}
        {/* Degradado para que el texto blanco se lea sobre cualquier foto. */}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {/* Con los lugares visibles, un poco más de oscuridad abajo para que el texto se lea bien. */}
        {hasPlaces && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 transition-opacity duration-300 ${showPlaces ? 'opacity-100' : 'opacity-0'}`}
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
                <PlacesTicker places={places} index={index} />
              </span>
            </span>
          )}
        </span>
      </button>
      {/* Para lectores de pantalla: la lista completa, una sola vez (el carrusel es visual). */}
      {hasPlaces && (
        <span id={placesId} hidden>
          Lugares para visitar: {places.map((p) => p.name).join(', ')}.
        </span>
      )}
    </>
  )
}

/** Panel "Qué visitar": el nombre del lugar actual entra deslizándose desde la derecha. */
function PlacesTicker({ places, index }: { places: PlaceToVisit[]; index: number }) {
  return (
    <span className="mt-3 flex flex-col gap-2 border-t border-white/25 pt-3">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-light">Qué visitar</span>
      <span className="flex h-7 items-center overflow-hidden">
        <span
          key={index}
          className="flex items-center gap-2 truncate text-base font-semibold text-white animate-[place-in_450ms_ease-out]"
        >
          <PinIcon />
          <span className="truncate">{places[index]?.name}</span>
        </span>
      </span>
      <span className="flex gap-1.5">
        {places.map((place, i) => (
          <span
            key={place.name}
            className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`}
          />
        ))}
      </span>
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
export function PhotoChip({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-surface/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0 text-teal-soft" strokeWidth={2.25} />}
      {children}
    </span>
  )
}
