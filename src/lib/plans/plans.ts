/**
 * Planes y suscripciones de LOCUS (DEMOSTRATIVOS).
 *
 * ⚠ Los precios son valores de prueba para el mercado colombiano (docs/NEGOCIO.md
 * §Planes): no se cobra nada ni existe pasarela de pago. Los límites de cada plan
 * se muestran pero NO se aplican a funciones esenciales (reservas, seguridad,
 * privacidad). Esta capa es pura: la persistencia y el cobro viven aparte
 * (planStore.ts, payments.ts) para poder conectar un proveedor real después.
 */

export type Audience = 'guest' | 'host'
export type Interval = 'monthly' | 'annual'
export type PlanBadge = 'popular' | 'best-value' | 'recommended'

export interface Plan {
  id: string
  audience: Audience
  name: string
  tagline: string
  /** Precio mensual de prueba (COP). 0 = gratis. */
  monthlyCOP: number
  /** Precio anual de prueba (COP): equivale a ~10 meses (2 gratis). */
  annualCOP: number
  badge?: PlanBadge
  /** Días de prueba gratuita de las funciones de pago (demo). */
  trialDays: number
  /** Comisión de LOCUS por reserva (solo anfitriones, % de prueba). */
  commissionPct?: number
  /** Publicaciones activas incluidas (solo anfitriones; sin valor = ilimitadas). */
  maxListings?: number
  /** Beneficios principales (tarjeta). */
  highlights: string[]
}

export const BADGE_LABEL: Record<PlanBadge, string> = {
  popular: 'Más popular',
  'best-value': 'Mejor valor',
  recommended: 'Recomendado',
}

export const GUEST_PLANS: Plan[] = [
  {
    id: 'guest-free',
    audience: 'guest',
    name: 'LOCUS Free',
    tagline: 'Explora y planea sin costo.',
    monthlyCOP: 0,
    annualCOP: 0,
    trialDays: 0,
    highlights: ['Explora destinos, hospedajes y experiencias', 'Hasta 3 itinerarios guardados', 'Compañero de IA básico', 'Favoritos y comparador de precios'],
  },
  {
    id: 'guest-plus',
    audience: 'guest',
    name: 'LOCUS Plus',
    tagline: 'Para quien viaja varias veces al año.',
    monthlyCOP: 14_900,
    annualCOP: 149_000,
    badge: 'popular',
    trialDays: 14,
    highlights: ['Hasta 20 itinerarios guardados', 'Recomendaciones más personalizadas', 'Más mensajes con el compañero de IA', 'Colecciones de viajes y planificación avanzada'],
  },
  {
    id: 'guest-premium',
    audience: 'guest',
    name: 'LOCUS Premium',
    tagline: 'Toda la experiencia, sin límites.',
    monthlyCOP: 29_900,
    annualCOP: 299_000,
    badge: 'best-value',
    trialDays: 14,
    highlights: ['Itinerarios ilimitados y colaborativos', 'Compañero de IA ampliado', 'Alertas de escapadas y beneficios exclusivos', 'Soporte prioritario'],
  },
]

export const HOST_PLANS: Plan[] = [
  {
    id: 'host-free',
    audience: 'host',
    name: 'Host Free',
    tagline: 'Empieza a recibir viajeros.',
    monthlyCOP: 0,
    annualCOP: 0,
    trialDays: 0,
    commissionPct: 10,
    maxListings: 2,
    highlights: ['Hasta 2 publicaciones', 'Calendario y gestión de reservas', 'Estadísticas básicas', 'Comisión del 10 % por reserva'],
  },
  {
    id: 'host-pro',
    audience: 'host',
    name: 'Host Pro',
    tagline: 'Más visibilidad y mejores herramientas.',
    monthlyCOP: 59_900,
    annualCOP: 599_000,
    badge: 'recommended',
    trialDays: 30,
    commissionPct: 6,
    maxListings: 10,
    highlights: ['Hasta 10 publicaciones', 'Estadísticas completas y reportes mensuales', '1 publicación destacada al mes', 'Comisión reducida del 6 %'],
  },
  {
    id: 'host-business',
    audience: 'host',
    name: 'Host Business',
    tagline: 'Para quien administra varios alojamientos.',
    monthlyCOP: 149_900,
    annualCOP: 1_499_000,
    badge: 'best-value',
    trialDays: 30,
    commissionPct: 4,
    highlights: ['Publicaciones ilimitadas', 'Reportes exportables y automatizaciones', 'Destacados frecuentes y equipo con varios usuarios', 'Comisión reducida del 4 %'],
  },
]

