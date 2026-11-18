import { describe, expect, it, vi } from 'vitest'
import { buildLink, handle, parseOrigins, pickCheapest, type CacheLike, type Env } from '../../../../workers/prices/src/handler'
import { fetchFlightReference, livePricesEnabled, parseFlightReference, referenceToQuote } from '../livePrices'

const ORIGIN = 'https://locus-bb57e.firebaseapp.com'
const ENV: Env = { TRAVELPAYOUTS_TOKEN: 'secreto', TRAVELPAYOUTS_MARKER: '12345', ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173/` }
const NOW = () => new Date('2026-11-17T12:00:00Z')

const ticket = (price: number, extra: object = {}) => ({
  price,
  airline: 'AV',
  departure_at: '2026-12-05T08:00:00-05:00',
  return_at: '',
  transfers: 0,
  link: '/search/BOG0512CTG1?t=abc',
  ...extra,
})
const upstreamOk = (data: object[], currency = 'cop') => new Response(JSON.stringify({ success: true, currency, data }), { status: 200 })

function req(path: string, origin: string | null = ORIGIN, method = 'GET') {
  return new Request(`https://worker.test${path}`, { method, headers: origin ? { Origin: origin } : {} })
}

function memoryCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>()
  return {
    store,
    async match(r) {
      const hit = store.get(r.url)
      return hit ? hit.clone() : undefined
    },
    async put(r, res) {
      store.set(r.url, res)
    },
  }
}

