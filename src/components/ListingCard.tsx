import { Link } from 'react-router'
import { formatCOP } from '../lib/format'
import { LISTING_TYPES, type Experience, type Listing, EXPERIENCE_CATEGORIES } from '../lib/domain/types'
import { FavoriteButton } from './FavoriteButton'
import { Badge } from './ui'

/** Tarjeta de un alojamiento propio de LOCUS (reservable). */
export function ListingCard({
  listing,
  selected = false,
  onHover,
  search = '',
  distanceKm,
}: {
  listing: Listing
  selected?: boolean
  onHover?: (id: string | null) => void
  /** Querystring (fechas y huéspedes) para conservar la búsqueda al abrir la ficha. */
  search?: string
  /** Distancia desde la ubicación del usuario (si la compartió). */
  distanceKm?: number
}) {
  return (
    <article
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative overflow-hidden rounded-3xl border bg-surface shadow-sm transition ${
        selected ? 'border-teal ring-2 ring-teal/40' : 'border-line hover:shadow-lg'
      }`}
    >
      <div className="relative aspect-[4/3] bg-surface-2">
        {listing.cover && listing.photoCount > 0 ? (
          <img src={listing.cover} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted">Sin fotos</div>
        )}
        <FavoriteButton className="absolute right-3 top-3" item={{ kind: 'listing', refId: listing.id, title: listing.title, subtitle: listing.municipality }} />
        {listing.isTestData && (
          <span className="absolute left-3 top-3"><Badge tone="warn">Dato de prueba</Badge></span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">
          {LISTING_TYPES[listing.type]} · {listing.municipality}
        </p>
        <h3 className="mt-1 line-clamp-2 font-serif text-lg font-semibold text-navy">
          <Link to={`/hospedajes/${listing.id}${search}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {distanceKm !== undefined && <>a {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km de ti · </>}{listing.capacity} huéspedes · {listing.bedrooms} {listing.bedrooms === 1 ? 'habitación' : 'habitaciones'} · {listing.bathrooms}{' '}
          {listing.bathrooms === 1 ? 'baño' : 'baños'}
        </p>
        <p className="mt-2 text-ink">
          <strong>{formatCOP(listing.pricePerNight)}</strong> <span className="text-sm text-muted">por noche</span>
        </p>
      </div>
    </article>
  )
}

/** Tarjeta de una experiencia propia de LOCUS. */
export function ExperienceCard({ experience }: { experience: Experience }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-surface-2">
        {experience.cover && experience.photoCount > 0 ? (
          <img src={experience.cover} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted">Sin fotos</div>
        )}
        <FavoriteButton className="absolute right-3 top-3" item={{ kind: 'experience', refId: experience.id, title: experience.title, subtitle: experience.municipality }} />
        {experience.isTestData && <span className="absolute left-3 top-3"><Badge tone="warn">Dato de prueba</Badge></span>}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">
          {EXPERIENCE_CATEGORIES[experience.category]} · {experience.municipality}
        </p>
        <h3 className="mt-1 line-clamp-2 font-serif text-lg font-semibold text-navy">
          <Link to={`/experiencias/${experience.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {experience.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {Math.round(experience.durationMinutes / 60 * 10) / 10} h · hasta {experience.capacity} personas
        </p>
        <p className="mt-2 text-ink">
          <strong>{formatCOP(experience.pricePerPerson)}</strong> <span className="text-sm text-muted">por persona</span>
        </p>
      </div>
    </article>
  )
}
