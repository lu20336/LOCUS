// Opciones de los chips de clima y de actividades (se reutilizarán en el Paso 2).
//
// Iconos: Lucide (https://lucide.dev, licencia ISC). Son SVG con el mismo
// trazo y tamaño, toman el color del texto (currentColor) y se ven igual en
// Windows, Mac y Android, a diferencia de los emojis.
import {
  CloudSun,
  Landmark,
  Martini,
  Mountain,
  ShoppingBag,
  Sun,
  ThermometerSnowflake,
  TreePalm,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_IDS } from '../lib/itinerary/categories'
import { CLIMATES, CLIMATE_IDS, type ClimateId } from '../lib/itinerary/suggestDestination'
import type { CategoryId } from '../types/itinerary'
import type { ChipOption } from './ChipGroup'

export type Icon = LucideIcon

export const CATEGORY_ICONS: Record<CategoryId, Icon> = {
  playa: TreePalm,
  cultura: Landmark,
  gastronomia: UtensilsCrossed,
  aventura: Mountain,
  vidaNocturna: Martini,
  compras: ShoppingBag,
}

export const CLIMATE_ICONS: Record<ClimateId, Icon> = {
  frio: ThermometerSnowflake,
  templado: CloudSun,
  calido: Sun,
}

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
