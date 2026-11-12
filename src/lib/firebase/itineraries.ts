/**
 * Persistencia de itinerarios en Firestore (colección "itineraries").
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import type { Itinerary } from '../../types/itinerary'
import { db, ensureAnonymousUser } from './client'

/** Guarda el itinerario asociado a la sesión anónima y devuelve su ID. */
export async function saveItinerary(itinerary: Itinerary): Promise<string> {
  const user = await ensureAnonymousUser()
  const ref = await addDoc(collection(db, 'itineraries'), {
    ...itinerary,
    uid: user.uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
