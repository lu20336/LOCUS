/**
 * Itinerarios guardados por el usuario: users/{uid}/itineraries/{id}.
 * Son privados (reglas: solo el dueño). Se pueden editar: quitar o mover lugares
 * entre días y anotar notas.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, type Firestore, type Timestamp } from 'firebase/firestore'
import type { DayPlan, Destination, Itinerary, Place } from '../../types/itinerary'

export interface SavedItinerary {
  id: string
  title: string
  destination: Destination
  startDate: string
  endDate: string
  budgetCOP: number
  travelers: number
  days: (DayPlan & { note?: string })[]
  notes: string
  source: 'planner' | 'agent'
  createdAt: number | null
  updatedAt: number | null
}

const millis = (v: unknown) => (v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null)

export function itineraryTitle(itinerary: Pick<Itinerary, 'destination'>): string {
  return `Viaje a ${itinerary.destination.displayName.split(',')[0]}`
}

type Payload = Omit<SavedItinerary, 'id' | 'createdAt' | 'updatedAt'>

export function toPayload(itinerary: Itinerary, travelers: number, source: 'planner' | 'agent'): Payload {
  return {
    title: itineraryTitle(itinerary),
    destination: itinerary.destination,
    startDate: itinerary.input.startDate,
    endDate: itinerary.input.endDate,
    budgetCOP: itinerary.input.budgetCOP,
    travelers,
    days: itinerary.days,
    notes: '',
    source,
  }
}

export async function saveNewItinerary(db: Firestore, uid: string, payload: Payload): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'itineraries'))
  await setDoc(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export async function updateItinerary(db: Firestore, uid: string, saved: SavedItinerary): Promise<void> {
  const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = saved
  const current = await getDoc(doc(db, 'users', uid, 'itineraries', id))
  await setDoc(doc(db, 'users', uid, 'itineraries', id), { ...payload, createdAt: current.data()?.createdAt, updatedAt: serverTimestamp() })
}

export async function listItineraries(db: Firestore, uid: string): Promise<SavedItinerary[]> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'itineraries'), limit(100)))
  return snap.docs
    .map((d) => ({ ...(d.data() as Payload), id: d.id, createdAt: millis(d.data().createdAt), updatedAt: millis(d.data().updatedAt) }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function getItinerary(db: Firestore, uid: string, id: string): Promise<SavedItinerary | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'itineraries', id))
  if (!snap.exists()) return null
  return { ...(snap.data() as Payload), id: snap.id, createdAt: millis(snap.data().createdAt), updatedAt: millis(snap.data().updatedAt) }
}

export const removeItinerary = (db: Firestore, uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'itineraries', id))

// --- Edición (funciones puras) -----------------------------------------------

type Editable = { days: (DayPlan & { note?: string })[] }

export function removePlace<T extends Editable>(it: T, dayIndex: number, placeIndex: number): T {
  return { ...it, days: it.days.map((d, i) => (i === dayIndex ? { ...d, places: d.places.filter((_, j) => j !== placeIndex) } : d)) }
}

/** Mueve un lugar a otra posición del mismo día o a otro día (al final). */
export function movePlace<T extends Editable>(it: T, from: { day: number; place: number }, to: { day: number; place?: number }): T {
  const place: Place | undefined = it.days[from.day]?.places[from.place]
  if (!place || !it.days[to.day]) return it
  const days = it.days.map((d) => ({ ...d, places: [...d.places] }))
  days[from.day].places.splice(from.place, 1)
  const target = days[to.day].places
  target.splice(to.place === undefined ? target.length : Math.min(Math.max(to.place, 0), target.length), 0, place)
  return { ...it, days }
}

export function setDayNote<T extends Editable>(it: T, dayIndex: number, note: string): T {
  return { ...it, days: it.days.map((d, i) => (i === dayIndex ? { ...d, note: note.slice(0, 500) } : d)) }
}
