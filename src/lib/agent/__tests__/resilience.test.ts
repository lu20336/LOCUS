import { describe, expect, it, vi } from 'vitest'
import { AgentAttemptError, backoffDelay, classifyError, withRetry, withTimeout } from '../resilience'
import { getAgentLog, logAgentEvent, clearAgentLog, summarizeLog } from '../telemetry'

const err = (message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), extra)
const noSleep = () => Promise.resolve()

describe('classifyError', () => {
  it.each([
    ['503 del proveedor', err('AI: Error fetching from https://x: [503 ] The model is overloaded'), 'transient', true],
    ['fallo de red', err('Failed to fetch'), 'transient', true],
    ['500 interno', err('[500 ] internal error'), 'transient', true],
    ['429 cuota', err('[429 ] Resource has been exhausted (quota)'), 'rate-limit', true],
    ['tiempo agotado', Object.assign(new Error('Tiempo de espera agotado'), { name: 'TimeoutError' }), 'timeout', true],
    ['504', err('[504 ] gateway timeout'), 'timeout', true],
    ['400 inválido', err('[400 ] Invalid argument: contents must alternate'), 'permanent', false],
    ['403 permisos', err('[403 ] PERMISSION_DENIED'), 'config', false],
    ['App Check', err('[401 ] Firebase App Check token is invalid'), 'config', false],
    ['API apagada', err('[403 ] Gemini Developer API has not been used in project'), 'config', false],
    ['modelo inexistente', err('[404 ] models/xyz is not found'), 'config', false],
    ['contenido bloqueado', err('Response was blocked due to SAFETY'), 'blocked', false],
    ['cancelado', Object.assign(new Error('Cancelado'), { name: 'AbortError' }), 'cancelled', false],
  ])('%s', (_n, error, kind, retryable) => {
    expect(classifyError(error)).toMatchObject({ kind, retryable })
  })

  it('lee el status de customErrorData y el Retry-After', () => {
    const f = classifyError(err('rate limited, retry after 7s', { customErrorData: { status: 429 } }))
    expect(f).toMatchObject({ kind: 'rate-limit', status: 429, retryAfterMs: 7000 })
  })

  it('un error desconocido se trata como temporal (con tope de intentos)', () => {
    expect(classifyError(err('algo raro'))).toMatchObject({ kind: 'transient', retryable: true })
  })
})

