/**
 * Fiabilidad de las llamadas al proveedor de IA: clasificación de errores,
 * reintentos con espera progresiva (exponential backoff + jitter), tiempos
 * máximos y cancelación. Funciones puras/inyectables para poder probarlas con
 * fallos simulados (src/lib/agent/__tests__/resilience.test.ts).
 *
 * Reglas:
 *  - Errores TEMPORALES (red, 5xx, timeout, 429 puntual) → se reintenta, con tope.
 *  - Errores PERMANENTES (solicitud inválida, permisos, App Check, API apagada,
 *    contenido bloqueado) → NO se reintenta: repetirlos solo gasta cuota.
 *  - Cancelación del usuario → se corta de inmediato, sin reintentos.
 */

export type FailureKind = 'transient' | 'rate-limit' | 'timeout' | 'permanent' | 'config' | 'blocked' | 'cancelled'

export interface Failure {
  kind: FailureKind
  /** Código HTTP si se pudo extraer (429, 503…). */
  status?: number
  /** Código corto del SDK, si existe. */
  code?: string
  /** Se puede reintentar automáticamente. */
  retryable: boolean
  /** Espera sugerida por el servidor (Retry-After), en ms. */
  retryAfterMs?: number
  /**
   * Cuota DIARIA agotada (p. ej. el nivel gratuito de Gemini: N consultas al día por modelo).
   * Reintentar con el mismo modelo no sirve hasta el día siguiente.
   */
  daily?: boolean
}

const text = (error: unknown) =>
  `${(error as { code?: string })?.code ?? ''} ${(error as { name?: string })?.name ?? ''} ${error instanceof Error ? error.message : String(error)}`.toLowerCase()

/** HTTP status que viaja en el mensaje del SDK ("... [503 ] ...") o en sus datos. */
function statusOf(error: unknown): number | undefined {
  const data = (error as { customErrorData?: { status?: number } })?.customErrorData
  if (typeof data?.status === 'number') return data.status
  const direct = (error as { status?: unknown })?.status
  if (typeof direct === 'number') return direct
  const match = /\[(\d{3})\b/.exec(error instanceof Error ? error.message : String(error))
  return match ? Number(match[1]) : undefined
}

function retryAfterOf(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error)
  const m = /retry[- ]?after[^0-9]{0,6}(\d+(?:\.\d+)?)\s*(ms|s)?/i.exec(message)
  if (m) {
    const value = Number(m[1])
    return m[2]?.toLowerCase() === 'ms' ? value : value * 1000
  }
  // Gemini: "Please retry in 7h12m24.66s." / "retry in 38.2s"
  const g = /retry in ((?:\d+(?:\.\d+)?[hms])+)/i.exec(message)
  if (!g) return undefined
  let ms = 0
  for (const [, n, unit] of g[1].matchAll(/(\d+(?:\.\d+)?)([hms])/gi)) ms += Number(n) * (unit.toLowerCase() === 'h' ? 3_600_000 : unit.toLowerCase() === 'm' ? 60_000 : 1000)
  return Math.round(ms)
}

/** El 429 es de una cuota por día (no por minuto): "requests per day", "free_tier_requests… per day", "PerDay". */
const DAILY_QUOTA = /per ?day|perday|requests_per_day|daily/

