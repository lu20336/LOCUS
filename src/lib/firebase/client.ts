/**
 * Inicialización de Firebase. Proyecto "locus-bb57e".
 *
 * La configuración web de Firebase es PÚBLICA por diseño (identifica el
 * proyecto, no da acceso): la seguridad real la dan las reglas de Firestore
 * (firestore.rules), App Check y las restricciones de la API key en Google Cloud.
 * Los secretos de servidor NO van aquí.
 *
 * En desarrollo (`npm run dev`) todo se conecta a los EMULADORES locales de
 * Auth y Firestore (VITE_USE_EMULATORS=true), así que probar nunca toca la
 * base real. Analytics no se inicializa.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCG0WOnsdNGrvxR8UU-FhERNTouJdTd2vk',
  authDomain: 'locus-bb57e.firebaseapp.com',
  projectId: 'locus-bb57e',
  storageBucket: 'locus-bb57e.firebasestorage.app',
  messagingSenderId: '863826859569',
  appId: '1:863826859569:web:481e0a64431ef45f7ce710',
  measurementId: 'G-SQKB12MZ0S',
}

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// HMR vuelve a evaluar este módulo: solo conectamos los emuladores una vez.
const globalFlags = globalThis as unknown as { __locusEmulators?: boolean }
if (useEmulators && !globalFlags.__locusEmulators) {
  globalFlags.__locusEmulators = true
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/**
 * (Heredado del prototipo, sin uso en la app actual.) Devuelve el usuario
 * anónimo de la sesión, creándolo si no existe.
 */
export function ensureAnonymousUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe()
        if (user) resolve(user)
        else signInAnonymously(auth).then((cred) => resolve(cred.user), reject)
      },
      reject,
    )
  })
}
