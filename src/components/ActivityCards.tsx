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
 */
export function ActivityCards({ onChoose }: { onChoose: (category: CategoryId) => void }) {
  return (
    <section aria-labelledby="activities-title">
      <h2 id="activities-title" className="text-3xl font-semibold text-navy sm:text-4xl">
        ¿Qué te gustaría hacer?
      </h2>
      <p className="mt-2 text-muted sm:text-lg">Elige una actividad y te sugerimos a dónde ir.</p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
        {CATEGORY_IDS.map((category) => (
          <li key={category}>
            <PhotoCard
              image={ACTIVITY_IMAGES[category]}
              title={CATEGORIES[category].label}
              srPrefix="Buscar destinos para"
              titleClassName="text-xl"
              className="h-52 sm:h-60 lg:h-72"
              badge={
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface/90 text-lg shadow-sm backdrop-blur">
                  {CATEGORY_ICONS[category]}
                </span>
              }
              onClick={() => onChoose(category)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
