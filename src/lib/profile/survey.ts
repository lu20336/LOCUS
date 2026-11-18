/**
 * Encuesta conversacional de preferencias de viaje. El agente de LOCUS hace
 * preguntas una a una; todas se pueden omitir. Es ADAPTATIVA: algunas
 * preguntas solo aparecen según respuestas anteriores (ej. edades de los niños
 * si viajas en familia con niños). Es determinista (sin IA) para que sea
 * rápida, gratuita y predecible; la IA entra después, para recomendar.
 */

import { localizedRecord } from '../i18n/localized'
import { getT } from '../i18n/store'

export interface Option {
  value: string
  label: string
  emoji?: string
  hint?: string
}

/** Lo que el usuario DECLARA. El agente nunca modifica estos campos por su cuenta. */
export interface TravelerDeclared {
  travelerTypes: string[]
  popularity: string
  environments: string[]
  regions: string[]
  pendingDestinations: string
  climate: string
  activities: string[]
  extremeSports: string[]
  budgetPerPerson: string
  lodgingLevel: string
  extrasWillingness: string
  comfortStyle: string
  companions: string
  kidsAges: string
  duration: string
  frequency: string
  amenities: string[]
  accessibility: string
  transport: string
  pets: string
  notes: string
}

export type Answers = Partial<TravelerDeclared>
export type QuestionId = keyof TravelerDeclared

export interface Question {
  id: QuestionId
  section: string
  prompt: (name: string) => string
  kind: 'single' | 'multi' | 'text'
  options?: Option[]
  /** Máximo de opciones en preguntas múltiples. */
  max?: number
  placeholder?: string
  /** La pregunta solo se muestra si esto es true (adaptativa). */
  when?: (answers: Answers) => boolean
}

/** Opción de una pregunta: el texto se lee del idioma activo (claves sv.o.* y sv.h.*). */
const o = (questionId: string, value: string, emoji?: string, withHint = false): Option => ({
  value,
  get label() {
    return getT()(`sv.o.${questionId}.${value}`)
  },
  emoji: emoji || undefined,
  get hint() {
    return withHint ? getT()(`sv.h.${questionId}.${value}`) : undefined
  },
})