describe('backoffDelay', () => {
  const noJitter = { random: () => 0.5 } // factor 1.0
  it('crece de forma exponencial hasta el tope', () => {
    const f = { kind: 'transient', retryable: true } as const
    expect(backoffDelay(1, f, { ...noJitter, baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(1000)
    expect(backoffDelay(2, f, { ...noJitter, baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(2000)
    expect(backoffDelay(3, f, { ...noJitter, baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(4000)
    expect(backoffDelay(4, f, { ...noJitter, baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(5000)
  })
  it('el jitter queda entre ±25 %', () => {
    const f = { kind: 'transient', retryable: true } as const
    expect(backoffDelay(1, f, { random: () => 0, baseDelayMs: 1000 })).toBe(750)
    expect(backoffDelay(1, f, { random: () => 1, baseDelayMs: 1000 })).toBe(1250)
  })
  it('un 429 espera el doble y respeta Retry-After (con tope de 15 s)', () => {
    expect(backoffDelay(1, { kind: 'rate-limit', retryable: true }, { ...noJitter, baseDelayMs: 1000 })).toBe(2000)
    expect(backoffDelay(1, { kind: 'rate-limit', retryable: true, retryAfterMs: 9000 }, { ...noJitter, baseDelayMs: 1000 })).toBe(9000)
    expect(backoffDelay(1, { kind: 'rate-limit', retryable: true, retryAfterMs: 90_000 }, { ...noJitter, baseDelayMs: 1000 })).toBe(15_000)
  })
})

describe('withRetry', () => {
  it('éxito al primer intento: no reintenta', async () => {
    const task = vi.fn().mockResolvedValue('ok')
    expect(await withRetry(task, { sleep: noSleep })).toEqual({ value: 'ok', attempts: 1 })
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('reintenta errores temporales y se recupera', async () => {
    const task = vi.fn().mockRejectedValueOnce(err('[503 ] overloaded')).mockRejectedValueOnce(err('Failed to fetch')).mockResolvedValue('listo')
    const onRetry = vi.fn()
    const r = await withRetry(task, { sleep: noSleep, onRetry })
    expect(r).toEqual({ value: 'listo', attempts: 3 })
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, nextAttempt: 2 })
  })

  it('se rinde tras el máximo de intentos y conserva la causa', async () => {
    const task = vi.fn().mockRejectedValue(err('[503 ] overloaded'))
    const e = await withRetry(task, { sleep: noSleep, maxAttempts: 3 }).catch((x) => x)
    expect(e).toBeInstanceOf(AgentAttemptError)
    expect(e.attempts).toBe(3)
    expect(e.failure.kind).toBe('transient')
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('NO reintenta errores permanentes (permisos, solicitud inválida, App Check)', async () => {
    for (const message of ['[403 ] PERMISSION_DENIED', '[400 ] Invalid argument', '[401 ] App Check token is invalid']) {
      const task = vi.fn().mockRejectedValue(err(message))
      const e = await withRetry(task, { sleep: noSleep }).catch((x) => x)
      expect(task).toHaveBeenCalledTimes(1)
      expect(e.failure.retryable).toBe(false)
    }
  })

  it('un intento colgado se corta por tiempo y se reintenta', async () => {
    let calls = 0
    const task = vi.fn((signal: AbortSignal) => {
      calls++
      if (calls === 1) return new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
      return Promise.resolve('respuesta')
    })
    const r = await withRetry(task, { sleep: noSleep, timeoutMs: 20 })
    expect(r).toEqual({ value: 'respuesta', attempts: 2 })
  })

  it('un timeout permanente termina con kind=timeout (no se queda esperando)', async () => {
    const task = () => new Promise<string>(() => undefined) // nunca responde
    const started = Date.now()
    const e = await withRetry(task, { sleep: noSleep, timeoutMs: 15, maxAttempts: 2 }).catch((x) => x)
    expect(e.failure.kind).toBe('timeout')
    expect(e.attempts).toBe(2)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('cancelar corta de inmediato, sin reintentos', async () => {
    const controller = new AbortController()
    const task = vi.fn(() => new Promise<string>((_, reject) => setTimeout(() => reject(err('[503 ]')), 50)))
    const promise = withRetry(task, { sleep: noSleep, signal: controller.signal, timeoutMs: 1000 })
    controller.abort()
    const e = await promise.catch((x) => x)
    expect(e.failure.kind).toBe('cancelled')
    expect(task.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('cancelar durante la espera entre reintentos también corta', async () => {
    const controller = new AbortController()
    const task = vi.fn().mockRejectedValue(err('[503 ]'))
    const slowSleep = (_ms: number, signal?: AbortSignal) =>
      new Promise<void>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
    const promise = withRetry(task, { sleep: slowSleep, signal: controller.signal })
    setTimeout(() => controller.abort(), 10)
    const e = await promise.catch((x) => x)
    expect(e.failure.kind).toBe('cancelled')
    expect(task).toHaveBeenCalledTimes(1)
  })
})

describe('withTimeout', () => {
  it('devuelve el valor si llega a tiempo y lanza TimeoutError si no', async () => {
    expect(await withTimeout(Promise.resolve(5), 50)).toBe(5)
    const e = (await withTimeout(new Promise(() => undefined), 10).catch((x) => x)) as { name: string }
    expect(e.name).toBe('TimeoutError')
  })
})

describe('telemetría', () => {
  it('guarda eventos técnicos sin contenido y calcula estadísticas', () => {
    clearAgentLog()
    logAgentEvent({ provider: 'gemini', model: 'm', kind: 'model', durationMs: 100, status: 'ok', retries: 0 })
    logAgentEvent({ provider: 'gemini', model: 'm', kind: 'model', durationMs: 300, status: 'error', errorCode: 503, retries: 2, cause: 'transient' })
    const log = getAgentLog()
    expect(summarizeLog(log)).toEqual({ total: 2, errors: 1, retries: 2, avgMs: 200 })
    expect(JSON.stringify(log)).not.toMatch(/texto|mensaje|token|apiKey|email/i)
    clearAgentLog()
    expect(getAgentLog()).toHaveLength(0)
  })
})

describe('cuota diaria de Gemini', () => {
  it('distingue la cuota DIARIA (no se reintenta) de la de por minuto, y lee "retry in 7h12m24s"', () => {
    const daily = classifyError(Object.assign(new Error('[429 ] Generate content requests per day limit exceeded on Free Tier. Please retry in 7h12m24.66s.'), { customErrorData: { status: 429 } }))
    expect(daily).toMatchObject({ kind: 'rate-limit', retryable: false, daily: true })
    expect(daily.retryAfterMs).toBe(Math.round((7 * 3600 + 12 * 60 + 24.66) * 1000))
    const minute = classifyError(Object.assign(new Error('[429 ] Too many requests per minute. Please retry in 38.2s.'), { customErrorData: { status: 429 } }))
    expect(minute).toMatchObject({ kind: 'rate-limit', retryable: true, retryAfterMs: 38200 })
    expect(minute.daily).toBeUndefined()
  })
})
