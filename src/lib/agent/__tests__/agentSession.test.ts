/**
 * Pruebas del AgentSession con un Gemini simulado: reproducen los fallos reales
 * (sesión envenenada, 503, 429, cuota, timeouts, respuestas vacías, desconexión)
 * y comprueban la recuperación, los reintentos y que no se dupliquen mensajes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Gemini simulado ---------------------------------------------------------
interface Script {
  /** Cada llamada a sendMessage consume una acción. */
  steps: ((request: unknown) => unknown | Promise<unknown>)[]
  calls: unknown[]
  chatsCreated: number
  lastSystemInstruction: string
}
const script: Script = { steps: [], calls: [], chatsCreated: 0, lastSystemInstruction: '' }

const ok = (text: string, extra: { functionCalls?: { name: string; args: unknown }[]; finishReason?: string } = {}) => ({
  response: {
    text: () => text,
    functionCalls: () => extra.functionCalls,
    candidates: [{ finishReason: extra.finishReason ?? 'STOP' }],
  },
})
const httpError = (status: number, message = 'error') => Object.assign(new Error(`AI: Error fetching from https://x: [${status} ] ${message}`), { customErrorData: { status } })

vi.mock('firebase/ai', () => {
  class FakeChat {
    history: unknown[]
    poisoned: Error | null = null
    constructor(history: unknown[]) {
      this.history = [...history]
      script.chatsCreated++
    }
    async getHistory() {
      return [...this.history]
    }
    async sendMessage(request: unknown) {
      // Reproduce el defecto del SDK: tras un fallo, la sesión queda envenenada.
      if (this.poisoned) throw this.poisoned
      script.calls.push(request)
      const step = script.steps.shift()
      if (!step) throw new Error('sin guion')
      try {
        const out = await step(request)
        this.history.push({ role: 'user' }, { role: 'model' })
        return out
      } catch (e) {
        this.poisoned = e as Error
        throw e
      }
    }
  }
  return {
    getAI: () => ({}),
    getGenerativeModel: (_ai: unknown, params: { systemInstruction: string }) => {
      script.lastSystemInstruction = params.systemInstruction
      return { startChat: ({ history }: { history: unknown[] }) => new FakeChat(history ?? []) }
    },
    GoogleAIBackend: class {},
    Schema: { object: () => ({}), string: () => ({}), integer: () => ({}), array: () => ({}), boolean: () => ({}), number: () => ({}), enumString: () => ({}) },
  }
})
vi.mock('firebase/app-check', () => ({ initializeAppCheck: vi.fn(), ReCaptchaEnterpriseProvider: class {} }))
vi.mock('../../firebase/client', () => ({ app: {}, db: {}, auth: {} }))
const runToolMock = vi.fn()
vi.mock('../tools', () => ({ TOOL_DECLARATIONS: [], runTool: (...a: unknown[]) => runToolMock(...a) }))

import { AgentSession, AgentUnavailableError, buildSystemInstruction, toHistory } from '../agent'
import { clearAgentLog, getAgentLog } from '../telemetry'

const ctx = { uid: null, aiConsent: false, today: '2026-12-01', locale: 'es' as const }
const fast = { sleep: () => Promise.resolve(), baseDelayMs: 1 }

beforeEach(() => {
  script.steps = []
  script.calls = []
  script.chatsCreated = 0
  runToolMock.mockReset()
  AgentSession.tuning = { retry: fast, toolTimeoutMs: 50 }
  clearAgentLog()
})

describe('respuestas normales', () => {
  it('devuelve el texto del modelo', async () => {
    script.steps = [() => ok('¡Hola!')]
    const reply = await new AgentSession(ctx, null).send('hola')
    expect(reply).toEqual({ text: '¡Hola!', cards: [] })
    expect(getAgentLog().at(-1)).toMatchObject({ provider: 'gemini', kind: 'model', status: 'ok', retries: 0 })
  })

  it('ejecuta herramientas, reúne tarjetas y devuelve el texto final', async () => {
    runToolMock.mockResolvedValue({ result: { count: 1 }, cards: [{ kind: 'note', text: 'x' }] })
    script.steps = [() => ok('', { functionCalls: [{ name: 'search_listings', args: { destination: 'Salento' } }] }), () => ok('Encontré uno.')]
    const onTool = vi.fn()
    const reply = await new AgentSession(ctx, null).send('busca', { onTool })
    expect(reply.text).toBe('Encontré uno.')
    expect(reply.cards).toHaveLength(1)
    expect(onTool).toHaveBeenCalledWith('search_listings')
  })
})