export const QUESTIONS: Question[] = [
  {
    id: 'travelerTypes', get section() {
      return getT()('sv.sec.type')
    }, kind: 'multi', max: 4,
    prompt: (n) => (n ? getT()('sv.q.travelerTypes.named', { name: n }) : getT()('sv.q.travelerTypes')),
    options: [o('travelerTypes', 'aventura', '🧗'), o('travelerTypes', 'descanso', '🧘'), o('travelerTypes', 'cultura', '🏛️'), o('travelerTypes', 'gastronomia', '🍽️'),
      o('travelerTypes', 'naturaleza', '🌿'), o('travelerTypes', 'playa', '🏖️'), o('travelerTypes', 'vidaNocturna', '🌙'), o('travelerTypes', 'mezcla', '✨')],
  },
  {
    id: 'popularity', get section() {
      return getT()('sv.sec.type')
    }, kind: 'single',
    prompt: () => getT()('sv.q.popularity'),
    options: [o('popularity', 'populares', '📍', true), o('popularity', 'poco_conocidos', '🗺️', true), o('popularity', 'mezcla', '🔀')],
  },
  {
    id: 'environments', get section() {
      return getT()('sv.sec.dest')
    }, kind: 'multi', max: 3,
    prompt: () => getT()('sv.q.environments'),
    options: [o('environments', 'playa', '🏝️'), o('environments', 'montana', '⛰️'), o('environments', 'selva', '🌴'), o('environments', 'ciudad', '🏙️'), o('environments', 'pueblo', '🏘️'), o('environments', 'rural', '🌾')],
  },
  {
    id: 'regions', get section() {
      return getT()('sv.sec.dest')
    }, kind: 'multi', max: 3,
    prompt: () => getT()('sv.q.regions'),
    options: [o('regions', 'caribe', '🌊'), o('regions', 'andina', '☕'), o('regions', 'pacifica', '🐋'), o('regions', 'orinoquia', '🐎'), o('regions', 'amazonia', '🦜'), o('regions', 'insular', '🏝️')],
  },
  {
    id: 'pendingDestinations', get section() {
      return getT()('sv.sec.dest')
    }, kind: 'text', get placeholder() {
      return getT()('sv.ph.pendingDestinations')
    },
    prompt: () => getT()('sv.q.pendingDestinations'),
  },
  {
    id: 'climate', get section() {
      return getT()('sv.sec.dest')
    }, kind: 'single',
    prompt: () => getT()('sv.q.climate'),
    options: [o('climate', 'calido', '☀️', true), o('climate', 'templado', '🌤️', true), o('climate', 'frio', '🧥', true), o('climate', 'indiferente', '🤷')],
  },
  {
    id: 'activities', get section() {
      return getT()('sv.sec.act')
    }, kind: 'multi', max: 5,
    prompt: () => getT()('sv.q.activities'),
    options: [o('activities', 'gastronomia', '🍲'), o('activities', 'senderismo', '🥾'), o('activities', 'deportes_extremos', '🪂'), o('activities', 'acuaticas', '🤿'),
      o('activities', 'cultural', '🎭'), o('activities', 'ecoturismo', '🌱'), o('activities', 'fauna', '🦅'), o('activities', 'vida_nocturna', '🎶'),
      o('activities', 'locales', '🧶'), o('activities', 'bienestar', '💆'), o('activities', 'familiares', '👨‍👩‍👧')],
  },
  {
    id: 'extremeSports', get section() {
      return getT()('sv.sec.act')
    }, kind: 'multi', max: 4,
    when: (a) => (a.activities ?? []).includes('deportes_extremos') || (a.travelerTypes ?? []).includes('aventura') && (a.activities ?? []).length === 0,
    prompt: () => getT()('sv.q.extremeSports'),
    options: [o('extremeSports', 'parapente', '🪂'), o('extremeSports', 'rafting', '🛶'), o('extremeSports', 'buceo', '🤿'), o('extremeSports', 'canopy', '🌲'), o('extremeSports', 'escalada', '🧗'), o('extremeSports', 'canyoning', '💦')],
  },
  {
    id: 'budgetPerPerson', get section() {
      return getT()('sv.sec.budget')
    }, kind: 'single',
    prompt: () => getT()('sv.q.budgetPerPerson'),
    options: [o('budgetPerPerson', 'hasta_300k', '💸'), o('budgetPerPerson', '300k_800k', '💵'), o('budgetPerPerson', '800k_2m', '💰'), o('budgetPerPerson', 'mas_2m', '💎')],
  },
  {
    id: 'lodgingLevel', get section() {
      return getT()('sv.sec.budget')
    }, kind: 'single',
    prompt: () => getT()('sv.q.lodgingLevel'),
    options: [o('lodgingLevel', 'economico', '🛏️', true), o('lodgingLevel', 'intermedio', '🏡', true), o('lodgingLevel', 'premium', '🏨'), o('lodgingLevel', 'lujo', '👑')],
  },
  {
    id: 'comfortStyle', get section() {
      return getT()('sv.sec.budget')
    }, kind: 'single',
    prompt: () => getT()('sv.q.comfortStyle'),
    options: [o('comfortStyle', 'economico', '🎒'), o('comfortStyle', 'equilibrado', '⚖️'), o('comfortStyle', 'comodo', '🛋️')],
  },
  {
    id: 'extrasWillingness', get section() {
      return getT()('sv.sec.budget')
    }, kind: 'single',
    prompt: () => getT()('sv.q.extrasWillingness'),
    options: [o('extrasWillingness', 'si', '🌟'), o('extrasWillingness', 'a_veces', '🙂'), o('extrasWillingness', 'no', '🏷️')],
  },
  {
    id: 'companions', get section() {
      return getT()('sv.sec.comp')
    }, kind: 'single',
    prompt: () => getT()('sv.q.companions'),
    options: [o('companions', 'solo', '🚶'), o('companions', 'pareja', '💑'), o('companions', 'amigos', '👯'), o('companions', 'familia', '👪'), o('companions', 'familia_ninos', '🧒'), o('companions', 'grupo', '🚌')],
  },
  {
    id: 'kidsAges', get section() {
      return getT()('sv.sec.comp')
    }, kind: 'single',
    when: (a) => a.companions === 'familia_ninos',
    prompt: () => getT()('sv.q.kidsAges'),
    options: [o('kidsAges', '0_3', '👶'), o('kidsAges', '4_8', '🧒'), o('kidsAges', '9_12', '🧑'), o('kidsAges', 'mixto', '👨‍👩‍👧‍👦')],
  },
  {
    id: 'duration', get section() {
      return getT()('sv.sec.dur')
    }, kind: 'single',
    prompt: () => getT()('sv.q.duration'),
    options: [o('duration', 'finde', '🗓️'), o('duration', '3_5', '🧳'), o('duration', 'semana', '📅'), o('duration', 'largo', '🌎')],
  },
  {
    id: 'frequency', get section() {
      return getT()('sv.sec.dur')
    }, kind: 'single',
    prompt: () => getT()('sv.q.frequency'),
    options: [o('frequency', 'mensual', '🔁'), o('frequency', 'trimestral', '📆'), o('frequency', 'semestral', '🌓'), o('frequency', 'anual', '🎄'), o('frequency', 'rara_vez', '🐢')],
  },
  {
    id: 'amenities', get section() {
      return getT()('sv.sec.det')
    }, kind: 'multi', max: 6,
    prompt: () => getT()('sv.q.amenities'),
    options: [o('amenities', 'wifi', '📶'), o('amenities', 'cocina', '🍳'), o('amenities', 'piscina', '🏊'), o('amenities', 'estacionamiento', '🚗'), o('amenities', 'aire', '❄️'), o('amenities', 'lavadora', '🧺'), o('amenities', 'desayuno', '🥐'), o('amenities', 'vistas', '🌄')],
  },
  {
    id: 'pets', get section() {
      return getT()('sv.sec.det')
    }, kind: 'single',
    prompt: () => getT()('sv.q.pets'),
    options: [o('pets', 'si', '🐶'), o('pets', 'a_veces', '🐱'), o('pets', 'no', '🚫')],
  },
  {
    id: 'accessibility', get section() {
      return getT()('sv.sec.det')
    }, kind: 'text', get placeholder() {
      return getT()('sv.ph.accessibility')
    },
    prompt: () => getT()('sv.q.accessibility'),
  },
  {
    id: 'transport', get section() {
      return getT()('sv.sec.det')
    }, kind: 'single',
    prompt: () => getT()('sv.q.transport'),
    options: [o('transport', 'avion', '✈️'), o('transport', 'bus', '🚌'), o('transport', 'carro', '🚙'), o('transport', 'indiferente', '🤷')],
  },
  {
    id: 'notes', get section() {
      return getT()('sv.sec.det')
    }, kind: 'text', get placeholder() {
      return getT()('sv.ph.notes')
    },
    prompt: () => getT()('sv.q.notes'),
  },
]

