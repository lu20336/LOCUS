/**
 * Qué foto lleva cada tarjeta de actividad del Paso 2, sin repetir ninguna
 * (ni entre tarjetas ni con la foto del encabezado).
 *
 * Orden para cada actividad:
 *   1. La revisada a mano (destinos destacados).
 *   2. La automática de Wikidata/Commons: un lugar real de esa actividad allí.
 *   3. Una foto extra del destino (vista de la ciudad u otro lugar) que nadie use.
 *   4. La genérica de la actividad.
 *   5. Solo si todo lo anterior ya está usado, la del encabezado.
 * Primero se reparten las fotos propias (1 y 2) a todas las tarjetas y luego
 * los respaldos, para que un respaldo nunca le quite su foto a otra tarjeta.
 */
import type { CategoryId } from '../../types/itinerary'
import type { PlacePhoto } from '../itinerary/placePhotos'

export interface TilePhoto {
  url: string
  /** Autor y licencia (solo fotos automáticas de Commons). */
  credit?: PlacePhoto
}

export interface TilePhotoSources {
  /** Actividades visibles, en orden. */
  categories: readonly CategoryId[]
  /** Foto del encabezado (ciudad), si hay. */
  header: TilePhoto | null
  curated?: Partial<Record<CategoryId, string>>
  /** Fotos automáticas; null mientras se buscan. */
  auto: { byCategory: Partial<Record<CategoryId, PlacePhoto>>; extras?: PlacePhoto[] } | null
  generic: Record<CategoryId, string>
}

/** null = aún buscando la foto de esa tarjeta (se muestra un marcador). */
export function assignTilePhotos(sources: TilePhotoSources): Partial<Record<CategoryId, TilePhoto | null>> {
  const { categories, header, curated = {}, auto, generic } = sources
  const used = new Set<string>(header ? [header.url] : [])
  const result: Partial<Record<CategoryId, TilePhoto | null>> = {}
  const take = (category: CategoryId, photo: TilePhoto) => {
    used.add(photo.url)
    result[category] = photo
  }

  for (const category of categories) {
    const own = curated[category]
    const found = auto?.byCategory[category]
    if (own && !used.has(own)) take(category, { url: own })
    else if (found && !used.has(found.url)) take(category, { url: found.url, credit: found })
  }

  const extras = (auto?.extras ?? []).filter((p) => !used.has(p.url))
  for (const category of categories) {
    if (result[category]) continue
    if (!auto) {
      result[category] = null
      continue
    }
    const extra = extras.find((p) => !used.has(p.url))
    if (extra) take(category, { url: extra.url, credit: extra })
    else if (!used.has(generic[category])) take(category, { url: generic[category] })
    else result[category] = header ?? { url: generic[category] }
  }
  return result
}
