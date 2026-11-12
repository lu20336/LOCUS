import { CLIMATE_ICONS } from './choiceOptions'
import { FEATURED_DESTINATIONS, climateOf, type FeaturedDestination } from '../lib/featuredDestinations'
import { CLIMATES } from '../lib/itinerary/suggestDestination'
import { PhotoCard, PhotoChip } from './PhotoCard'

/**
 * Sección "Viaja por Colombia". En celular es un carrusel horizontal; desde
 * tablet, una cuadrícula. En escritorio son 3 columnas y la primera tarjeta
 * ocupa dos (8 tarjetas = 3 filas completas).
 */
export function DestinationCards({ onChoose }: { onChoose: (destination: FeaturedDestination) => void }) {
  return (
    <section aria-labelledby="inspiration-title">
      <h2 id="inspiration-title" className="text-3xl font-semibold text-navy sm:text-4xl">
        Viaja por Colombia
      </h2>
      <p className="mt-2 text-muted sm:text-lg">Del Caribe a los Andes: elige uno y armamos tu plan.</p>

      <ul className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-2 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {FEATURED_DESTINATIONS.map((item, index) => {
          const climate = climateOf(item)
          return (
            <li key={item.id} className={`w-[82%] shrink-0 snap-start sm:w-auto ${index === 0 ? 'lg:col-span-2' : ''}`}>
              <PhotoCard
                image={item.image}
                imagePosition={item.imagePosition}
                title={item.name}
                subtitle={item.tagline}
                places={item.places}
                srPrefix="Planear un viaje a"
                titleClassName="text-3xl"
                className="h-[26rem] sm:h-96"
                badge={<PhotoChip icon={CLIMATE_ICONS[climate]}>Clima {CLIMATES[climate].label.toLowerCase()}</PhotoChip>}
                onClick={() => onChoose(item)}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
