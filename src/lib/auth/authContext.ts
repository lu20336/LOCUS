import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export interface UserProfile {
  displayName: string
  phone: string
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  aiPersonalization: boolean
  isHost: boolean
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

/** Mensajes en español para los errores más comunes de Firebase Auth. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Prueba iniciando sesión.',
    'auth/weak-password': 'La contraseña es muy corta: usa al menos 6 caracteres.',
    'auth/invalid-email': 'Ese correo no parece válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Cerraste la ventana de Google antes de terminar.',
    'auth/operation-not-allowed': 'Este método de ingreso aún no está activado en el proyecto (Firebase Authentication).',
    'auth/network-request-failed': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  }
  return messages[code] ?? 'No pudimos completar la acción. Inténtalo de nuevo.'
}
