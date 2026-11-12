/**
 * Sugerencias de la barra de búsqueda mientras el usuario escribe
 * ("med" → "Medellín, Antioquia, Colombia").
 *
 * Salen de datos que ya trae la app, NO de Nominatim: su política de uso
 * prohíbe el autocompletado (una consulta por tecla). Fuentes:
 *   - Los destinos destacados de la portada (con departamento y coordenadas).
 *   - La lista de los 300 municipios más poblados (src/data/colombiaTowns.json),
 *     que se descarga la primera vez que se escribe.
 * Si el lugar no está en la lista, el usuario igual puede escribirlo completo:
 * al continuar se busca en Nominatim (resolveDestination).
 */
import { useEffect, useMemo, useState } from 'react'
import type { Destination } from '../../types/itinerary'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'
import { suggestionDeps } from '../itinerary/browserClient'
import { haversineKm } from '../itinerary/geo'
import type { TownCandidate } from '../itinerary/suggestDestination'
import { findTownDestination, normalizePlaceName } from './resolveDestination'

export interface DestinationOption {
  id: string
  /** Nombre del lugar, ej. "Medellín". */
  name: string
  /** Contexto debajo del nombre, ej. "Antioquia, Colombia". */
  detail: string
  destination: Destination
}

/** Letras mínimas antes de sugerir (con 1 letra saldrían demasiados lugares). */
export const MIN_QUERY_LENGTH = 2
export const MAX_OPTIONS = 6

/** Un municipio a menos de esta distancia de un destacado es el mismo lugar ("Cartagena de Indias"). */
const SAME_PLACE_KM = 5

/** "Cartagena de Indias, Bolívar, Colombia" → nombre "Cartagena de Indias", detalle "Bolívar, Colombia". */
function splitDisplayName(displayName: string): { name: string; detail: string } {
  const [name, ...rest] = displayName.split(',').map((part) => part.trim())
  return { name, detail: rest.join(', ') || 'Colombia' }
}

/**
 * 0 = algún nombre empieza por lo escrito ("med" → Medellín),
 * 1 = alguna palabra de algún nombre empieza por lo escrito ("leyva" → Villa de Leyva),
 * null = no coincide.
 */
function matchRank(names: string[], query: string): 0 | 1 | null {
  const normalized = names.map(normalizePlaceName)
  if (normalized.some((name) => name.startsWith(query))) return 0
  if (normalized.some((name) => name.split(' ').some((word) => word.startsWith(query)))) return 1
  return null
}

/**
 * Función pura: hasta MAX_OPTIONS lugares que coinciden con `text`.
 * Orden: primero los que empiezan por lo escrito, luego destacados, luego
 * los más poblados. Sin nombres repetidos (gana el destacado o el más poblado).
 */
export function searchDestinations(
  text: string,
  towns: readonly TownCandidate[],
  limit = MAX_OPTIONS,
): DestinationOption[] {
  const query = normalizePlaceName(text)
  if (query.length < MIN_QUERY_LENGTH) return []

  const seen = new Set<string>()
  const found: { option: DestinationOption; rank: number; order: number }[] = []

  FEATURED_DESTINATIONS.forEach((item, index) => {
    // Se busca por el nombre corto ("Cartagena") y por el oficial ("Cartagena de Indias").
    const { name, detail } = splitDisplayName(item.destination.displayName)
    const rank = matchRank([item.name, name], query)
    seen.add(normalizePlaceName(item.name))
    seen.add(normalizePlaceName(name))
    if (rank === null) return
    found.push({
      option: {
        id: `featured:${item.id}`,
        name,
        detail,
        destination: { ...item.destination, query: item.destination.displayName },
      },
      rank,
      order: index,
    })
  })

  towns.forEach((town, index) => {
    const key = normalizePlaceName(town.name)
    if (seen.has(key)) return
    seen.add(key)
    if (FEATURED_DESTINATIONS.some((item) => haversineKm(town, item.destination) < SAME_PLACE_KM)) return
    const rank = matchRank([town.name], query)
    if (rank === null) return
    const destination = findTownDestination(town.name, [town])
    if (!destination) return
    found.push({
      option: {
        id: town.id,
        name: town.name,
        detail: 'Colombia',
        destination: { ...destination, query: `${town.name}, Colombia` },
      },
      rank,
      // Los destacados van antes que cualquier municipio con el mismo rango.
      order: FEATURED_DESTINATIONS.length + index,
    })
  })

  return found
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.option)
}

/**
 * Hook para la barra: devuelve las sugerencias para `text`. La lista de
 * municipios se descarga la primera vez que hace falta; mientras tanto (o si
 * falla) se sugieren solo los destinos destacados.
 */
export function useDestinationOptions(text: string): DestinationOption[] {
  const [towns, setTowns] = useState<TownCandidate[] | null>(null)
  const needsTowns = towns === null && normalizePlaceName(text).length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (!needsTowns) return
    let cancelled = false
    suggestionDeps
      .loadTowns()
      .then((list) => {
        if (!cancelled) setTowns(list)
      })
      .catch(() => {
        // Sin la lista seguimos sugiriendo los destacados.
      })
    return () => {
      cancelled = true
    }
  }, [needsTowns])

  return useMemo(() => searchDestinations(text, towns ?? []), [text, towns])
}
