import { useState } from 'react'
import { CATEGORY_IDS, CATEGORIES } from '../lib/itinerary/categories'
import type { CategoryId } from '../types/itinerary'
import { CATEGORY_ICONS } from './choiceOptions'
import { PhotoCard } from './PhotoCard'

/** Foto de cada actividad en /public/images/actividades (ver public/images/CREDITOS.md). */
const ACTIVITY_IMAGES: Record<CategoryId, string> = {
  playa: '/images/actividades/playa.jpg',
  cultura: '/images/actividades/cultura.jpg',
  gastronomia: '/images/actividades/gastronomia.jpg',
  aventura: '/images/actividades/aventura.jpg',
  vidaNocturna: '/images/actividades/vida-nocturna.jpg',
  compras: '/images/actividades/compras.jpg',
}

/**
 * Sección "¿Qué te gustaría hacer?": una tarjeta por categoría. Al elegir una,
 * la página abre el Modo B con esa actividad ya marcada.
 *
 * Las tarjetas avanzan solas hacia la derecha en un carrusel continuo
 * (animación `marquee-right` en index.css):
 *  - Se detiene al pasar el mouse o al enfocar una tarjeta con el teclado.
 *  - El botón "Pausar" lo detiene del todo (WCAG 2.2.2: todo lo que se mueve
 *    más de 5 s debe poder pausarse) y deja una fila que se desliza a mano.
 *  - Se anima aunque el sistema pida "reducir movimiento" (data-force-motion,
 *    ver index.css): por eso el botón "Pausar" está siempre visible.
 */
export function ActivityCards({ onChoose }: { onChoose: (category: CategoryId) => void }) {
  const [paused, setPaused] = useState(false)
  const animated = !paused

  const renderCard = (category: CategoryId, copy = '') => (
    <li key={`${category}${copy}`} className="shrink-0 snap-start">
      <PhotoCard
        image={ACTIVITY_IMAGES[category]}
        title={CATEGORIES[category].label}
        srPrefix="Buscar destinos para"
        titleClassName="text-xl"
        className="h-60 w-44 sm:h-64 sm:w-52 lg:h-72 lg:w-56"
        badge={
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface/90 text-lg shadow-sm backdrop-blur">
            {CATEGORY_ICONS[category]}
          </span>
        }
        onClick={() => onChoose(category)}
      />
    </li>
  )

  return (
    <section aria-labelledby="activities-title" data-force-motion>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="activities-title" className="text-3xl font-semibold text-navy sm:text-4xl">
            ¿Qué te gustaría hacer?
          </h2>
          <p className="mt-2 text-muted sm:text-lg">Elige una actividad y te sugerimos a dónde ir.</p>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
            {paused ? <path d="M8 5.5v13l10.5-6.5L8 5.5Z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
          </svg>
          {paused ? 'Reanudar carrusel' : 'Pausar carrusel'}
        </button>
      </div>

      {animated ? (
        // Bordes difuminados: las tarjetas entran y salen suavemente.
        <div className="group/marquee -mx-4 mt-6 overflow-hidden px-4 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          {/* Dos copias iguales: al terminar el ciclo la segunda ocupa el lugar de la primera. */}
          <div className="flex w-max animate-[marquee-right_45s_linear_infinite] group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused]">
            <ul className="flex gap-5 py-4 pr-5">{CATEGORY_IDS.map((category) => renderCard(category))}</ul>
            {/* La copia es solo visual: ni el teclado ni el lector de pantalla la recorren. */}
            <ul aria-hidden="true" inert className="flex gap-5 py-4 pr-5">
              {CATEGORY_IDS.map((category) => renderCard(category, '-copia'))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 py-4">
          {CATEGORY_IDS.map((category) => renderCard(category))}
        </ul>
      )}
    </section>
  )
}
