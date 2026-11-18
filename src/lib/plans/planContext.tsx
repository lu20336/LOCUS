/**
 * Estado del plan del usuario para toda la app (insignia en el menú, página de
 * planes, panel de Host). Demostrativo: ver payments.ts y planStore.ts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { todayISO } from '../format'
import { gateway, type CheckoutResult } from './payments'
import { loadSubscriptions, saveSubscriptions, type Subscriptions } from './planStore'
import { findPlan, freePlan, type Audience, type Interval, type Plan, type Subscription } from './plans'

interface PlanContextValue {
  /** Plan vigente por audiencia (Free si no eligió ninguno o canceló). */
  planFor: (audience: Audience) => Plan
  subscriptionFor: (audience: Audience) => Subscription | null
  /** Cambia de plan (simulado). Devuelve lo que se habría cobrado. */
  choose: (plan: Plan, interval: Interval, options?: { couponCode?: string; trial?: boolean }) => Promise<CheckoutResult>
  cancel: (audience: Audience) => Promise<void>
  demo: boolean
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [subs, setSubs] = useState<Subscriptions>({})

  useEffect(() => {
    setSubs(uid ? loadSubscriptions(uid, todayISO()) : {})
  }, [uid])

  const persist = useCallback(
    (next: Subscriptions) => {
      setSubs(next)
      if (uid) saveSubscriptions(uid, next)
    },
    [uid],
  )

  const value = useMemo<PlanContextValue>(() => {
    const subscriptionFor = (audience: Audience) => {
      const sub = subs[audience]
      return sub && sub.status !== 'cancelled' ? sub : null
    }
    return {
      demo: gateway.mode === 'demo',
      subscriptionFor,
      planFor: (audience) => {
        const sub = subscriptionFor(audience)
        return (sub && findPlan(sub.planId)) || freePlan(audience)
      },
      async choose(plan, interval, options = {}) {
        const result = await gateway.checkout({ plan, interval, couponCode: options.couponCode, trial: Boolean(options.trial), today: todayISO() })
        // Elegir el plan gratuito equivale a volver a Free (no queda suscripción activa).
        const next = { ...subs }
        if (plan.monthlyCOP === 0) delete next[plan.audience]
        else next[plan.audience] = result.subscription
        persist(next)
        return result
      },
      async cancel(audience) {
        const current = subs[audience]
        if (!current) return
        persist({ ...subs, [audience]: await gateway.cancel(current) })
      },
    }
  }, [subs, persist])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

/** Plan actual y acciones. Fuera del proveedor devuelve Free (útil en pruebas). */
export function usePlans(): PlanContextValue {
  const value = useContext(PlanContext)
  if (value) return value
  return {
    demo: true,
    planFor: (audience) => freePlan(audience),
    subscriptionFor: () => null,
    choose: async () => {
      throw new Error('usePlans debe usarse dentro de <PlanProvider>')
    },
    cancel: async () => {},
  }
}
