/**
 * Proveedor de idioma de LOCUS.
 *
 *  - Español va incluido en el paquete principal; los demás idiomas se descargan
 *    la primera vez que se eligen (un archivo pequeño por idioma).
 *  - Orden para decidir el idioma inicial: cuenta del usuario → elección guardada
 *    en este navegador → idioma del navegador (si LOCUS lo soporta) → español.
 *  - Persistencia: localStorage ("locus-lang") para todos; si hay sesión, también
 *    en el perfil (users/{uid}.language) para recuperarlo en otro dispositivo.
 *  - Cambiar de idioma NO recarga la página ni cierra la sesión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { DEFAULT_LOCALE, LOCALE_META, detectLocale, isLocale, type Locale, type LocaleMeta } from './locales'
import { es } from './messages/es'
import { setActiveLocale } from './store'
import { createTranslator, type Dictionary, type Translator } from './translate'

const STORAGE_KEY = 'locus-lang'

const loaders: Record<Exclude<Locale, 'es'>, () => Promise<Dictionary>> = {
  en: () => import('./messages/en').then((m) => m.en),
  pt: () => import('./messages/pt').then((m) => m.pt),
  fr: () => import('./messages/fr').then((m) => m.fr),
  de: () => import('./messages/de').then((m) => m.de),
}

/** Descarga el diccionario de un idioma (español ya está cargado). */
export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  return locale === 'es' ? es : loaders[locale]()
}

function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

function initialLocale(): Locale {
  return storedLocale() ?? detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language])
}

export interface I18nContextValue {
  locale: Locale
  meta: LocaleMeta
  t: Translator
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [dictionary, setDictionary] = useState<Dictionary | null>(locale === DEFAULT_LOCALE ? es : null)
  const syncedFor = useRef<string | null>(null)

  // Carga el diccionario del idioma elegido (y lo publica para el código fuera de React).
  useEffect(() => {
    let cancelled = false
    loadDictionary(locale)
      .then((dict) => {
        if (cancelled) return
        setActiveLocale(locale, dict)
        setDictionary(dict)
        document.documentElement.lang = locale
      })
      .catch(() => {
        // Sin red para descargar el idioma (o página en caché de una versión anterior, cuyo archivo de idioma
        // ya no existe): se recarga UNA vez para tomar la versión nueva; si sigue fallando, se mantiene el español.
        if (cancelled) return
        try {
          if (typeof window !== 'undefined' && sessionStorage.getItem('locus:i18n:reloaded') !== locale) {
            sessionStorage.setItem('locus:i18n:reloaded', locale)
            window.location.reload()
            return
          }
        } catch {
          // sin sessionStorage: se sigue con el respaldo en español
        }
        setActiveLocale(DEFAULT_LOCALE, es)
        setDictionary(es)
        document.documentElement.lang = DEFAULT_LOCALE
      })
    return () => {
      cancelled = true
    }
  }, [locale])

  // Con sesión: la preferencia de la cuenta manda (otro dispositivo); si la cuenta no tiene una, se guarda la local.
  useEffect(() => {
    if (!user || !profile || syncedFor.current === user.uid) return
    syncedFor.current = user.uid
    const saved = profile.language
    if (isLocale(saved)) {
      setLocaleState(saved)
      try {
        localStorage.setItem(STORAGE_KEY, saved)
      } catch {
        // sin almacenamiento
      }
    } else {
      void updateProfile({ language: locale }).catch(() => undefined)
    }
  }, [user, profile, locale, updateProfile])
  useEffect(() => {
    if (!user) syncedFor.current = null
  }, [user])

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // sin almacenamiento: vale para esta sesión
      }
      if (user) void updateProfile({ language: next }).catch(() => undefined)
    },
    [user, updateProfile],
  )

  const value = useMemo<I18nContextValue | null>(
    () => (dictionary ? { locale, meta: LOCALE_META[locale], t: createTranslator(locale, dictionary, es), setLocale } : null),
    [locale, dictionary, setLocale],
  )

  // Hasta descargar el idioma elegido no se pinta la app (evita un destello en español).
  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Traductor, idioma activo y cambio de idioma. Fuera del proveedor funciona en español (pruebas). */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (value) return value
  return { locale: DEFAULT_LOCALE, meta: LOCALE_META.es, t: createTranslator(DEFAULT_LOCALE, es, es), setLocale: () => {} }
}

/** Atajo: solo `t`. */
export const useT = (): Translator => useI18n().t
