/**
 * Perfil del viajero: users/{uid}/travelerProfile/main
 *   declared — respuestas que el usuario dio (solo él las cambia).
 *   inferred — cosas que el agente dedujo de la conversación (el usuario las ve,
 *              puede descartarlas y NUNCA pisan a las declaradas).
 */
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type Firestore, type Timestamp } from 'firebase/firestore'
import type { Answers } from './survey'

export interface InferredItem {
  /** Qué dedujo el agente, en lenguaje natural. */
  text: string
  /** Cuándo (ISO). */
  at: string
}

export interface TravelerProfile {
  declared: Answers
  inferred: Record<string, InferredItem>
  version: number
  completedAt: number | null
  updatedAt: number | null
}

const ref = (db: Firestore, uid: string) => doc(db, 'users', uid, 'travelerProfile', 'main')
const millis = (v: unknown) => (v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null)

export async function loadProfile(db: Firestore, uid: string): Promise<TravelerProfile | null> {
  const snap = await getDoc(ref(db, uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return { declared: d.declared ?? {}, inferred: d.inferred ?? {}, version: d.version ?? 1, completedAt: millis(d.completedAt), updatedAt: millis(d.updatedAt) }
}

/** Guarda las respuestas declaradas (las inferidas se conservan tal cual). */
export async function saveDeclared(db: Firestore, uid: string, declared: Answers, completed: boolean): Promise<void> {
  const current = await getDoc(ref(db, uid))
  const data = current.data()
  await setDoc(ref(db, uid), {
    declared,
    inferred: data?.inferred ?? {},
    version: (data?.version ?? 0) + 1,
    completedAt: completed ? serverTimestamp() : (data?.completedAt ?? null),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Permite al agente registrar una inferencia. Solo toca `inferred`: las
 * respuestas declaradas no se modifican. `key` debe ser corto y estable.
 */
export async function saveInference(db: Firestore, uid: string, key: string, text: string): Promise<void> {
  const safeKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) || 'nota'
  const current = await getDoc(ref(db, uid))
  const data = current.data()
  const inferred = { ...(data?.inferred ?? {}), [safeKey]: { text: text.slice(0, 200), at: new Date().toISOString() } }
  // Máximo 20 inferencias: se descartan las más antiguas.
  const entries = Object.entries(inferred as Record<string, InferredItem>).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 20)
  await setDoc(ref(db, uid), {
    declared: data?.declared ?? {},
    inferred: Object.fromEntries(entries),
    version: (data?.version ?? 0) + 1,
    completedAt: data?.completedAt ?? null,
    updatedAt: serverTimestamp(),
  })
}

export async function dismissInference(db: Firestore, uid: string, key: string): Promise<void> {
  const current = await getDoc(ref(db, uid))
  if (!current.exists()) return
  const data = current.data()
  const inferred = { ...(data.inferred ?? {}) }
  delete inferred[key]
  await setDoc(ref(db, uid), { ...data, inferred, version: (data.version ?? 0) + 1, updatedAt: serverTimestamp() })
}

export const deleteProfile = (db: Firestore, uid: string) => deleteDoc(ref(db, uid))
