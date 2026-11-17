import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/client'
import { AuthContext, type AuthContextValue, type HostProfileInput, type UserProfile } from './authContext'

const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  phone: '',
  onboardingCompleted: false,
  onboardingSkipped: false,
  aiPersonalization: false,
  isHost: false,
}

/** Lee (o crea) el documento users/{uid} y revisa si el usuario es administrador. */
async function loadAccount(user: User): Promise<{ profile: UserProfile; isAdmin: boolean }> {
  const userRef = doc(db, 'users', user.uid)
  const snap = await getDoc(userRef)
  let profile: UserProfile
  if (snap.exists()) {
    profile = { ...DEFAULT_PROFILE, ...(snap.data() as Partial<UserProfile>) }
  } else {
    profile = { ...DEFAULT_PROFILE, displayName: user.displayName ?? '' }
    await setDoc(userRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
  const admin = await getDoc(doc(db, 'admins', user.uid)).then(
    (s) => s.exists(),
    () => false,
  )
  return { profile, isAdmin: admin }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        setUser(next)
        if (!next) {
          setProfile(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }
        try {
          const account = await loadAccount(next)
          setProfile(account.profile)
          setIsAdmin(account.isAdmin)
        } catch {
          setProfile({ ...DEFAULT_PROFILE, displayName: next.displayName ?? '' })
        } finally {
          setLoading(false)
        }
      }),
    [],
  )

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!auth.currentUser) return
      const next = { ...(profile ?? DEFAULT_PROFILE), ...patch }
      await setDoc(doc(db, 'users', auth.currentUser.uid), { ...next, updatedAt: serverTimestamp() }, { merge: true })
      setProfile(next)
    },
    [profile],
  )

  const becomeHost = useCallback(
    async (input: HostProfileInput) => {
      const current = auth.currentUser
      if (!current) throw new Error('Inicia sesión primero.')
      await setDoc(doc(db, 'hosts', current.uid), {
        ...input,
        verified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await updateProfile({ isHost: true })
    },
    [updateProfile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isAdmin,
      loading,
      async signUp(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateAuthProfile(cred.user, { displayName })
        const account = { ...DEFAULT_PROFILE, displayName }
        await setDoc(doc(db, 'users', cred.user.uid), { ...account, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        setProfile(account)
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password)
      },
      async signInWithGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider())
      },
      signOutUser: () => signOut(auth),
      resetPassword: (email) => sendPasswordResetEmail(auth, email),
      updateProfile,
      becomeHost,
    }),
    [user, profile, isAdmin, loading, updateProfile, becomeHost],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
