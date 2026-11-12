/**
 * Caché de respuestas de Overpass en sessionStorage (dura mientras la pestaña
 * esté abierta, con vigencia máxima de 24 h). La clave es la consulta misma,
 * que ya incluye coordenadas, radio y categorías: repetir una búsqueda
 * idéntica no vuelve a llamar a Overpass.
 */
import type { OverpassResponse } from './osm'

export interface OverpassCache {
  get(query: string): OverpassResponse | null
  set(query: string, response: OverpassResponse): void
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = 'locus:overpass:v1:'

/** Hash FNV-1a de 32 bits: convierte la consulta (larga) en una clave corta. */
export function hashQuery(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + text.length.toString(16)
}

/** Caché sobre un Storage (sessionStorage en la app; uno falso en los tests). */
export function createStorageCache(storage: Storage, ttlMs = CACHE_TTL_MS, now = () => Date.now()): OverpassCache {
  return {
    get(query) {
      try {
        const raw = storage.getItem(PREFIX + hashQuery(query))
        if (!raw) return null
        const entry = JSON.parse(raw) as { expires: number; response: OverpassResponse }
        if (entry.expires > now()) return entry.response
        storage.removeItem(PREFIX + hashQuery(query))
      } catch {
        // Almacenamiento bloqueado o dato corrupto: se ignora la caché.
      }
      return null
    },
    set(query, response) {
      try {
        storage.setItem(PREFIX + hashQuery(query), JSON.stringify({ expires: now() + ttlMs, response }))
      } catch {
        // Cuota llena o almacenamiento bloqueado: seguimos sin caché.
      }
    },
  }
}

/** sessionStorage si existe y funciona (no existe en Node ni en algunos modos privados). */
export function createSessionCache(): OverpassCache | undefined {
  try {
    if (typeof sessionStorage === 'undefined') return undefined
    sessionStorage.setItem(`${PREFIX}test`, '1')
    sessionStorage.removeItem(`${PREFIX}test`)
    return createStorageCache(sessionStorage)
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Memoria de servidores que fallaron
// ---------------------------------------------------------------------------

/** Cuánto tiempo se recuerda que un servidor falló. */
export const FAILURE_MEMORY_MS = 5 * 60 * 1000
const FAILURES_KEY = 'locus:overpass:failures'

/**
 * Recuerda qué servidores Overpass fallaron en los últimos FAILURE_MEMORY_MS,
 * para no usarlos primero en la siguiente búsqueda (aunque se recargue la página).
 */
export interface ServerFailureMemory {
  markFailed(url: string): void
  /** URLs que fallaron hace menos de FAILURE_MEMORY_MS. */
  recentFailures(): Set<string>
}

export function createStorageFailureMemory(
  storage: Storage,
  ttlMs = FAILURE_MEMORY_MS,
  now = () => Date.now(),
): ServerFailureMemory {
  const read = (): Record<string, number> => {
    try {
      return JSON.parse(storage.getItem(FAILURES_KEY) ?? '{}') as Record<string, number>
    } catch {
      return {}
    }
  }
  return {
    markFailed(url) {
      try {
        storage.setItem(FAILURES_KEY, JSON.stringify({ ...read(), [url]: now() }))
      } catch {
        // Almacenamiento bloqueado: seguimos sin memoria.
      }
    },
    recentFailures() {
      const limit = now() - ttlMs
      return new Set(Object.entries(read()).filter(([, at]) => at > limit).map(([url]) => url))
    },
  }
}

export function createSessionFailureMemory(): ServerFailureMemory | undefined {
  try {
    if (typeof sessionStorage === 'undefined') return undefined
    return createStorageFailureMemory(sessionStorage)
  } catch {
    return undefined
  }
}
