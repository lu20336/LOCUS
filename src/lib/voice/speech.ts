/**
 * Utilidades de voz (puras o casi): soporte del navegador, limpieza del texto
 * antes de hablarlo, elección de voz por idioma y detección del idioma de un texto.
 *
 * Tecnología (docs/VOZ.md): Web Speech API del navegador.
 *  - Reconocimiento (SpeechRecognition): Chrome/Edge (y Safari 14.1+ con prefijo webkit).
 *    En Chrome y Edge el audio se envía al servicio de voz de Google/Microsoft; no hay clave
 *    ni cuota que gestionar, pero necesita conexión y NO existe en Firefox.
 *  - Síntesis (speechSynthesis): voces del sistema operativo/navegador; la calidad y los
 *    idiomas disponibles dependen del dispositivo.
 */
import { LOCALES, LOCALE_META, type Locale } from '../i18n/locales'

/* ───────────── Soporte ───────────── */

export interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

type RecognitionCtor = new () => RecognitionLike

export function getRecognitionCtor(win: Window | undefined = typeof window === 'undefined' ? undefined : window): RecognitionCtor | null {
  const w = win as (Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }) | undefined
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null
}

export const isRecognitionSupported = () => getRecognitionCtor() !== null
export const isSynthesisSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

/* ───────────── Texto para hablar ───────────── */

/** Quita marcas de formato, enlaces y símbolos que sonarían raro al leerlos en voz alta. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•·]\s+/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[‍️]/g, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Parte el texto en frases de a lo sumo `max` caracteres (Chrome corta enunciados largos). */
export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (sentence.length > max) {
      if (current) chunks.push(current)
      current = ''
      // Frase larga: se corta en espacios.
      let rest = sentence
      while (rest.length > max) {
        const cut = rest.lastIndexOf(' ', max)
        const at = cut > max / 2 ? cut : max
        chunks.push(rest.slice(0, at).trim())
        rest = rest.slice(at).trim()
      }
      current = rest
      continue
    }
    if ((current + ' ' + sentence).trim().length > max) {
      chunks.push(current)
      current = sentence
    } else {
      current = (current + ' ' + sentence).trim()
    }
  }
  if (current) chunks.push(current)
  return chunks.filter(Boolean)
}

/* ───────────── Elección de voz ───────────── */

export interface VoiceLike {
  name: string
  lang: string
  localService?: boolean
  default?: boolean
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()
const REGION_PREFERENCE: Record<Locale, string[]> = {
  es: ['es-co', 'es-419', 'es-mx', 'es-us', 'es-ar', 'es-es'],
  en: ['en-us', 'en-gb', 'en-au', 'en-ca'],
  pt: ['pt-br', 'pt-pt'],
  fr: ['fr-fr', 'fr-ca'],
  de: ['de-de', 'de-at', 'de-ch'],
}

/** Puntaje de una voz para un idioma (mayor = mejor). 0 = no sirve. */
export function scoreVoice(voice: VoiceLike, locale: Locale): number {
  const lang = norm(voice.lang)
  if (lang.split('-')[0] !== locale) return 0
  let score = 10
  const exact = norm(LOCALE_META[locale].speech)
  if (lang === exact) score += 40
  const rank = REGION_PREFERENCE[locale].indexOf(lang)
  if (rank >= 0) score += 20 - rank * 2
  if (/google|natural|neural|online|premium|enhanced|siri/i.test(voice.name)) score += 25
  if (/compact|espeak/i.test(voice.name)) score -= 8
  if (voice.default) score += 3
  return score
}

/** La mejor voz disponible para el idioma, o null si el dispositivo no tiene ninguna (no se simula). */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], locale: Locale): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const v of voices) {
    const s = scoreVoice(v, locale)
    if (s > bestScore) {
      best = v
      bestScore = s
    }
  }
  return best
}

/* ───────────── Detección de idioma de un texto ───────────── */

const STOPWORDS: Record<Locale, string[]> = {
  es: ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'para', 'con', 'por', 'quiero', 'puedo', 'hola', 'gracias', 'dónde', 'donde', 'cómo', 'como', 'qué', 'me', 'te', 'se', 'del', 'al', 'muy', 'más', 'viaje', 'días'],
  en: ['the', 'and', 'is', 'are', 'to', 'of', 'in', 'for', 'with', 'what', 'where', 'how', 'can', 'you', 'i', 'my', 'me', 'hello', 'thanks', 'want', 'trip', 'days', 'please', 'it', 'on', 'that', 'this', 'do'],
  pt: ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'em', 'um', 'uma', 'é', 'para', 'com', 'por', 'quero', 'posso', 'olá', 'obrigado', 'obrigada', 'onde', 'como', 'você', 'não', 'muito', 'viagem', 'dias', 'meu', 'minha', 'preciso', 'está'],
  fr: ['le', 'la', 'les', 'de', 'des', 'du', 'et', 'est', 'un', 'une', 'en', 'pour', 'avec', 'que', 'qui', 'je', 'veux', 'peux', 'bonjour', 'merci', 'où', 'comment', 'quel', 'quelle', 'voyage', 'jours', 'mon', 'ma', 'vous', 'pas'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'zu', 'mit', 'für', 'ich', 'möchte', 'kann', 'hallo', 'danke', 'wo', 'wie', 'was', 'reise', 'tage', 'mein', 'meine', 'nicht', 'sie', 'den', 'dem', 'auf', 'bitte'],
}

/**
 * Idioma más probable de `text` (por palabras frecuentes). Si no hay evidencia suficiente
 * devuelve `fallback`. Es una heurística: sirve para elegir la voz de la respuesta,
 * no para decidir nada crítico.
 */
export function detectLanguage(text: string, fallback: Locale): Locale {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? []
  if (words.length < 3) return fallback
  const scores = Object.fromEntries(LOCALES.map((l) => [l, 0])) as Record<Locale, number>
  for (const w of words) for (const l of LOCALES) if (STOPWORDS[l].includes(w)) scores[l]++
  const ranked = [...LOCALES].sort((a, b) => scores[b] - scores[a])
  const [first, second] = ranked
  if (scores[first] < 2 || scores[first] === scores[second]) return fallback
  return first
}

/* ───────────── Errores de reconocimiento ───────────── */

export type RecognitionIssue = 'denied' | 'no-device' | 'network' | 'no-speech' | 'aborted' | 'language' | 'other'

export function mapRecognitionError(error: string): RecognitionIssue {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied'
    case 'audio-capture':
      return 'no-device'
    case 'network':
      return 'network'
    case 'no-speech':
      return 'no-speech'
    case 'aborted':
      return 'aborted'
    case 'language-not-supported':
      return 'language'
    default:
      return 'other'
  }
}