describe('causa raíz: la sesión envenenada', () => {
  it('tras un fallo PERMANENTE la conversación sigue utilizable (antes quedaba muerta)', async () => {
    script.steps = [() => Promise.reject(httpError(400, 'Invalid argument')), () => ok('Ya funciono')]
    const session = new AgentSession(ctx, null)
    await expect(session.send('uno')).rejects.toBeInstanceOf(AgentUnavailableError)
    const reply = await session.send('dos')
    expect(reply.text).toBe('Ya funciono')
  })

  it('tras agotar los reintentos por un 503 la siguiente pregunta funciona', async () => {
    script.steps = [() => Promise.reject(httpError(503)), () => Promise.reject(httpError(503)), () => Promise.reject(httpError(503)), () => ok('Volví')]
    const session = new AgentSession(ctx, null)
    const err = (await session.send('uno').catch((e) => e)) as AgentUnavailableError
    expect(err.attempts).toBe(3)
    expect(err.retryable).toBe(true)
    expect((await session.send('dos')).text).toBe('Volví')
  })
})

describe('reintentos', () => {
  it('se recupera de un 503 y de un 429 temporales sin que el usuario haga nada', async () => {
    script.steps = [() => Promise.reject(httpError(503)), () => Promise.reject(httpError(429, 'quota')), () => ok('Listo')]
    const onRetry = vi.fn()
    const reply = await new AgentSession(ctx, null).send('hola', { onRetry })
    expect(reply.text).toBe('Listo')
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0]).toMatchObject({ nextAttempt: 2, maxAttempts: 3 })
    expect(getAgentLog().at(-1)).toMatchObject({ status: 'ok', retries: 2 })
  })

  it('NO reintenta errores permanentes (permisos, App Check, API apagada)', async () => {
    for (const [status, message, reason] of [
      [403, 'PERMISSION_DENIED', 'permission'],
      [401, 'Firebase App Check token is invalid', 'app-check'],
      [403, 'Gemini Developer API has not been used in project', 'not-enabled'],
    ] as const) {
      script.steps = [() => Promise.reject(httpError(status, message))]
      script.calls = []
      const err = (await new AgentSession(ctx, null).send('hola').catch((e) => e)) as AgentUnavailableError
      expect(err.reason).toBe(reason)
      expect(script.calls).toHaveLength(1)
      expect(err.retryable).toBe(false)
    }
  })

  it('al rendirse deja constancia técnica sin contenido de la conversación', async () => {
    script.steps = [() => Promise.reject(httpError(503)), () => Promise.reject(httpError(503)), () => Promise.reject(httpError(503))]
    await new AgentSession(ctx, null).send('mi secreto 12345 correo@x.com').catch(() => undefined)
    const entry = getAgentLog().at(-1)!
    expect(entry).toMatchObject({ provider: 'gemini', status: 'error', errorCode: 503, retries: 2, cause: 'transient' })
    expect(JSON.stringify(getAgentLog())).not.toContain('secreto')
    expect(JSON.stringify(getAgentLog())).not.toContain('correo@x.com')
  })
})

describe('no duplica mensajes', () => {
  it('un segundo mensaje mientras responde se rechaza como "ocupado" y el primero sigue', async () => {
    let release: (v: unknown) => void = () => undefined
    script.steps = [() => new Promise((resolve) => (release = resolve))]
    const session = new AgentSession(ctx, null)
    const first = session.send('uno', { requestId: 'a' })
    await new Promise((r) => setTimeout(r, 5))
    const err = (await session.send('dos', { requestId: 'b' }).catch((e) => e)) as AgentUnavailableError
    expect(err.reason).toBe('busy')
    release(ok('respuesta uno'))
    expect((await first).text).toBe('respuesta uno')
    expect(script.calls).toHaveLength(1)
  })

  it('reenviar el MISMO id mientras sigue en curso devuelve la misma respuesta (una sola llamada)', async () => {
    let release: (v: unknown) => void = () => undefined
    script.steps = [() => new Promise((resolve) => (release = resolve))]
    const session = new AgentSession(ctx, null)
    const a = session.send('uno', { requestId: 'a' })
    const b = session.send('uno', { requestId: 'a' })
    await new Promise((r) => setTimeout(r, 5))
    release(ok('una vez'))
    expect(await a).toEqual(await b)
    expect(script.calls).toHaveLength(1)
  })
})

