/**
 * Acceso a Firestore para el catálogo propio de LOCUS (alojamientos y
 * experiencias publicados por anfitriones). Las lecturas públicas siempre
 * filtran por status == 'published' (así lo exigen las reglas).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore'
import type { Booking, Experience, Listing, ListingCalendar, ListingPhoto } from '../domain/types'

export type CatalogKind = 'listings' | 'experiences'

const toMillis = (value: unknown): number | null =>
  value && typeof (value as Timestamp).toMillis === 'function' ? (value as Timestamp).toMillis() : null

function withId<T>(id: string, data: DocumentData): T {
  return { ...data, id, createdAt: toMillis(data.createdAt), updatedAt: toMillis(data.updatedAt) } as T
}

/** Tope de documentos por consulta pública (control de lecturas de Firestore). */
export const CATALOG_PAGE_SIZE = 120

export async function fetchPublished<T extends Listing | Experience>(db: Firestore, kind: CatalogKind): Promise<T[]> {
  const snap = await getDocs(query(collection(db, kind), where('status', '==', 'published'), limit(CATALOG_PAGE_SIZE)))
  return snap.docs.map((d) => withId<T>(d.id, d.data()))
}

export async function fetchItem<T extends Listing | Experience>(db: Firestore, kind: CatalogKind, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, kind, id))
  return snap.exists() ? withId<T>(snap.id, snap.data()) : null
}

export async function fetchByHost<T extends Listing | Experience>(db: Firestore, kind: CatalogKind, hostId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, kind), where('hostId', '==', hostId), limit(100)))
  return snap.docs.map((d) => withId<T>(d.id, d.data())).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function fetchByStatus<T extends Listing | Experience>(db: Firestore, kind: CatalogKind, status: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, kind), where('status', '==', status), limit(100)))
  return snap.docs.map((d) => withId<T>(d.id, d.data()))
}

export async function fetchPhotos(db: Firestore, kind: CatalogKind, id: string): Promise<ListingPhoto[]> {
  const snap = await getDocs(query(collection(db, kind, id, 'photos'), orderBy('order'), limit(20)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ListingPhoto, 'id'>) }))
}

export async function fetchCalendar(db: Firestore, listingId: string): Promise<ListingCalendar> {
  const snap = await getDoc(doc(db, 'listings', listingId, 'calendar', 'main'))
  const data = snap.data()
  return { booked: data?.booked ?? {}, hostBlocked: data?.hostBlocked ?? {} }
}

export async function fetchSlot(db: Firestore, experienceId: string, slotKey: string): Promise<number> {
  const snap = await getDoc(doc(db, 'experiences', experienceId, 'slots', slotKey))
  return (snap.data()?.booked as number | undefined) ?? 0
}

/** Campos que el formulario del anfitrión controla (el resto lo fija el sistema). */
export type ListingInput = Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'hostId' | 'status' | 'rejectionReason' | 'isTestData'>
export type ExperienceInput = Omit<Experience, 'id' | 'createdAt' | 'updatedAt' | 'hostId' | 'status' | 'rejectionReason' | 'isTestData'>

/**
 * Crea o actualiza un alojamiento/experiencia. `status` solo puede ser
 * 'draft' o 'pending' (las reglas impiden que el anfitrión se auto-publique).
 */
export async function saveItem(
  db: Firestore,
  kind: CatalogKind,
  hostId: string,
  input: ListingInput | ExperienceInput,
  status: 'draft' | 'pending' | 'published',
  existing?: { id: string; createdAt: number | null },
): Promise<string> {
  const ref = existing ? doc(db, kind, existing.id) : doc(collection(db, kind))
  const payload: DocumentData = { ...input, hostId, status, updatedAt: serverTimestamp() }
  if (existing) {
    // Se conserva createdAt original: las reglas exigen que no cambie.
    const current = await getDoc(ref)
    payload.createdAt = current.data()?.createdAt
    if (current.data()?.isTestData) payload.isTestData = true
  } else {
    payload.createdAt = serverTimestamp()
  }
  await setDoc(ref, payload)
  return ref.id
}

export async function replacePhotos(
  db: Firestore,
  kind: CatalogKind,
  id: string,
  photos: { dataUrl: string; alt: string }[],
): Promise<void> {
  const existing = await getDocs(collection(db, kind, id, 'photos'))
  const keep = new Set(photos.map((_, i) => `p${i}`))
  await Promise.all(existing.docs.filter((d) => !keep.has(d.id)).map((d) => deleteDoc(d.ref)))
  await Promise.all(photos.map((p, i) => setDoc(doc(db, kind, id, 'photos', `p${i}`), { order: i, dataUrl: p.dataUrl, alt: p.alt })))
}

export async function setItemStatus(db: Firestore, kind: CatalogKind, id: string, status: string, rejectionReason = ''): Promise<void> {
  await setDoc(doc(db, kind, id), { status, rejectionReason, updatedAt: serverTimestamp() }, { merge: true })
}

export async function deleteItem(db: Firestore, kind: CatalogKind, id: string): Promise<void> {
  const photos = await getDocs(collection(db, kind, id, 'photos'))
  await Promise.all(photos.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, kind, id))
}

// --- Reservas -----------------------------------------------------------

export async function fetchBookings(db: Firestore, role: 'guest' | 'host', uid: string): Promise<Booking[]> {
  const snap = await getDocs(query(collection(db, 'bookings'), where(role === 'guest' ? 'guestId' : 'hostId', '==', uid), limit(200)))
  return snap.docs
    .map((d) => withId<Booking>(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}
