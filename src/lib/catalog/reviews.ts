import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where, type Firestore, type Timestamp } from 'firebase/firestore'

export interface Review {
  id: string
  kind: 'listing' | 'experience'
  itemId: string
  guestId: string
  guestName: string
  rating: number
  text: string
  createdAt: number | null
}

export async function fetchReviews(db: Firestore, itemId: string): Promise<Review[]> {
  const snap = await getDocs(query(collection(db, 'reviews'), where('itemId', '==', itemId), limit(50)))
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Review, 'id' | 'createdAt'>), id: d.id, createdAt: (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? null }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export const averageRating = (reviews: readonly Pick<Review, 'rating'>[]): number | null =>
  reviews.length === 0 ? null : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10

/** Una reseña por reserva completada (el ID del documento es el de la reserva). */
export async function submitReview(
  db: Firestore,
  bookingId: string,
  review: { kind: 'listing' | 'experience'; itemId: string; guestId: string; guestName: string; rating: number; text: string },
): Promise<void> {
  await setDoc(doc(db, 'reviews', bookingId), { ...review, text: review.text.trim().slice(0, 2000), createdAt: serverTimestamp() })
}