/** Preguntas que corresponde mostrar con las respuestas actuales. */
export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.when || q.when(answers))
}

export function isAnswered(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null
}

/** La siguiente pregunta visible después de `afterId` (o la primera si no hay), o null al terminar. */
export function nextQuestion(answers: Answers, afterId?: QuestionId): Question | null {
  const list = visibleQuestions(answers)
  if (!afterId) return list[0] ?? null
  const current = QUESTIONS.findIndex((q) => q.id === afterId)
  return list.find((q) => QUESTIONS.findIndex((x) => x.id === q.id) > current) ?? null
}

/** Valida y limpia la respuesta a una pregunta. Devuelve null si no es válida. */
export function normalizeAnswer(question: Question, raw: string | string[]): string | string[] | null {
  if (question.kind === 'text') {
    const text = (Array.isArray(raw) ? raw.join(' ') : raw).trim().slice(0, 300)
    return text.length > 0 ? text : null
  }
  const valid = new Set((question.options ?? []).map((x) => x.value))
  if (question.kind === 'single') {
    const v = Array.isArray(raw) ? raw[0] : raw
    return valid.has(v) ? v : null
  }
  const list = (Array.isArray(raw) ? raw : [raw]).filter((v, i, arr) => valid.has(v) && arr.indexOf(v) === i).slice(0, question.max ?? 8)
  return list.length > 0 ? list : null
}

/** Texto legible de una respuesta (para resúmenes y para el agente). */
export function describeAnswer(question: Question, value: unknown): string {
  if (question.kind === 'text') return String(value ?? '')
  const label = (v: string) => question.options?.find((x) => x.value === v)?.label ?? v
  return Array.isArray(value) ? value.map(label).join(', ') : label(String(value ?? ''))
}

/** Etiqueta corta de cada respuesta (para resúmenes y para el agente). */
export const ANSWER_LABELS: Record<QuestionId, string> = localizedRecord('sl', ['travelerTypes', 'popularity', 'environments', 'regions', 'pendingDestinations', 'climate', 'activities', 'extremeSports', 'budgetPerPerson', 'lodgingLevel', 'extrasWillingness', 'comfortStyle', 'companions', 'kidsAges', 'duration', 'frequency', 'amenities', 'pets', 'accessibility', 'transport', 'notes'])

export function summarize(answers: Answers): { id: QuestionId; question: string; answer: string; section: string; label: string }[] {
  return QUESTIONS.filter((q) => isAnswered(answers[q.id])).map((q) => ({
    id: q.id,
    section: q.section,
    label: ANSWER_LABELS[q.id],
    question: q.prompt('').replace(/^¡Hola[^!]*! Soy tu compañero LOCUS\. Para recomendarte bien, cuéntame: /, ''),
    answer: describeAnswer(q, answers[q.id]),
  }))
}

/** Tope numérico aproximado del presupuesto por persona (COP), para filtrar recomendaciones. */
export const BUDGET_MAX: Record<string, number> = { hasta_300k: 300_000, '300k_800k': 800_000, '800k_2m': 2_000_000, mas_2m: Infinity }
