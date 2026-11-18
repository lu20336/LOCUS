/**
 * Cliente del servicio de precios (Cloudflare Worker, ver workers/prices y
 * docs/PRECIOS_EN_VIVO.md). Si `VITE_PRICES_API_URL` no está configurada, la
 * función está apagada y la interfaz simplemente no muestra el bloque de
 * "precio de referencia": nada se rompe.
 *
 * La respuesta del servicio se valida aquí otra vez (no confiamos en que el
 * servicio esté bien desplegado): ante cualquier forma inesperada se devuelve
 * `null` y nunca se muestra un precio dudoso.
 */
import type { PriceQuote } from './providers'

export interface FlightReference {
  /** Precio por pasajero (COP). */
  priceCOP: number
  airline: string | null
  departureAt: string | null
  transfers: number | null
  /** 'date' = el día elegido; 'month' = lo más barato de ese mes. */
  matched: 'date' | 'month'
  /** Enlace a Aviasales (el servicio solo entrega URLs de aviasales.com). */
  link: string
  fetchedAt: string
}

export interface FlightReferenceQuery {
  origin: string
  destination: string
  date: string
  returnDate?: string
}

export const PRICES_API_URL = ((import.meta.env.VITE_PRICES_API_URL as string | undefined) ?? '').trim().replace(/\/$/, '')

export const livePricesEnabled = (baseUrl: string = PRICES_API_URL) => baseUrl.length > 0

const AVIASALES_HOSTS = new Set(['www.aviasales.com', 'aviasales.com'])

/** Valida la forma de la respuesta; null si algo no cuadra o no hay datos. */
export function parseFlightReference(payload: unknown): FlightReference | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (p.ok !== true || p.found !== true) return null
  const price = p.priceCOP
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 100_000_000) return null
  if (p.matched !== 'date' && p.matched !== 'month') return null
  if (typeof p.link !== 'string' || typeof p.fetchedAt !== 'string') return null
  try {
    const link = new URL(p.link)
    if (link.protocol !== 'https:' || !AVIASALES_HOSTS.has(link.hostname)) return null
  } catch {
    return null
  }
  return {
    priceCOP: Math.round(price),
    airline: typeof p.airline === 'string' ? p.airline : null,
    departureAt: typeof p.departureAt === 'string' ? p.departureAt : null,
    transfers: typeof p.transfers === 'number' ? p.transfers : null,
    matched: p.matched,
    link: p.link,
    fetchedAt: p.fetchedAt,
  }
}

export async function fetchFlightReference(
  q: FlightReferenceQuery,
  options: { baseUrl?: string; fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<FlightReference | null> {
  const baseUrl = (options.baseUrl ?? PRICES_API_URL).trim().replace(/\/$/, '')
  if (!livePricesEnabled(baseUrl)) return null
  const params = new URLSearchParams({ origin: q.origin, destination: q.destination, date: q.date })
  if (q.returnDate) params.set('return', q.returnDate)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000)
  try {
    const res = await (options.fetchFn ?? fetch)(`${baseUrl}/flights?${params.toString()}`, { signal: controller.signal })
    if (!res.ok) return null
    return parseFlightReference(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** La referencia como fila de la libreta de precios (total para todos los pasajeros). */
export function referenceToQuote(ref: FlightReference, passengers: number): PriceQuote {
  return {
    providerId: 'aviasales-ref',
    label: 'Aviasales · referencia',
    totalCOP: ref.priceCOP * Math.max(1, passengers),
    source: 'api',
  }
}
