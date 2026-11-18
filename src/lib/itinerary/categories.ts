import { getT } from '../i18n/store'
import type { CategoryId } from '../../types/itinerary'

/**
 * Un filtro de OpenStreetMap: una clave de etiqueta y los valores aceptados.
 * Ej. { key: 'tourism', values: ['museum', 'gallery'] } equivale a
 * "tourism=museum O tourism=gallery".
 */
export interface OsmFilter {
  key: string
  values: string[]
  /**
   * Filtro amplio: solo se usa si el lugar no coincide con un filtro más
   * específico de otra actividad pedida. Ej. la Piedra del Peñol es
   * natural=peak (Aventura) y además tourism=attraction: queda en Aventura.
   */
  generic?: boolean
}

export interface CategoryDefinition {
  id: CategoryId
  /** Nombre que ve el usuario. */
  label: string
  filters: OsmFilter[]
}

/**
 * Traducción de cada categoría de Locus a etiquetas (tags) de OpenStreetMap.
 * Referencia de etiquetas: https://wiki.openstreetmap.org/wiki/Map_features
 */
export const CATEGORIES: Record<CategoryId, CategoryDefinition> = {
  playa: {
    id: 'playa',
    get label() {
      return getT()('cat.playa')
    },
    filters: [
      { key: 'natural', values: ['beach'] },
      { key: 'leisure', values: ['beach_resort'] },
    ],
  },
  cultura: {
    id: 'cultura',
    get label() {
      return getT()('cat.cultura')
    },
    filters: [
      { key: 'tourism', values: ['museum', 'gallery'] },
      { key: 'historic', values: ['monument', 'castle', 'fort', 'archaeological_site'] },
      { key: 'amenity', values: ['theatre', 'arts_centre'] },
      // Atracciones turísticas sin una etiqueta más precisa (ej. Catedral de Sal de Zipaquirá).
      { key: 'tourism', values: ['attraction'], generic: true },
    ],
  },
  gastronomia: {
    id: 'gastronomia',
    get label() {
      return getT()('cat.gastronomia')
    },
    filters: [{ key: 'amenity', values: ['restaurant', 'cafe'] }],
  },
  aventura: {
    id: 'aventura',
    get label() {
      return getT()('cat.aventura')
    },
    filters: [
      { key: 'tourism', values: ['viewpoint', 'theme_park'] },
      { key: 'leisure', values: ['nature_reserve', 'water_park'] },
      { key: 'natural', values: ['peak'] },
      { key: 'waterway', values: ['waterfall'] },
    ],
  },
  vidaNocturna: {
    id: 'vidaNocturna',
    get label() {
      return getT()('cat.vidaNocturna')
    },
    filters: [{ key: 'amenity', values: ['bar', 'nightclub', 'pub'] }],
  },
  compras: {
    id: 'compras',
    get label() {
      return getT()('cat.compras')
    },
    filters: [
      { key: 'shop', values: ['mall', 'department_store'] },
      { key: 'amenity', values: ['marketplace'] },
    ],
  },
}

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value)
}

/** Nombre en español de cada valor de etiqueta, para mostrar el "tipo" del lugar. */
const KIND_LABELS: Record<string, string> = {
  beach: 'Playa',
  beach_resort: 'Club de playa',
  museum: 'Museo',
  gallery: 'Galería de arte',
  monument: 'Monumento',
  castle: 'Castillo',
  fort: 'Fuerte',
  archaeological_site: 'Sitio arqueológico',
  theatre: 'Teatro',
  arts_centre: 'Centro cultural',
  attraction: 'Atracción turística',
  restaurant: 'Restaurante',
  cafe: 'Café',
  viewpoint: 'Mirador',
  theme_park: 'Parque temático',
  nature_reserve: 'Reserva natural',
  water_park: 'Parque acuático',
  peak: 'Cerro / cumbre',
  waterfall: 'Cascada',
  bar: 'Bar',
  nightclub: 'Discoteca',
  pub: 'Pub',
  mall: 'Centro comercial',
  shopping_mall: 'Centro comercial', // nombre en Geoapify
  culture: 'Centro cultural', // categoría general de Geoapify (teatros, galerías…)
  department_store: 'Tienda por departamentos',
  marketplace: 'Mercado',
}

export function kindLabel(tagValue: string): string {
  return KIND_LABELS[tagValue] ?? tagValue
}
