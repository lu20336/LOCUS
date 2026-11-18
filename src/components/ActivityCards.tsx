import { useI18n } from '../lib/i18n/I18nProvider'
import { CATEGORY_IDS, CATEGORIES } from '../lib/itinerary/categories'
import type { CategoryId } from '../types/itinerary'
import { ACTIVITY_IMAGES, CATEGORY_ICONS } from './choiceOptions'
import { PhotoCard } from './PhotoCard'

/**
 * Sección "¿Qué te gustaría hacer?": una tarjeta por categoría. Al elegir una,
 * la página abre el Modo B con esa actividad ya marcada.
 *
 * Las tarjetas avanzan solas hacia la derecha en un carrusel continuo
 * (animación `marquee-right` en index.css):
 *  - Se detiene al pasar el mouse o al enfocar una tarjeta con el teclado.
 *  - Se anima aunque el sistema pida "reducir movimiento" (data-force-motion,
 *    ver index.css).
 */
export function ActivityCards({ onChoose }: { onChoose: (category: CategoryId) => void }) {
  const { t } = useI18n()
  const renderCard = (category: CategoryId, copy = '') => {
    const Icon = CATEGORY_ICONS[category]
    return (
      // El ancho va en el <li>: la tarjeta usa w-full, y si el ancho fuera de la
      // tarjeta, en el celular ganaba w-full sobre w-44 y la tarjeta medía 0 px.
      <li key={`${category}${copy}`} className="w-44 shrink-0 sm:w-52 lg:w-56">
        <PhotoCard
          image={ACTIVITY_IMAGES[category]}
          title={CATEGORIES[category].label}
          srPrefix={t('pc.searchFor')}
          titleClassName="text-xl"
          className="h-60 sm:h-64 lg:h-72"
          badge={
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface/90 shadow-sm backdrop-blur">
              <Icon className="size-5 text-teal-soft" strokeWidth={2} />
            </span>
          }
          onClick={() => onChoose(category)}
        />
      </li>
    )
  }

  return (
    <section aria-labelledby="activities-title" data-force-motion>
      <h2 id="activities-title" className="text-3xl font-semibold text-navy sm:text-4xl">
        {t('home.activities.title')}
      </h2>
      <p className="mt-2 text-muted sm:text-lg">{t('home.activities.subtitle')}</p>

      {/* Bordes difuminados: las tarjetas entran y salen suavemente. */}
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
    </section>
  )
}