describe('worker · validación y seguridad', () => {
  it('rechaza orígenes no permitidos y peticiones sin origen', async () => {
    const fetchFn = vi.fn()
    expect((await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05', 'https://malo.example'), ENV, { fetchFn, now: NOW })).status).toBe(403)
    expect((await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05', null), ENV, { fetchFn, now: NOW })).status).toBe(403)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('acepta el origen aunque la lista traiga una barra final', async () => {
    const fetchFn = vi.fn().mockResolvedValue(upstreamOk([ticket(300_000)]))
    const res = await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05', 'http://localhost:5173'), ENV, { fetchFn, now: NOW })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it.each([
    ['códigos inválidos', '/flights?origin=BO&destination=CTG&date=2026-12-05'],
    ['mismo origen y destino', '/flights?origin=BOG&destination=BOG&date=2026-12-05'],
    ['fecha inválida', '/flights?origin=BOG&destination=CTG&date=2026-13-45'],
    ['fecha pasada', '/flights?origin=BOG&destination=CTG&date=2026-11-01'],
    ['fecha muy lejana', '/flights?origin=BOG&destination=CTG&date=2028-01-01'],
    ['regreso anterior a la ida', '/flights?origin=BOG&destination=CTG&date=2026-12-05&return=2026-12-01'],
  ])('400 con %s', async (_n, path) => {
    const fetchFn = vi.fn()
    const res = await handle(req(path), ENV, { fetchFn, now: NOW })
    expect(res.status).toBe(400)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('sin token configurado responde 503 y /health lo indica', async () => {
    const noToken: Env = { ALLOWED_ORIGINS: ORIGIN }
    expect((await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05'), noToken, { now: NOW })).status).toBe(503)
    const health = await handle(req('/health', null), noToken, { now: NOW })
    expect(await health.json()).toMatchObject({ ok: true, configured: false })
  })

  it('el token viaja en la cabecera, no en la URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(upstreamOk([ticket(300_000)]))
    await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05'), ENV, { fetchFn, now: NOW })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('secreto')
    expect((init.headers as Record<string, string>)['X-Access-Token']).toBe('secreto')
    expect(url).toContain('currency=cop')
  })

  it('responde a OPTIONS (preflight) solo a orígenes permitidos', async () => {
    expect((await handle(req('/flights', ORIGIN, 'OPTIONS'), ENV, { now: NOW })).status).toBe(204)
    expect((await handle(req('/flights', 'https://malo.example', 'OPTIONS'), ENV, { now: NOW })).status).toBe(403)
  })
})

describe('worker · lógica de precios', () => {
  it('devuelve el boleto más barato, normalizado, con enlace a Aviasales y marker', async () => {
    const fetchFn = vi.fn().mockResolvedValue(upstreamOk([ticket(450_000), ticket(280_000, { airline: 'P5' })]))
    const res = await handle(req('/flights?origin=bog&destination=ctg&date=2026-12-05'), ENV, { fetchFn, now: NOW })
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({ ok: true, found: true, priceCOP: 280_000, airline: 'P5', matched: 'date' })
    expect(new URL(body.link as string).host).toBe('www.aviasales.com')
    expect(new URL(body.link as string).searchParams.get('marker')).toBe('12345')
    expect(body.returnAt).toBeNull()
  })

  it('si no hay datos ese día, usa el mes y lo declara', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(upstreamOk([])).mockResolvedValueOnce(upstreamOk([ticket(310_000)]))
    const body = (await (await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05'), ENV, { fetchFn, now: NOW })).json()) as Record<string, unknown>
    expect(body).toMatchObject({ found: true, matched: 'month', priceCOP: 310_000 })
    expect(String(fetchFn.mock.calls[1][0])).toContain('departure_at=2026-12&')
  })

  it('sin datos ni en el mes responde found:false', async () => {
    // Cada llamada necesita su propia Response (el cuerpo solo se puede leer una vez).
    const fetchFn = vi.fn().mockImplementation(async () => upstreamOk([]))
    const body = await (await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05'), ENV, { fetchFn, now: NOW })).json()
    expect(body).toMatchObject({ ok: true, found: false })
  })

  it('un error de la API externa da 502, nunca un precio', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('x', { status: 500 }))
    const res = await handle(req('/flights?origin=BOG&destination=CTG&date=2026-12-05'), ENV, { fetchFn, now: NOW })
    expect(res.status).toBe(502)
  })

  it('la segunda consulta igual sale de la caché y no gasta cuota', async () => {
    const cache = memoryCache()
    const fetchFn = vi.fn().mockResolvedValue(upstreamOk([ticket(300_000)]))
    const path = '/flights?origin=BOG&destination=CTG&date=2026-12-05'
    await handle(req(path), ENV, { fetchFn, cache, now: NOW })
    const second = await handle(req(path), ENV, { fetchFn, cache, now: NOW })
    expect(second.headers.get('X-Cache')).toBe('HIT')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})

describe('pickCheapest y buildLink', () => {
  it('descarta monedas distintas a COP (sería un precio falso)', () => {
    expect(pickCheapest({ success: true, currency: 'rub', data: [ticket(100)] }, undefined, 'date', 'x')).toBeNull()
  })
  it('descarta formas inesperadas y precios inválidos', () => {
    expect(pickCheapest(null, undefined, 'date', 'x')).toBeNull()
    expect(pickCheapest({ success: false, data: [] }, undefined, 'date', 'x')).toBeNull()
    expect(pickCheapest({ success: true, data: [{ price: 'barato' }, { price: -5 }, { price: 0 }] }, undefined, 'date', 'x')).toBeNull()
  })
  it('solo acepta enlaces relativos /search y los apunta a aviasales.com', () => {
    expect(buildLink('/search/BOG0512CTG1?t=abc', undefined)).toBe('https://www.aviasales.com/search/BOG0512CTG1?t=abc')
    expect(buildLink('https://malo.example/phishing', '9')).toBe('https://www.aviasales.com/')
    expect(buildLink('//malo.example/x', '9')).toBe('https://www.aviasales.com/')
    expect(buildLink(undefined, undefined)).toBe('https://www.aviasales.com/')
  })
  it('parseOrigins limpia espacios y barras finales', () => {
    expect(parseOrigins(' https://a.com/ , http://b.com ,')).toEqual(['https://a.com', 'http://b.com'])
  })
})

describe('cliente del frontend', () => {
  const good = { ok: true, found: true, priceCOP: 280_000, airline: 'P5', departureAt: '2026-12-05T08:00:00', transfers: 0, matched: 'date', link: 'https://www.aviasales.com/search/X', fetchedAt: '2026-11-17T12:00:00Z' }

  it('está apagado sin URL configurada y no llama a la red', async () => {
    const fetchFn = vi.fn()
    expect(livePricesEnabled('')).toBe(false)
    expect(await fetchFlightReference({ origin: 'BOG', destination: 'CTG', date: '2026-12-05' }, { baseUrl: '', fetchFn })).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('valida y devuelve la referencia', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(good)))
    const ref = await fetchFlightReference({ origin: 'BOG', destination: 'CTG', date: '2026-12-05', returnDate: '2026-12-08' }, { baseUrl: 'https://p.example/', fetchFn })
    expect(ref?.priceCOP).toBe(280_000)
    expect(String(fetchFn.mock.calls[0][0])).toBe('https://p.example/flights?origin=BOG&destination=CTG&date=2026-12-05&return=2026-12-08')
  })

  it.each([
    ['enlace a otro dominio', { ...good, link: 'https://malo.example/x' }],
    ['enlace http', { ...good, link: 'http://www.aviasales.com/x' }],
    ['precio negativo', { ...good, priceCOP: -1 }],
    ['sin datos', { ok: true, found: false, fetchedAt: 'x' }],
    ['matched inválido', { ...good, matched: 'week' }],
  ])('descarta %s', (_n, payload) => {
    expect(parseFlightReference(payload)).toBeNull()
  })

  it('un fallo de red o un HTTP de error devuelven null', async () => {
    expect(await fetchFlightReference({ origin: 'BOG', destination: 'CTG', date: '2026-12-05' }, { baseUrl: 'https://p.example', fetchFn: vi.fn().mockRejectedValue(new Error('x')) })).toBeNull()
    expect(await fetchFlightReference({ origin: 'BOG', destination: 'CTG', date: '2026-12-05' }, { baseUrl: 'https://p.example', fetchFn: vi.fn().mockResolvedValue(new Response('x', { status: 502 })) })).toBeNull()
  })

  it('la libreta multiplica por los pasajeros', () => {
    const ref = parseFlightReference(good)!
    expect(referenceToQuote(ref, 3)).toMatchObject({ providerId: 'aviasales-ref', totalCOP: 840_000, source: 'api' })
  })
})
