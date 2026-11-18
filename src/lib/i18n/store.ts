/**
 * Estado global del idioma fuera de React: lo leen las funciones de formato
 * (src/lib/format.ts) y el código que arma mensajes sin ser un componente
 * (herramientas del agente, errores de servicios). El proveedor de React lo
 * actualiza en cada cambio de idioma.
 */
import { DEFAULT_LOCALE, LOCALE_META, type Locale } from './locales'
import { createTranslator, type Dictionary, type Translator } from './translate'
import { es } from './messages/es'

let current: Locale = DEFAULT_LOCALE
let translator: Translator = createTranslator(DEFAULT_LOCALE, es, es)

export const getLocale = (): Locale => current
export const getBcp47 = (): string => LOCALE_META[current].bcp47
/** Traductor del idioma activo (para código que no es un componente). */
export const getT = (): Translator => translator

export function setActiveLocale(locale: Locale, dictionary: Dictionary): void {
  current = locale
  translator = createTranslator(locale, dictionary, es)
}

/** Traductor de un idioma concreto con solo el español cargado (pruebas y respaldo). */
export const spanishT = (): Translator => createTranslator(DEFAULT_LOCALE, es, es)
