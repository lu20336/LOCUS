/**
 * Encuesta conversacional de preferencias de viaje. El agente de LOCUS hace
 * preguntas una a una; todas se pueden omitir. Es ADAPTATIVA: algunas
 * preguntas solo aparecen según respuestas anteriores (ej. edades de los niños
 * si viajas en familia con niños). Es determinista (sin IA) para que sea
 * rápida, gratuita y predecible; la IA entra después, para recomendar.
 */

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

const o = (value: string, label: string, emoji?: string, hint?: string): Option => ({ value, label, emoji, hint })

export const QUESTIONS: Question[] = [
  {
    id: 'travelerTypes', section: 'Tipo de viajero', kind: 'multi', max: 4,
    prompt: (n) => `¡Hola${n ? `, ${n}` : ''}! Soy tu compañero LOCUS. Para recomendarte bien, cuéntame: ¿qué tipo de viajero eres?`,
    options: [o('aventura', 'Aventura', '🧗'), o('descanso', 'Descanso', '🧘'), o('cultura', 'Cultura', '🏛️'), o('gastronomia', 'Gastronomía', '🍽️'),
      o('naturaleza', 'Naturaleza', '🌿'), o('playa', 'Playa', '🏖️'), o('vidaNocturna', 'Vida nocturna', '🌙'), o('mezcla', 'Un poco de todo', '✨')],
  },
  {
    id: 'popularity', section: 'Tipo de viajero', kind: 'single',
    prompt: () => '¿Prefieres los destinos conocidos o descubrir rincones poco turísticos?',
    options: [o('populares', 'Los populares', '📍', 'Lo clásico, con más oferta'), o('poco_conocidos', 'Lugares poco conocidos', '🗺️', 'Menos gente, más sorpresa'), o('mezcla', 'Una mezcla', '🔀')],
  },
  {
    id: 'environments', section: 'Destinos', kind: 'multi', max: 3,
    prompt: () => '¿Qué paisajes te llaman más la atención?',
    options: [o('playa', 'Playa', '🏝️'), o('montana', 'Montaña', '⛰️'), o('selva', 'Selva', '🌴'), o('ciudad', 'Ciudades', '🏙️'), o('pueblo', 'Pueblos', '🏘️'), o('rural', 'Campo y fincas', '🌾')],
  },
  {
    id: 'regions', section: 'Destinos', kind: 'multi', max: 3,
    prompt: () => '¿Qué regiones de Colombia te gustaría conocer?',
    options: [o('caribe', 'Caribe', '🌊'), o('andina', 'Andina (cafetera, Boyacá, Antioquia…)', '☕'), o('pacifica', 'Pacífica', '🐋'), o('orinoquia', 'Orinoquía (Llanos)', '🐎'), o('amazonia', 'Amazonía', '🦜'), o('insular', 'Isla (San Andrés, Providencia)', '🏝️')],
  },
  {
    id: 'pendingDestinations', section: 'Destinos', kind: 'text', placeholder: 'Ej. Caño Cristales, Barichara, Providencia…',
    prompt: () => '¿Tienes algún destino pendiente en tu lista? Escríbelo (o sáltate esta).',
  },
  {
    id: 'climate', section: 'Destinos', kind: 'single',
    prompt: () => '¿Qué clima disfrutas más?',
    options: [o('calido', 'Cálido', '☀️', 'Más de 24 °C'), o('templado', 'Templado', '🌤️', '17 a 24 °C'), o('frio', 'Frío', '🧥', '12 a 17 °C'), o('indiferente', 'Me da igual', '🤷')],
  },
  {
    id: 'activities', section: 'Actividades', kind: 'multi', max: 5,
    prompt: () => '¿Qué actividades te encantaría hacer en un viaje?',
    options: [o('gastronomia', 'Gastronomía', '🍲'), o('senderismo', 'Senderismo', '🥾'), o('deportes_extremos', 'Deportes extremos', '🪂'), o('acuaticas', 'Actividades acuáticas', '🤿'),
      o('cultural', 'Turismo cultural', '🎭'), o('ecoturismo', 'Ecoturismo', '🌱'), o('fauna', 'Avistamiento de fauna', '🦅'), o('vida_nocturna', 'Vida nocturna', '🎶'),
      o('locales', 'Experiencias locales', '🧶'), o('bienestar', 'Descanso y bienestar', '💆'), o('familiares', 'Actividades familiares', '👨‍👩‍👧')],
  },
  {
    id: 'extremeSports', section: 'Actividades', kind: 'multi', max: 4,
    when: (a) => (a.activities ?? []).includes('deportes_extremos') || (a.travelerTypes ?? []).includes('aventura') && (a.activities ?? []).length === 0,
    prompt: () => 'Veo que te gusta la adrenalina. ¿Cuál te llama más?',
    options: [o('parapente', 'Parapente', '🪂'), o('rafting', 'Rafting', '🛶'), o('buceo', 'Buceo', '🤿'), o('canopy', 'Canopy', '🌲'), o('escalada', 'Escalada', '🧗'), o('canyoning', 'Cañonismo', '💦')],
  },
  {
    id: 'budgetPerPerson', section: 'Presupuesto', kind: 'single',
    prompt: () => '¿Cuánto sueles gastar por persona en un viaje (sin tiquetes)? Es solo una idea aproximada.',
    options: [o('hasta_300k', 'Hasta $300.000', '💸'), o('300k_800k', '$300.000 – $800.000', '💵'), o('800k_2m', '$800.000 – $2.000.000', '💰'), o('mas_2m', 'Más de $2.000.000', '💎')],
  },
  {
    id: 'lodgingLevel', section: 'Presupuesto', kind: 'single',
    prompt: () => '¿Qué tipo de hospedaje prefieres?',
    options: [o('economico', 'Económico', '🛏️', 'Hostales, habitaciones'), o('intermedio', 'Intermedio', '🏡', 'Cómodo y buen precio'), o('premium', 'Premium', '🏨'), o('lujo', 'De lujo', '👑')],
  },
  {
    id: 'comfortStyle', section: 'Presupuesto', kind: 'single',
    prompt: () => '¿Cómo es tu estilo de viaje?',
    options: [o('economico', 'Lo más económico posible', '🎒'), o('equilibrado', 'Equilibrado', '⚖️'), o('comodo', 'Prefiero comodidad', '🛋️')],
  },
  {
    id: 'extrasWillingness', section: 'Presupuesto', kind: 'single',
    prompt: () => '¿Pagarías más por una experiencia especial (un tour exclusivo, una cena inolvidable)?',
    options: [o('si', 'Sí, vale la pena', '🌟'), o('a_veces', 'A veces', '🙂'), o('no', 'Prefiero ahorrar', '🏷️')],
  },
  {
    id: 'companions', section: 'Compañía', kind: 'single',
    prompt: () => '¿Con quién sueles viajar?',
    options: [o('solo', 'Solo/a', '🚶'), o('pareja', 'En pareja', '💑'), o('amigos', 'Con amigos', '👯'), o('familia', 'En familia', '👪'), o('familia_ninos', 'Familia con niños', '🧒'), o('grupo', 'En grupo grande', '🚌')],
  },
  {
    id: 'kidsAges', section: 'Compañía', kind: 'single',
    when: (a) => a.companions === 'familia_ninos',
    prompt: () => 'Para recomendarte planes aptos, ¿qué edades tienen los niños?',
    options: [o('0_3', '0 a 3 años', '👶'), o('4_8', '4 a 8 años', '🧒'), o('9_12', '9 a 12 años', '🧑'), o('mixto', 'Varias edades', '👨‍👩‍👧‍👦')],
  },
  {
    id: 'duration', section: 'Duración', kind: 'single',
    prompt: () => '¿Qué duración tienen tus viajes normalmente?',
    options: [o('finde', 'Escapadas de fin de semana', '🗓️'), o('3_5', 'De 3 a 5 días', '🧳'), o('semana', 'Una semana', '📅'), o('largo', 'Viajes largos', '🌎')],
  },
  {
    id: 'frequency', section: 'Duración', kind: 'single',
    prompt: () => '¿Cada cuánto viajas?',
    options: [o('mensual', 'Cada mes', '🔁'), o('trimestral', 'Cada 3 meses', '📆'), o('semestral', 'Cada 6 meses', '🌓'), o('anual', 'Una vez al año', '🎄'), o('rara_vez', 'Rara vez', '🐢')],
  },
  {
    id: 'amenities', section: 'Detalles', kind: 'multi', max: 6,
    prompt: () => '¿Qué comodidades no pueden faltar en tu alojamiento?',
    options: [o('wifi', 'Wi-Fi', '📶'), o('cocina', 'Cocina', '🍳'), o('piscina', 'Piscina', '🏊'), o('estacionamiento', 'Estacionamiento', '🚗'), o('aire', 'Aire acondicionado', '❄️'), o('lavadora', 'Lavadora', '🧺'), o('desayuno', 'Desayuno', '🥐'), o('vistas', 'Buenas vistas', '🌄')],
  },
  {
    id: 'pets', section: 'Detalles', kind: 'single',
    prompt: () => '¿Viajas con mascota?',
    options: [o('si', 'Sí, siempre', '🐶'), o('a_veces', 'A veces', '🐱'), o('no', 'No', '🚫')],
  },
  {
    id: 'accessibility', section: 'Detalles', kind: 'text', placeholder: 'Ej. movilidad reducida, dieta vegetariana, alergias…',
    prompt: () => '¿Hay algo de accesibilidad o necesidades especiales que debamos tener en cuenta?',
  },
  {
    id: 'transport', section: 'Detalles', kind: 'single',
    prompt: () => '¿Cómo prefieres desplazarte?',
    options: [o('avion', 'Avión', '✈️'), o('bus', 'Bus', '🚌'), o('carro', 'Carro propio o alquilado', '🚙'), o('indiferente', 'Me da igual', '🤷')],
  },
  {
    id: 'notes', section: 'Detalles', kind: 'text', placeholder: 'Cualquier cosa que ayude a personalizar tus recomendaciones',
    prompt: () => 'Última: ¿hay algo más que quieras contarme sobre cómo te gusta viajar?',
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
export const ANSWER_LABELS: Record<QuestionId, string> = {
  travelerTypes: 'Tipo de viajero', popularity: 'Destinos', environments: 'Paisajes favoritos', regions: 'Regiones de interés', pendingDestinations: 'Destinos pendientes',
  climate: 'Clima preferido', activities: 'Actividades', extremeSports: 'Deportes extremos', budgetPerPerson: 'Presupuesto por persona', lodgingLevel: 'Hospedaje',
  extrasWillingness: 'Experiencias especiales', comfortStyle: 'Estilo de viaje', companions: 'Compañía', kidsAges: 'Edades de los niños', duration: 'Duración de los viajes',
  frequency: 'Frecuencia', amenities: 'Comodidades clave', pets: 'Mascotas', accessibility: 'Necesidades especiales', transport: 'Transporte', notes: 'Notas',
}

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
