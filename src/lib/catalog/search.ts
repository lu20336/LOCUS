/**
 * Filtrado del catálogo en memoria (funciones puras). El catálogo propio es
 * pequeño (≤ CATALOG_PAGE_SIZE documentos por consulta), así que filtrar en el
 * cliente evita índices compuestos y mantiene las lecturas de Firestore bajas.
 */
import type { Experience, Listing, ListingType, ExperienceCategory } from '../domain/types'
import { conflictingNights } from '../domain/pricing'
import { normalizePlaceName } from '../flow/resolveDestination'

export interface ListingFilters {
  text: string
  guests: number
  minPrice: number | null
  maxPrice: number | null
  types: ListingType[]
  amenities: string[]
  checkIn: string
  checkOut: string
}

export const EMPTY_LISTING_FILTERS: ListingFilters = {
  text: '',
  guests: 1,
  minPrice: null,
  maxPrice: null,
  types: [],
  amenities: [],
  checkIn: '',
  checkOut: '',
}

/** ¿El texto de búsqueda coincide con el municipio, departamento o título? */
export function matchesPlace(text: string, item: Pick<Listing, 'municipality' | 'department' | 'title'>): boolean {
  const query = normalizePlaceName(text)
  if (!query) return true
  const haystack = normalizePlaceName(`${item.municipality} ${item.department} ${item.title}`)
  return query.split(' ').every((word) => haystack.includes(word))
}

export function filterListings(listings: readonly Listing[], f: ListingFilters): Listing[] {
  return listings.filter(
    (l) =>
      matchesPlace(f.text, l) &&
      l.capacity >= f.guests &&
      (f.minPrice === null || l.pricePerNight >= f.minPrice) &&
      (f.maxPrice === null || l.pricePerNight <= f.maxPrice) &&
      (f.types.length === 0 || f.types.includes(l.type)) &&
      f.amenities.every((a) => l.amenities.includes(a)),
  )
}

/** Quita los alojamientos con noches ocupadas/bloqueadas en el rango pedido. */
export function availableListings(
  listings: readonly Listing[],
  calendars: Record<string, { booked: Record<string, unknown>; hostBlocked: Record<string, unknown> }>,
  checkIn: string,
  checkOut: string,
): Listing[] {
  return listings.filter((l) => {
    const calendar = calendars[l.id]
    if (!calendar) return true
    return conflictingNights(checkIn, checkOut, calendar.booked, calendar.hostBlocked).length === 0
  })
}

export interface ExperienceFilters {
  text: string
  categories: ExperienceCategory[]
  maxPrice: number | null
}

export function filterExperiences(items: readonly Experience[], f: ExperienceFilters): Experience[] {
  return items.filter(
    (e) =>
      matchesPlace(f.text, e) &&
      (f.categories.length === 0 || f.categories.includes(e.category)) &&
      (f.maxPrice === null || e.pricePerPerson <= f.maxPrice),
  )
}
