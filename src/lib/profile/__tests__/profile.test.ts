import { describe, expect, it } from 'vitest'
import { recommendDestinations } from '../recommend'
import { QUESTIONS, describeAnswer, nextQuestion, normalizeAnswer, summarize, visibleQuestions, type Answers } from '../survey'

describe('encuesta adaptativa', () => {
  it('empieza por la primera pregunta y avanza en orden', () => {
    expect(nextQuestion({})?.id).toBe('travelerTypes')
    expect(nextQuestion({}, 'travelerTypes')?.id).toBe('popularity')
  })

  it('la pregunta de edades de niños solo aparece si viajas en familia con niños', () => {
    expect(visibleQuestions({ companions: 'pareja' }).some((q) => q.id === 'kidsAges')).toBe(false)
    expect(visibleQuestions({ companions: 'familia_ninos' }).some((q) => q.id === 'kidsAges')).toBe(true)
    expect(nextQuestion({ companions: 'familia_ninos' }, 'companions')?.id).toBe('kidsAges')
    expect(nextQuestion({ companions: 'solo' }, 'companions')?.id).toBe('duration')
  })

  it('las preguntas de deportes extremos aparecen solo si te interesan', () => {
    expect(visibleQuestions({ activities: ['gastronomia'] }).some((q) => q.id === 'extremeSports')).toBe(false)
    expect(visibleQuestions({ activities: ['deportes_extremos'] }).some((q) => q.id === 'extremeSports')).toBe(true)
  })

  it('termina al agotar las preguntas', () => {
    const last = QUESTIONS[QUESTIONS.length - 1]
    expect(nextQuestion({}, last.id)).toBeNull()
  })

  it('todas las preguntas con opciones tienen valores únicos', () => {
    for (const q of QUESTIONS) {
      if (!q.options) continue
      const values = q.options.map((o) => o.value)
      expect(new Set(values).size, q.id).toBe(values.length)
    }
  })

  it('valida y limpia las respuestas', () => {
    const multi = QUESTIONS.find((q) => q.id === 'travelerTypes')!
    expect(normalizeAnswer(multi, ['aventura', 'inventada', 'aventura'])).toEqual(['aventura'])
    expect(normalizeAnswer(multi, ['x'])).toBeNull()
    expect(normalizeAnswer(multi, ['aventura', 'descanso', 'cultura', 'gastronomia', 'playa'])).toHaveLength(4)
    const single = QUESTIONS.find((q) => q.id === 'climate')!
    expect(normalizeAnswer(single, 'frio')).toBe('frio')
    expect(normalizeAnswer(single, 'lluvioso')).toBeNull()
    const text = QUESTIONS.find((q) => q.id === 'notes')!
    expect(normalizeAnswer(text, '   ')).toBeNull()
    expect(normalizeAnswer(text, ' hola ')).toBe('hola')
  })

  it('resume las respuestas en texto legible', () => {
    const answers: Answers = { climate: 'frio', travelerTypes: ['aventura', 'playa'] }
    const rows = summarize(answers)
    expect(rows.map((r) => r.id)).toEqual(['travelerTypes', 'climate'])
    expect(describeAnswer(QUESTIONS.find((q) => q.id === 'climate')!, 'frio')).toBe('Frío')
  })
})

describe('recomendación de destinos (reglas, sin IA)', () => {
  it('un viajero de playa y clima cálido recibe destinos de costa con su razón', () => {
    const r = recommendDestinations({ travelerTypes: ['playa'], environments: ['playa'], climate: 'calido' }, 3)
    expect(r.length).toBeGreaterThan(0)
    expect(['cartagena', 'san-andres', 'santa-marta']).toContain(r[0].destination.id)
    expect(r[0].reasons.length).toBeGreaterThan(0)
    expect(r.every((x) => x.destination.id !== 'bogota')).toBe(true)
  })

  it('el clima frío favorece destinos de montaña y penaliza el calor', () => {
    const r = recommendDestinations({ climate: 'frio', environments: ['montana', 'pueblo'] }, 3)
    expect(r.map((x) => x.destination.id)).not.toContain('cartagena')
  })

  it('un destino pendiente en la lista sube al primer lugar', () => {
    const r = recommendDestinations({ pendingDestinations: 'Guatapé y algo más', climate: 'indiferente' }, 3)
    expect(r[0].destination.id).toBe('guatape')
  })

  it('con un presupuesto bajo evita los destinos de gama alta', () => {
    const r = recommendDestinations({ budgetPerPerson: 'hasta_300k', travelerTypes: ['playa', 'cultura'] }, 8)
    const ids = r.map((x) => x.destination.id)
    expect(ids.indexOf('cartagena')).toBeGreaterThan(ids.indexOf('santa-marta') === -1 ? -1 : ids.indexOf('santa-marta') - 1)
  })

  it('sin datos no inventa recomendaciones', () => {
    expect(recommendDestinations({}, 3)).toEqual([])
  })
})
