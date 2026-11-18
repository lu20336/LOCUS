/**
 * Puerta de entrada al cobro de suscripciones.
 *
 * Hoy solo existe la versión DEMOSTRATIVA: no mueve dinero, no llama a ningún
 * servicio y no guarda datos de pago. Para activar pagos reales basta con
 * implementar `SubscriptionGateway` con un proveedor (Wompi, PayU, Mercado Pago…)
 * detrás de un servidor y cambiar `gateway` más abajo; la interfaz de planes no
 * necesita tocarse. Pendientes para pagos reales: docs/NEGOCIO.md.
 */
import { createSubscription, firstChargeCOP, validateCoupon, type Interval, type Plan, type Subscription } from './plans'

export interface CheckoutRequest {
  plan: Plan
  interval: Interval
  /** Cupón ya escrito por el usuario (se vuelve a validar aquí). */
  couponCode?: string
  /** Empezar con los días de prueba gratuita del plan. */
  trial: boolean
  /** AAAA-MM-DD */
  today: string
}

export interface CheckoutResult {
  subscription: Subscription
  /** Lo que se cobraría hoy (0 si hay prueba gratuita). En demo NUNCA se cobra. */
  chargedCOP: number
}

export interface SubscriptionGateway {
  /** 'demo' = simulación; 'live' = proveedor de pagos real. */
  readonly mode: 'demo' | 'live'
  checkout(request: CheckoutRequest): Promise<CheckoutResult>
  cancel(subscription: Subscription): Promise<Subscription>
}

export const demoGateway: SubscriptionGateway = {
  mode: 'demo',
  async checkout({ plan, interval, couponCode, trial, today }) {
    const validated = couponCode ? validateCoupon(couponCode, plan) : null
    const coupon = validated?.ok ? validated.coupon : undefined
    const subscription = createSubscription(plan, interval, today, { trial, couponCode: coupon?.code })
    const chargedCOP = subscription.status === 'trialing' ? 0 : firstChargeCOP(plan, interval, coupon)
    // Simula la espera de una pasarela para que la interfaz muestre su estado de "procesando".
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { subscription, chargedCOP }
  },
  async cancel(subscription) {
    return { ...subscription, status: 'cancelled' }
  },
}

/** Cambia aquí el proveedor cuando exista uno real. */
export const gateway: SubscriptionGateway = demoGateway
