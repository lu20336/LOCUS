import { getT } from '../i18n/store'
import type { Locale } from '../i18n/locales'
import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export interface UserProfile {
  displayName: string
  phone: string
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  aiPersonalization: boolean
  isHost: boolean
  /** Idioma preferido (ver src/lib/i18n/locales.ts). */
  language?: Locale
}

export interface HostProfileInput {
  displayName: string
  bio: string
  municipality: string
  languages: string[]
  rnt: string
}

export interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  /** true mientras se resuelve la sesión inicial. */
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>
  becomeHost: (input: HostProfileInput) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return value
}

/** Mensajes de error de Firebase Auth en el idioma actual de la interfaz. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  const t = getT()
  const keys: Record<string, string> = {
    'auth/invalid-credential': 'auth.error.invalidCredential',
    'auth/wrong-password': 'auth.error.invalidCredential',
    'auth/user-not-found': 'auth.error.invalidCredential',
    'auth/email-already-in-use': 'auth.error.emailInUse',
    'auth/weak-password': 'auth.error.weakPassword',
    'auth/invalid-email': 'auth.error.invalidEmail',
    'auth/too-many-requests': 'auth.error.tooMany',
    'auth/popup-closed-by-user': 'auth.error.popupClosed',
    'auth/cancelled-popup-request': 'auth.error.popupClosed',
    'auth/operation-not-allowed': 'auth.error.notAllowed',
    'auth/network-request-failed': 'auth.error.network',
  }
  return t(keys[code] ?? 'auth.error.generic')
}
