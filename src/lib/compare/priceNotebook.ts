/**
 * "Libreta de precios": el usuario anota el total que ve en cada plataforma y
 * LOCUS le dice cuál conviene, cuánto se ahorra y cuánto más caro es el resto.
 * Hoy es la forma honesta de comparar precios REALES sin APIs de socios; con
 * ellas, las cotizaciones llegarán solas (source: 'api') a la misma tabla.
 *
 * Funciones puras (sin React) para poder probarlas.
 */
import type { PriceQuote } from './providers'

export interface RankedQuote extends PriceQuote {
  /** Cuánto más cuesta que la mejor opción (COP). 0 para la mejor. */
  extraCOP: number
  /** Cuánto más cuesta, en %, redondeado. */
  extraPct: number
}

export interface PriceSummary {
  ranked: RankedQuote[]
  best: RankedQuote | null
  /** Diferencia entre la opción más cara y la más barata. */
  savingsCOP: number
}

/** Ordena de menor a mayor ignorando precios inválidos y calcula las diferencias. */
export function summarizeQuotes(quotes: readonly PriceQuote[]): PriceSummary {
  const valid = quotes.filter((q) => Number.isFinite(q.totalCOP) && q.totalCOP > 0).sort((a, b) => a.totalCOP - b.totalCOP)
  if (valid.length === 0) return { ranked: [], best: null, savingsCOP: 0 }
  const min = valid[0].totalCOP
  const ranked = valid.map((q) => ({
    ...q,
    extraCOP: q.totalCOP - min,
    extraPct: Math.round(((q.totalCOP - min) / min) * 100),
  }))
  return { ranked, best: ranked[0], savingsCOP: valid[valid.length - 1].totalCOP - min }
}

/** Clave estable para recordar lo anotado de una búsqueda (mismo destino, fechas y viajeros). */
export function notebookKey(kind: string, place: string, from: string, to: string, travelers: number): string {
  return ['locus:precios:v1', kind, place.trim().toLowerCase(), from, to, travelers].join('|')
}