export const ALL_PLANS = [...GUEST_PLANS, ...HOST_PLANS]
export const plansFor = (audience: Audience) => (audience === 'guest' ? GUEST_PLANS : HOST_PLANS)
export const freePlan = (audience: Audience) => plansFor(audience)[0]
export const findPlan = (id: string) => ALL_PLANS.find((p) => p.id === id)

/* ───────────────────────────── Comparación ───────────────────────────── */

/** true/false = incluido o no; texto = valor del plan (ej. "Hasta 3"). */
export type FeatureValue = boolean | string

export interface FeatureRow {
  label: string
  /** Valor por plan, en el mismo orden que plansFor(audience). */
  values: [FeatureValue, FeatureValue, FeatureValue]
  /** Marca las funciones que todavía no existen en LOCUS (se muestran como "Próximamente"). */
  soon?: boolean
}

export const GUEST_FEATURES: FeatureRow[] = [
  { label: 'Explorar destinos, hospedajes y experiencias', values: [true, true, true] },
  { label: 'Comparador de precios entre plataformas', values: [true, true, true] },
  { label: 'Favoritos', values: ['Ilimitados', 'Ilimitados', 'Ilimitados'] },
  { label: 'Itinerarios guardados', values: ['Hasta 3', 'Hasta 20', 'Ilimitados'] },
  { label: 'Mensajes diarios con el compañero de IA', values: ['20', '60', '150'] },
  { label: 'Recomendaciones personalizadas', values: ['Básicas', 'Avanzadas', 'Avanzadas + sorpresa semanal'] },
  { label: 'Planificación avanzada (varios destinos, presupuesto por categoría)', values: [false, true, true] },
  { label: 'Colecciones de viajes', values: [false, true, true], soon: true },
  { label: 'Alertas de escapadas y precios', values: [false, false, true], soon: true },
  { label: 'Itinerarios colaborativos con amigos', values: [false, false, true], soon: true },
  { label: 'Beneficios exclusivos con anfitriones aliados', values: [false, false, true], soon: true },
  { label: 'Soporte prioritario', values: [false, false, true] },
]

export const HOST_FEATURES: FeatureRow[] = [
  { label: 'Publicaciones activas', values: ['Hasta 2', 'Hasta 10', 'Ilimitadas'] },
  { label: 'Calendario, disponibilidad y reservas', values: [true, true, true] },
  { label: 'Fotos y ficha completa', values: [true, true, true] },
  { label: 'Estadísticas', values: ['Básicas', 'Completas', 'Completas + comparativas'] },
  { label: 'Reportes mensuales', values: [false, true, true], soon: true },
  { label: 'Publicaciones destacadas', values: [false, '1 al mes', 'Frecuentes'], soon: true },
  { label: 'Automatizaciones (mensajes, bloqueos)', values: [false, false, true], soon: true },
  { label: 'Equipo con varios usuarios', values: [false, false, true], soon: true },
  { label: 'Comisión por reserva confirmada', values: ['10 %', '6 %', '4 %'] },
  { label: 'Soporte prioritario', values: [false, false, true] },
]

export const featuresFor = (audience: Audience) => (audience === 'guest' ? GUEST_FEATURES : HOST_FEATURES)

/* ───────────────────────────── Precios y promociones ───────────────────────────── */

export interface Coupon {
  code: string
  label: string
  /** Porcentaje de descuento (1-100). */
  percentOff: number
  /** Cuántos meses dura el descuento. */
  months: number
  audience: Audience | 'all'
  /** Solo para estos planes (vacío = todos los de pago). */
  planIds?: string[]
}

/** Cupones DEMOSTRATIVOS (no generan ninguna obligación de pago). */
export const COUPONS: Coupon[] = [
  { code: 'LANZAMIENTO30', label: '30 % de descuento los primeros 3 meses (promoción de lanzamiento)', percentOff: 30, months: 3, audience: 'all' },
  { code: 'AMIGO20', label: '20 % de descuento el primer mes (invitación de un amigo)', percentOff: 20, months: 1, audience: 'guest' },
  { code: 'FUNDADOR', label: 'Host Pro gratis los primeros 3 meses (Anfitriones Fundadores)', percentOff: 100, months: 3, audience: 'host', planIds: ['host-pro'] },
]

export const normalizeCoupon = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

export type CouponResult = { ok: true; coupon: Coupon } | { ok: false; reason: 'unknown' | 'not-applicable' | 'free-plan' }

export function validateCoupon(code: string, plan: Plan): CouponResult {
  const coupon = COUPONS.find((c) => c.code === normalizeCoupon(code))
  if (!coupon) return { ok: false, reason: 'unknown' }
  if (plan.monthlyCOP === 0) return { ok: false, reason: 'free-plan' }
  if (coupon.audience !== 'all' && coupon.audience !== plan.audience) return { ok: false, reason: 'not-applicable' }
  if (coupon.planIds && !coupon.planIds.includes(plan.id)) return { ok: false, reason: 'not-applicable' }
  return { ok: true, coupon }
}

