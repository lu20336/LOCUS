import { describe, expect, it } from 'vitest'
import { demoGateway } from '../payments'
import { loadSubscriptions, saveSubscriptions } from '../planStore'
import {
  ALL_PLANS,
  COUPONS,
  GUEST_FEATURES,
  GUEST_PLANS,
  HOST_FEATURES,
  HOST_PLANS,
  createSubscription,
  findPlan,
  firstChargeCOP,
  parseSubscription,
  priceFor,
  referralCode,
  settleSubscription,
  validateCoupon,
} from '../plans'

const plus = findPlan('guest-plus')!
const premium = findPlan('guest-premium')!
const hostPro = findPlan('host-pro')!
const free = findPlan('guest-free')!

describe('catálogo de planes', () => {
  it('tiene tres planes por audiencia, con ids únicos y el gratuito primero', () => {
    expect(GUEST_PLANS).toHaveLength(3)
    expect(HOST_PLANS).toHaveLength(3)
    expect(new Set(ALL_PLANS.map((p) => p.id)).size).toBe(6)
    expect(GUEST_PLANS[0].monthlyCOP).toBe(0)
    expect(HOST_PLANS[0].monthlyCOP).toBe(0)
  })

  it('los precios suben con el plan y el anual siempre sale más barato que 12 meses', () => {
    for (const group of [GUEST_PLANS, HOST_PLANS]) {
      expect(group[1].monthlyCOP).toBeGreaterThan(group[0].monthlyCOP)
      expect(group[2].monthlyCOP).toBeGreaterThan(group[1].monthlyCOP)
      for (const p of group.slice(1)) expect(p.annualCOP).toBeLessThan(p.monthlyCOP * 12)
    }
  })

  it('la comisión de los anfitriones baja a medida que sube el plan', () => {
    const [a, b, c] = HOST_PLANS.map((p) => p.commissionPct!)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('la tabla de comparación tiene un valor por cada plan', () => {
    for (const row of [...GUEST_FEATURES, ...HOST_FEATURES]) expect(row.values).toHaveLength(3)
  })

  it('el plan gratuito incluye las funciones esenciales y nunca limita reservas ni seguridad', () => {
    const essential = GUEST_FEATURES.filter((r) => /Explorar|Comparador|Favoritos/.test(r.label))
    expect(essential.length).toBeGreaterThanOrEqual(3)
    for (const row of essential) expect(row.values[0]).toBeTruthy()
    expect([...GUEST_FEATURES, ...HOST_FEATURES].some((r) => /reserva(?!s)\b.*límite|seguridad|privacidad/i.test(r.label))).toBe(false)
  })
})

describe('priceFor', () => {
  it('mensual: sin ahorro', () => {
    expect(priceFor(plus, 'monthly')).toEqual({ perMonthCOP: 14_900, periodCOP: 14_900, annualSavingsCOP: 0, annualSavingsPct: 0 })
  })

  it('anual: equivale a unos 10 meses (ahorro ~17 %)', () => {
    const p = priceFor(plus, 'annual')
    expect(p.periodCOP).toBe(149_000)
    expect(p.perMonthCOP).toBe(12_417)
    expect(p.annualSavingsCOP).toBe(29_800)
    expect(p.annualSavingsPct).toBe(17)
  })

  it('el plan gratuito no tiene ahorro ni precio', () => {
    expect(priceFor(free, 'annual')).toEqual({ perMonthCOP: 0, periodCOP: 0, annualSavingsCOP: 0, annualSavingsPct: 0 })
  })
})

describe('cupones', () => {
  it('es insensible a mayúsculas y espacios', () => {
    expect(validateCoupon(' lanzamiento 30 ', plus)).toMatchObject({ ok: true })
  })

  it('rechaza códigos desconocidos, planes gratuitos y planes de otra audiencia', () => {
    expect(validateCoupon('NOEXISTE', plus)).toEqual({ ok: false, reason: 'unknown' })
    expect(validateCoupon('LANZAMIENTO30', free)).toEqual({ ok: false, reason: 'free-plan' })
    expect(validateCoupon('AMIGO20', hostPro)).toEqual({ ok: false, reason: 'not-applicable' })
    expect(validateCoupon('FUNDADOR', plus)).toEqual({ ok: false, reason: 'not-applicable' })
    expect(validateCoupon('FUNDADOR', findPlan('host-business')!)).toEqual({ ok: false, reason: 'not-applicable' })
  })

  it('todos los cupones son de demostración válidos (1-100 % y al menos un mes)', () => {
    for (const c of COUPONS) {
      expect(c.percentOff).toBeGreaterThan(0)
      expect(c.percentOff).toBeLessThanOrEqual(100)
      expect(c.months).toBeGreaterThanOrEqual(1)
    }
  })

  it('el primer cobro aplica el descuento solo a los meses que cubre', () => {
    const lanzamiento = COUPONS.find((c) => c.code === 'LANZAMIENTO30')!
    expect(firstChargeCOP(plus, 'monthly')).toBe(14_900)
    expect(firstChargeCOP(plus, 'monthly', lanzamiento)).toBe(10_430) // 30 % de un mes
    expect(firstChargeCOP(plus, 'annual', lanzamiento)).toBe(Math.round(149_000 - (149_000 / 12) * 3 * 0.3))
    expect(firstChargeCOP(hostPro, 'monthly', COUPONS.find((c) => c.code === 'FUNDADOR')!)).toBe(0)
  })
})

describe('suscripción', () => {
  it('una prueba gratuita empieza "en prueba" y vence a los días del plan', () => {
    const sub = createSubscription(plus, 'monthly', '2026-12-01', { trial: true })
    expect(sub).toMatchObject({ status: 'trialing', trialEndsAt: '2026-12-15', demo: true })
  })

  it('sin prueba queda activa; un plan sin prueba (Free) ignora la prueba', () => {
    expect(createSubscription(plus, 'annual', '2026-12-01').status).toBe('active')
    expect(createSubscription(free, 'monthly', '2026-12-01', { trial: true }).status).toBe('active')
  })

  it('al vencer la prueba pasa a activa', () => {
    const sub = createSubscription(premium, 'monthly', '2026-12-01', { trial: true })
    expect(settleSubscription(sub, '2026-12-15').status).toBe('trialing')
    expect(settleSubscription(sub, '2026-12-16').status).toBe('active')
  })

  it('parseSubscription descarta datos corruptos o de planes que no existen', () => {
    const good = createSubscription(plus, 'monthly', '2026-12-01')
    expect(parseSubscription(good)).toEqual(good)
    expect(parseSubscription(null)).toBeNull()
    expect(parseSubscription({ ...good, planId: 'otro' })).toBeNull()
    expect(parseSubscription({ ...good, audience: 'host' })).toBeNull()
    expect(parseSubscription({ ...good, interval: 'weekly' })).toBeNull()
    expect(parseSubscription({ ...good, startedAt: 'ayer' })).toBeNull()
  })

  it('el código de referido es estable y no filtra el uid completo', () => {
    expect(referralCode('abc123xyz789')).toBe('LOCUS-ABC123')
    expect(referralCode('abc123xyz789')).toBe(referralCode('abc123xyz789'))
    expect(referralCode('a')).toBe('LOCUS-AXXXXX')
  })
})

describe('pasarela demostrativa', () => {
  it('nunca cobra: con prueba el cobro es 0 y la suscripción queda en prueba', async () => {
    const r = await demoGateway.checkout({ plan: plus, interval: 'monthly', trial: true, today: '2026-12-01' })
    expect(demoGateway.mode).toBe('demo')
    expect(r.chargedCOP).toBe(0)
    expect(r.subscription.status).toBe('trialing')
  })

  it('sin prueba informa el primer cobro (con cupón válido) y guarda el código', async () => {
    const r = await demoGateway.checkout({ plan: plus, interval: 'monthly', trial: false, couponCode: 'amigo20', today: '2026-12-01' })
    expect(r.chargedCOP).toBe(11_920)
    expect(r.subscription.couponCode).toBe('AMIGO20')
  })

  it('un cupón inválido se ignora en vez de aplicar un descuento', async () => {
    const r = await demoGateway.checkout({ plan: plus, interval: 'monthly', trial: false, couponCode: 'FUNDADOR', today: '2026-12-01' })
    expect(r.chargedCOP).toBe(14_900)
    expect(r.subscription.couponCode).toBeUndefined()
  })

  it('cancelar marca la suscripción como cancelada', async () => {
    const sub = createSubscription(plus, 'monthly', '2026-12-01')
    expect((await demoGateway.cancel(sub)).status).toBe('cancelled')
  })
})

describe('almacenamiento local', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
  }

  it('guarda y recupera por usuario', () => {
    const storage = memory()
    const sub = createSubscription(plus, 'annual', '2026-12-01')
    saveSubscriptions('u1', { guest: sub }, storage)
    expect(loadSubscriptions('u1', '2026-12-02', storage).guest).toEqual(sub)
    expect(loadSubscriptions('u2', '2026-12-02', storage)).toEqual({})
  })

  it('un JSON roto o una audiencia cruzada no rompen nada', () => {
    const storage = memory()
    storage.setItem('locus:plan:v1:u1', '{no es json')
    expect(loadSubscriptions('u1', '2026-12-02', storage)).toEqual({})
    storage.setItem('locus:plan:v1:u1', JSON.stringify({ guest: createSubscription(hostPro, 'monthly', '2026-12-01') }))
    expect(loadSubscriptions('u1', '2026-12-02', storage)).toEqual({})
  })

  it('sin almacenamiento disponible devuelve vacío y no lanza', () => {
    expect(loadSubscriptions('u1', '2026-12-02', null)).toEqual({})
    expect(() => saveSubscriptions('u1', {}, null)).not.toThrow()
  })
})
