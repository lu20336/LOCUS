/**
 * Favoritos del usuario: users/{uid}/favorites/{kind}_{refId}.
 * Una sola suscripción en tiempo real (onSnapshot) para toda la app; los
 * botones de corazón leen de este contexto (cero lecturas extra por tarjeta).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '../auth/authContext'
import { db } from '../firebase/client'

export type FavoriteKind = 'listing' | 'experience' | 'destination' | 'place'

export interface Favorite {
  key: string
  kind: FavoriteKind
  refId: string
  title: string
  subtitle?: string
}

interface FavoritesContextValue {
  favorites: Favorite[]
  isFavorite: (kind: FavoriteKind, refId: string) => boolean
  toggle: (item: Omit<Favorite, 'key'>) => Promise<void>
  /** false si no hay sesión (el botón pide ingresar). */
  available: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

/** Los IDs de Firestore no admiten "/": "node/123" → "node_123". */
export const favoriteKey = (kind: FavoriteKind, refId: string) => `${kind}_${refId.replaceAll('/', '_')}`

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const uid = user?.uid

  useEffect(() => {
    if (!uid) {
      setFavorites([])
      return
    }
    return onSnapshot(
      collection(db, 'users', uid, 'favorites'),
      (snap) => setFavorites(snap.docs.map((d) => ({ key: d.id, ...(d.data() as Omit<Favorite, 'key'>) }))),
      () => setFavorites([]),
    )
  }, [uid])

  const keys = useMemo(() => new Set(favorites.map((f) => f.key)), [favorites])

  const toggle = useCallback(
    async (item: Omit<Favorite, 'key'>) => {
      if (!uid) return
      const key = favoriteKey(item.kind, item.refId)
      const ref = doc(db, 'users', uid, 'favorites', key)
      if (keys.has(key)) await deleteDoc(ref)
      else {
        await setDoc(ref, {
          kind: item.kind,
          refId: item.refId,
          title: item.title.slice(0, 200),
          subtitle: (item.subtitle ?? '').slice(0, 200),
          addedAt: serverTimestamp(),
        })
      }
    },
    [uid, keys],
  )

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, isFavorite: (kind, refId) => keys.has(favoriteKey(kind, refId)), toggle, available: Boolean(uid) }),
    [favorites, keys, toggle, uid],
  )
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext)
  if (!value) throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>')
  return value
}
