/**
 * Inicialización de Firebase para la app. Proyecto propio "locus-bb57e",
 * independiente del de la landing ("locus-landing"). Estas claves son
 * públicas por diseño: la seguridad real la dan las reglas de Firestore
 * (firestore.rules). Analytics no se inicializa en este prototipo.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCG0WOnsdNGrvxR8UU-FhERNTouJdTd2vk',
  authDomain: 'locus-bb57e.firebaseapp.com',
  projectId: 'locus-bb57e',
  storageBucket: 'locus-bb57e.firebasestorage.app',
  messagingSenderId: '863826859569',
  appId: '1:863826859569:web:481e0a64431ef45f7ce710',
  measurementId: 'G-SQKB12MZ0S',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

/**
 * Devuelve el usuario anónimo de esta sesión, creándolo si no existe.
 * Firebase recuerda la sesión en el navegador, así que el mismo visitante
 * conserva su ID entre recargas.
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
