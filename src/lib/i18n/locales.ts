/**
 * Idiomas de LOCUS. La lista es la ÚNICA fuente de verdad: las reglas de Firestore
 * (campo `language` del perfil) y el agente de IA la repiten, así que si se agrega
 * un idioma hay que actualizar también firestore.rules (ver docs/I18N.md).
 *
 * Por qué estos cinco (justificación completa en docs/I18N.md):
 *  - es: idioma del país y del mercado principal (turismo doméstico).
 *  - en: idioma puente del turismo internacional (EE. UU., Canadá, Reino Unido, viajeros de todo el mundo).
 *  - pt: Brasil es el mayor mercado lusófono de la región y vecino de Colombia.
 *  - fr: Francia y Canadá francófono están entre los mercados europeos/norteamericanos que más visitan Colombia.
 *  - de: Alemania es de los países de la Unión Europea que más viajan al exterior y con mayor gasto por viaje.
 */
export const LOCALES = ['es', 'en', 'pt', 'fr', 'de'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

export interface LocaleMeta {
  /** Nombre en el propio idioma (selector de idioma). */
  nativeName: string
  /** Nombre en inglés (para instruir al modelo de IA). */
  englishName: string
  /** Emoji de bandera de referencia (solo decorativo: el idioma no es un país). */
  flag: string
  /** Etiqueta BCP 47 para Intl y para la voz (variante regional más útil para LOCUS). */
  bcp47: string
  /** Idioma de reconocimiento/síntesis de voz (Web Speech API). */
  speech: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  es: { nativeName: 'Español', englishName: 'Spanish (Latin American, Colombian)', flag: '🇨🇴', bcp47: 'es-CO', speech: 'es-CO' },
  en: { nativeName: 'English', englishName: 'English', flag: '🇬🇧', bcp47: 'en-US', speech: 'en-US' },
  pt: { nativeName: 'Português', englishName: 'Portuguese (Brazilian)', flag: '🇧🇷', bcp47: 'pt-BR', speech: 'pt-BR' },
  fr: { nativeName: 'Français', englishName: 'French', flag: '🇫🇷', bcp47: 'fr-FR', speech: 'fr-FR' },
  de: { nativeName: 'Deutsch', englishName: 'German', flag: '🇩🇪', bcp47: 'de-DE', speech: 'de-DE' },
}

export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * Idioma inicial para quien no ha elegido: el del navegador si LOCUS lo soporta; si no, español.
 * Acepta variantes ("pt-PT", "fr-CA", "de-AT" → pt, fr, de).
 */
export function detectLocale(preferred: readonly string[] | undefined): Locale {
  for (const tag of preferred ?? []) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}