export function classifyError(error: unknown): Failure {
  const t = text(error)
  const status = statusOf(error)
  const code = (error as { code?: string })?.code
  const base = { status, code }

  if (/aborterror|cancelled by user|user-abort/.test(t) && !/timeout|timed out/.test(t)) return { ...base, kind: 'cancelled', retryable: false }
  if (/timeouterror|timed out|timeout|deadline/.test(t) || status === 408 || status === 504) return { ...base, kind: 'timeout', retryable: true }
  // Permanentes primero: App Check/API apagada llegan como 4xx y NO mejoran reintentando.
  if (/app check|app-check|appcheck/.test(t)) return { ...base, kind: 'config', retryable: false }
  if (/api-not-enabled|not-enabled|has not been used|service_disabled|api key not valid|api_key_invalid|model.*not found|status 404|\[404/.test(t) || status === 404) {
    return { ...base, kind: 'config', retryable: false }
  }
  if (/safety|prohibited|blocked|recitation/.test(t)) return { ...base, kind: 'blocked', retryable: false }
  if (status === 429 || /429|quota|rate limit|resource_exhausted|too many requests/.test(t)) {
    // Cuota diaria: esperar segundos no la recupera, así que no se reintenta (el agente cambia de modelo).
    if (DAILY_QUOTA.test(t)) return { ...base, kind: 'rate-limit', retryable: false, daily: true, retryAfterMs: retryAfterOf(error) }
    return { ...base, kind: 'rate-limit', retryable: true, retryAfterMs: retryAfterOf(error) }
  }
  if (status === 401 || status === 403 || /permission_denied|permission denied|unauthenticated|unauthorized/.test(t)) {
    return { ...base, kind: 'config', retryable: false }
  }
  if (status === 400 || /invalid_argument|invalid argument|bad request|invalid request/.test(t)) return { ...base, kind: 'permanent', retryable: false }
  if ((status !== undefined && status >= 500) || /unavailable|overloaded|internal|server error|network|failed to fetch|fetch-error|offline|econnreset|socket|load failed/.test(t)) {
    return { ...base, kind: 'transient', retryable: true, retryAfterMs: retryAfterOf(error) }
  }
  // Desconocido: se trata como temporal (un reintento corto no hace daño); el tope lo limita.
  return { ...base, kind: 'transient', retryable: true }
}

export interface RetryOptions {
  /** Intentos totales (1 = sin reintentos). */
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  /** Tiempo máximo de CADA intento. */
  timeoutMs?: number
  /** Cancelación externa (botón "Detener", cierre del panel). */
  signal?: AbortSignal
  /** Se llama antes de esperar para reintentar. */
  onRetry?: (info: { attempt: number; nextAttempt: number; delayMs: number; failure: Failure }) => void
  /** Inyectables para pruebas. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  random?: () => number
}

export class AgentAttemptError extends Error {
  readonly failure: Failure
  readonly attempts: number
  readonly cause: unknown
  constructor(failure: Failure, attempts: number, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'AgentAttemptError'
    this.failure = failure
    this.attempts = attempts
    this.cause = cause
  }
}

/** Espera `ms` o se corta al cancelar. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Espera progresiva con jitter: base·2^(intento-1), tope maxDelay, ±25 %; respeta Retry-After (con tope). */
export function backoffDelay(attempt: number, failure: Failure, options: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'random'> = {}): number {
  const base = options.baseDelayMs ?? 800
  const max = options.maxDelayMs ?? 8000
  const random = options.random ?? Math.random
  const exp = Math.min(max, base * 2 ** (attempt - 1))
  const jittered = exp * (0.75 + random() * 0.5)
  const floor = failure.retryAfterMs !== undefined ? Math.min(failure.retryAfterMs, 15_000) : 0
  // Un 429 pide más calma que un fallo de red.
  const factor = failure.kind === 'rate-limit' ? 2 : 1
  return Math.round(Math.max(floor, jittered * factor))
}

/** Ejecuta `task` con tiempo máximo por intento. El AbortSignal que recibe se activa al vencer el tiempo o al cancelar. */
async function runAttempt<T>(task: (signal: AbortSignal) => Promise<T>, timeoutMs: number, outer?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const onOuter = () => controller.abort(new DOMException('Cancelado', 'AbortError'))
  if (outer?.aborted) throw new DOMException('Cancelado', 'AbortError')
  outer?.addEventListener('abort', onOuter, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError'))
          reject(new DOMException('Tiempo de espera agotado', 'TimeoutError'))
        }, timeoutMs)
      }),
      // Si se cancela desde fuera, el intento termina YA aunque el SDK no atienda la señal.
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason ?? new DOMException('Cancelado', 'AbortError')), { once: true })
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    outer?.removeEventListener('abort', onOuter)
  }
}

/**
 * Reintenta `task` ante errores temporales. Lanza AgentAttemptError (con la
 * clasificación y el número de intentos) cuando se rinde o el error es permanente.
 */
export async function withRetry<T>(task: (signal: AbortSignal, attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<{ value: T; attempts: number }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
  const timeoutMs = options.timeoutMs ?? 30_000
  const wait = options.sleep ?? sleep
  let attempt = 0
  for (;;) {
    attempt++
    try {
      const value = await runAttempt((signal) => task(signal, attempt), timeoutMs, options.signal)
      return { value, attempts: attempt }
    } catch (error) {
      const cancelled = options.signal?.aborted === true
      const failure = cancelled ? ({ kind: 'cancelled', retryable: false } as Failure) : classifyError(error)
      if (!failure.retryable || attempt >= maxAttempts) throw new AgentAttemptError(failure, attempt, error)
      const delayMs = backoffDelay(attempt, failure, options)
      options.onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, failure })
      try {
        await wait(delayMs, options.signal)
      } catch {
        throw new AgentAttemptError({ kind: 'cancelled', retryable: false }, attempt, error)
      }
    }
  }
}

/** Limita una promesa a `ms`; al vencer lanza TimeoutError (la tarea original no se cancela). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DOMException('Tiempo de espera agotado', 'TimeoutError')), ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
