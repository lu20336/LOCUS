// Opciones de los chips de clima y de actividades (se reutilizarán en el Paso 2).
import { CATEGORIES, CATEGORY_IDS } from '../lib/itinerary/categories'
import { CLIMATES, CLIMATE_IDS, type ClimateId } from '../lib/itinerary/suggestDestination'
import type { CategoryId } from '../types/itinerary'
import type { ChipOption } from './ChipGroup'

export const CATEGORY_ICONS: Record<CategoryId, string> = {
  playa: '🏖️',
  cultura: '🏛️',
  gastronomia: '🍽️',
  aventura: '🧗',
  vidaNocturna: '🌙',
  compras: '🛍️',
}

export const CLIMATE_ICONS: Record<ClimateId, string> = { frio: '🧥', templado: '🌤️', calido: '☀️' }

export const CATEGORY_OPTIONS: ChipOption<CategoryId>[] = CATEGORY_IDS.map((id) => ({
  value: id,
  label: CATEGORIES[id].label,
  icon: CATEGORY_ICONS[id],
}))

export const CLIMATE_OPTIONS: ChipOption<ClimateId>[] = CLIMATE_IDS.map((id) => ({
  value: id,
  label: CLIMATES[id].label,
  icon: CLIMATE_ICONS[id],
  description: CLIMATES[id].temperature,
}))
