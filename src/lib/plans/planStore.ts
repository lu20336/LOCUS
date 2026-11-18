/**
 * Dónde se guarda el plan elegido (DEMO): localStorage del navegador, por
 * usuario. No toca Firestore ni sus reglas a propósito: mientras los planes sean
 * demostrativos no hay datos que deban vivir en el servidor. Al conectar pagos
 * reales, la fuente de verdad pasa al proveedor/servidor y este módulo se
 * reemplaza por una lectura de su estado.
 */
import { parseSubscription, settleSubscription, type Audience, type Subscription } from './plans'

export type Subscriptions = Partial<Record<Audience, Subscription>>

const key = (uid: string) => `locus:plan:v1:${uid}`

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadSubscriptions(uid: string, today: string, storage: StorageLike | null = defaultStorage()): Subscriptions {
  try {
    const raw = storage?.getItem(key(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const result: Subscriptions = {}
    for (const audience of ['guest', 'host'] as const) {
      const sub = parseSubscription((parsed as Record<string, unknown>)?.[audience])
      if (sub && sub.audience === audience) result[audience] = settleSubscription(sub, today)
    }
    return result
  } catch {
    return {}
  }
}

export function saveSubscriptions(uid: string, subs: Subscriptions, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(key(uid), JSON.stringify(subs))
  } catch {
    // Almacenamiento bloqueado (modo privado): el plan funciona en esta sesión y no se recuerda.
  }
}