describe('tiempos máximos y cancelación', () => {
  it('una llamada colgada no deja esperando indefinidamente: termina con "timeout"', async () => {
    AgentSession.tuning = { retry: { ...fast, timeoutMs: 20, maxAttempts: 2 }, toolTimeoutMs: 50 }
    script.steps = [() => new Promise(() => undefined), () => new Promise(() => undefined)]
    const started = Date.now()
    const err = (await new AgentSession(ctx, null).send('hola').catch((e) => e)) as AgentUnavailableError
    expect(err.reason).toBe('timeout')
    expect(err.attempts).toBe(2)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('el usuario puede detener la respuesta: sin reintentos y con motivo "cancelado"', async () => {
    script.steps = [() => new Promise(() => undefined)]
    const controller = new AbortController()
    const promise = new AgentSession(ctx, null).send('hola', { signal: controller.signal })
    setTimeout(() => controller.abort(), 10)
    const err = (await promise.catch((e) => e)) as AgentUnavailableError
    expect(err.reason).toBe('cancelled')
    expect(script.calls).toHaveLength(1)
  })

  it('una herramienta colgada (OpenStreetMap lento) no bloquea: el modelo recibe el aviso y responde', async () => {
    runToolMock.mockImplementation(() => new Promise(() => undefined))
    script.steps = [() => ok('', { functionCalls: [{ name: 'find_places', args: {} }] }), (request) => {
      const text = JSON.stringify(request)
      expect(text).toContain('tardó demasiado')
      return ok('No pude consultar los lugares ahora.')
    }]
    const reply = await new AgentSession(ctx, null).send('lugares')
    expect(reply.text).toBe('No pude consultar los lugares ahora.')
    expect(getAgentLog().some((e) => e.kind === 'tool' && e.status === 'timeout')).toBe(true)
  })

  it('el modelo que pide herramientas sin parar se corta y se le pide cerrar con lo reunido', async () => {
    runToolMock.mockResolvedValue({ result: { ok: true } })
    const loop = () => ok('', { functionCalls: [{ name: 'get_weather', args: {} }] })
    script.steps = [loop, loop, loop, loop, loop, loop, () => ok('Con lo que tengo: soleado.')]
    const reply = await new AgentSession(ctx, null).send('clima')
    expect(reply.text).toBe('Con lo que tengo: soleado.')
  })
})

describe('respuestas vacías', () => {
  it('MAX_TOKENS sin texto: pide un cierre breve en vez de quedarse mudo', async () => {
    script.steps = [() => ok('', { finishReason: 'MAX_TOKENS' }), () => ok('Resumen corto.')]
    const reply = await new AgentSession(ctx, null).send('itinerario largo')
    expect(reply.text).toBe('Resumen corto.')
  })

  it('si sigue vacío, devuelve un mensaje claro (no un silencio)', async () => {
    script.steps = [() => ok(''), () => ok('')]
    const reply = await new AgentSession(ctx, null).send('hola')
    expect(reply.text.length).toBeGreaterThan(10)
  })
})

describe('idioma', () => {
  it('el prompt incluye las reglas multilingües con el idioma de la interfaz', () => {
    const de = buildSystemInstruction('2026-12-01', null, 'de')
    expect(de).toContain('German')
    expect(de).toContain('LATEST message')
    expect(buildSystemInstruction('2026-12-01', null, 'pt')).toContain('Portuguese')
    expect(buildSystemInstruction('2026-12-01', null)).toContain('Spanish')
  })

  it('cambiar de idioma conserva el historial de la conversación', async () => {
    script.steps = [() => ok('Hola')]
    const session = new AgentSession(ctx, null, [], 'es')
    await session.send('hola')
    await session.setLanguage('en')
    expect(script.lastSystemInstruction).toContain('English')
    expect(script.chatsCreated).toBeGreaterThanOrEqual(2)
    script.steps = [() => ok('Sure')]
    expect((await session.send('and tomorrow?')).text).toBe('Sure')
  })
})

describe('toHistory', () => {
  it('ignora los mensajes de error de la interfaz y mantiene la alternancia', () => {
    const history = toHistory([
      { role: 'user', text: 'hola' },
      { role: 'model', text: 'No pude responder', error: true },
      { role: 'user', text: 'otra vez' },
      { role: 'model', text: 'Aquí estoy' },
      { role: 'user', text: 'pendiente' },
    ])
    expect(history.map((h) => h.role)).toEqual(['user', 'model'])
    expect((history[0].parts[0] as { text: string }).text).toBe('hola')
  })
})