export const COUPON_ERRORS: Record<Extract<CouponResult, { ok: false }>['reason'], string> = {
  unknown: 'Ese código no existe.',
  'not-applicable': 'Ese código no aplica para este plan.',
  'free-plan': 'El plan gratuito no necesita código.',
}

export interface Price {
  /** Precio regular por mes, equivalente (anual / 12). */
  perMonthCOP: number
  /** Lo que se cobraría por el periodo elegido (mes o año), sin cupón. */
  periodCOP: number
  /** Cuánto se ahorra al pagar anual frente a 12 meses (0 en mensual). */
  annualSavingsCOP: number
  /** % que se ahorra al pagar anual, redondeado (0 en mensual). */
  annualSavingsPct: number
}

export function priceFor(plan: Plan, interval: Interval): Price {
  const yearAtMonthly = plan.monthlyCOP * 12
  if (interval === 'annual') {
    const saving = Math.max(0, yearAtMonthly - plan.annualCOP)
    return {
      perMonthCOP: Math.round(plan.annualCOP / 12),
      periodCOP: plan.annualCOP,
      annualSavingsCOP: saving,
      annualSavingsPct: yearAtMonthly > 0 ? Math.round((saving / yearAtMonthly) * 100) : 0,
    }
  }
  return { perMonthCOP: plan.monthlyCOP, periodCOP: plan.monthlyCOP, annualSavingsCOP: 0, annualSavingsPct: 0 }
}

/** Primer cobro (demostrativo) con cupón: el descuento aplica solo si cubre el periodo elegido. */
export function firstChargeCOP(plan: Plan, interval: Interval, coupon?: Coupon): number {
  const { periodCOP } = priceFor(plan, interval)
  if (!coupon) return periodCOP
  const monthsCovered = interval === 'annual' ? 12 : 1
  const discountedMonths = Math.min(coupon.months, monthsCovered)
  const monthly = periodCOP / monthsCovered
  const discount = monthly * discountedMonths * (coupon.percentOff / 100)
  return Math.max(0, Math.round(periodCOP - discount))
}

/* ───────────────────────────── Suscripción (estado) ───────────────────────────── */

export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled'

export interface Subscription {
  audience: Audience
  planId: string
  interval: Interval
  status: SubscriptionStatus
  /** AAAA-MM-DD */
  startedAt: string
  trialEndsAt?: string
  couponCode?: string
  /** Siempre true mientras no exista una pasarela de pago real. */
  demo: true
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Activa',
  trialing: 'En prueba gratuita',
  cancelled: 'Cancelada',
}

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Nueva suscripción demostrativa. Con `trial`, empieza con los días de prueba del plan. */
export function createSubscription(plan: Plan, interval: Interval, today: string, options: { trial?: boolean; couponCode?: string } = {}): Subscription {
  const trial = Boolean(options.trial) && plan.trialDays > 0
  return {
    audience: plan.audience,
    planId: plan.id,
    interval,
    status: trial ? 'trialing' : 'active',
    startedAt: today,
    ...(trial ? { trialEndsAt: addDaysISO(today, plan.trialDays) } : {}),
    ...(options.couponCode ? { couponCode: options.couponCode } : {}),
    demo: true,
  }
}

/** Una prueba que ya venció pasa a "activa" (en producción lo decidiría el proveedor de pagos). */
export function settleSubscription(sub: Subscription, today: string): Subscription {
  if (sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt < today) return { ...sub, status: 'active' }
  return sub
}

/** Validación de lo leído del almacenamiento local (puede estar corrupto o ser de otra versión). */
export function parseSubscription(value: unknown): Subscription | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const plan = typeof v.planId === 'string' ? findPlan(v.planId) : undefined
  if (!plan || v.audience !== plan.audience) return null
  if (v.interval !== 'monthly' && v.interval !== 'annual') return null
  if (v.status !== 'active' && v.status !== 'trialing' && v.status !== 'cancelled') return null
  if (typeof v.startedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.startedAt)) return null
  return {
    audience: plan.audience,
    planId: plan.id,
    interval: v.interval,
    status: v.status,
    startedAt: v.startedAt,
    ...(typeof v.trialEndsAt === 'string' ? { trialEndsAt: v.trialEndsAt } : {}),
    ...(typeof v.couponCode === 'string' ? { couponCode: v.couponCode } : {}),
    demo: true,
  }
}

/** Código de referido de ejemplo: estable por usuario, sin datos personales. */
export const referralCode = (uid: string) => `LOCUS-${uid.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X')}`
