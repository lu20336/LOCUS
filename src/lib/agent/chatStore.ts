/**
 * Persistencia de conversaciones con el agente (solo usuarios con sesión):
 * users/{uid}/agentChats/{chatId}/messages. Privado: solo el dueño las lee.
 * También el tope diario de mensajes (control de costos de la cuota gratuita).
 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore, type Timestamp,
} from 'firebase/firestore'
import { getT } from '../i18n/store'
import type { AgentCard, ChatMessage } from './types'

export const DAILY_MESSAGE_LIMIT = 60
const ANON_SESSION_LIMIT = 12

export class UsageLimitError extends Error {}

/** Cuenta un mensaje del día. Lanza UsageLimitError al pasar el tope. */
export async function countMessage(db: Firestore, uid: string | null, today: string): Promise<void> {
  if (!uid) {
    let used = 0
    try {
      used = Number(sessionStorage.getItem('locus:agent:anon') ?? '0')
      if (used >= ANON_SESSION_LIMIT) throw new UsageLimitError(getT()('agent.limit.anon'))
      sessionStorage.setItem('locus:agent:anon', String(used + 1))
    } catch (e) {
      if (e instanceof UsageLimitError) throw e
    }
    return
  }
  const ref = doc(db, 'users', uid, 'agentUsage', today)
  const snap = await getDoc(ref)
  const count = (snap.data()?.count as number | undefined) ?? 0
  if (count >= DAILY_MESSAGE_LIMIT) throw new UsageLimitError(getT()('agent.limit.daily', { limit: DAILY_MESSAGE_LIMIT }))
  await setDoc(ref, { count: count + 1 })
}

/** Las tarjetas guardadas omiten datos pesados (el itinerario completo se vuelve a pedir si hace falta). */
function slimCards(cards: AgentCard[] | undefined): unknown[] {
  return (cards ?? [])
    .filter((c) => c.kind !== 'itinerary')
    .slice(0, 8)
    // Las portadas (data URL) no se guardan: se evitan documentos enormes.
    .map((c) => JSON.parse(JSON.stringify(c, (key, v) => (key === 'cover' ? undefined : v === undefined ? null : v))))
}

export async function createChat(db: Firestore, uid: string, title: string): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'agentChats'))
  await setDoc(ref, { title: title.slice(0, 100) || 'Conversación', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export async function appendMessage(db: Firestore, uid: string, chatId: string, message: Pick<ChatMessage, 'role' | 'text' | 'cards'>): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'agentChats', chatId, 'messages'), {
    role: message.role,
    text: message.text.slice(0, 11000) || '…',
    cards: slimCards(message.cards),
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'users', uid, 'agentChats', chatId), { updatedAt: serverTimestamp() }).catch(() => undefined)
}

export interface ChatSummary {
  id: string
  title: string
  updatedAt: number | null
}

export async function listChats(db: Firestore, uid: string): Promise<ChatSummary[]> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'agentChats'), limit(30)))
  return snap.docs
    .map((d) => ({ id: d.id, title: String(d.data().title ?? 'Conversación'), updatedAt: (d.data().updatedAt as Timestamp | undefined)?.toMillis() ?? null }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function loadMessages(db: Firestore, uid: string, chatId: string): Promise<ChatMessage[]> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'agentChats', chatId, 'messages'), orderBy('createdAt'), limit(200)))
  return snap.docs.map((d) => ({ id: d.id, role: d.data().role, text: d.data().text, cards: d.data().cards ?? [] }))
}

export async function deleteChat(db: Firestore, uid: string, chatId: string): Promise<void> {
  const messages = await getDocs(collection(db, 'users', uid, 'agentChats', chatId, 'messages'))
  await Promise.all(messages.docs.map((m) => deleteDoc(m.ref)))
  await deleteDoc(doc(db, 'users', uid, 'agentChats', chatId))
}

export async function deleteAllChats(db: Firestore, uid: string): Promise<number> {
  const chats = await getDocs(collection(db, 'users', uid, 'agentChats'))
  await Promise.all(chats.docs.map((c) => deleteChat(db, uid, c.id)))
  return chats.size
}
