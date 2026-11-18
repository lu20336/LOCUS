import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, detectLocale, isLocale } from '../locales'
import { createTranslator, interpolate } from '../translate'

describe('locales', () => {
  it('son cinco, con español por defecto y metadatos completos', () => {
    expect(LOCALES).toEqual(['es', 'en', 'pt', 'fr', 'de'])
    expect(DEFAULT_LOCALE).toBe('es')
    for (const l of LOCALES) {
      const m = LOCALE_META[l]
      expect(m.nativeName).toBeTruthy()
      expect(m.bcp47.startsWith(l)).toBe(true)
      expect(m.speech.startsWith(l)).toBe(true)
    }
  })

  it('isLocale valida', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('it')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it('detectLocale usa el navegador, acepta variantes y cae en español', () => {
    expect(detectLocale(['pt-PT', 'en'])).toBe('pt')
    expect(detectLocale(['fr-CA'])).toBe('fr')
    expect(detectLocale(['de-AT', 'es'])).toBe('de')
    expect(detectLocale(['it-IT', 'ja'])).toBe('es')
    expect(detectLocale(['xx', 'en-GB'])).toBe('en')
    expect(detectLocale([])).toBe('es')
    expect(detectLocale(undefined)).toBe('es')
  })
})

describe('interpolate', () => {
  it('reemplaza variables y deja visibles las que faltan', () => {
    expect(interpolate('Hola, {name}', { name: 'Gabi' }, 'es')).toBe('Hola, Gabi')
    expect(interpolate('Hola, {name}', {}, 'es')).toBe('Hola, {name}')
    expect(interpolate('sin variables', undefined, 'es')).toBe('sin variables')
  })

  it('plurales en español, inglés y francés (0 es singular en francés)', () => {
    const tpl = '{count, plural, one {# día} other {# días}}'
    expect(interpolate(tpl, { count: 1 }, 'es')).toBe('1 día')
    expect(interpolate(tpl, { count: 3 }, 'es')).toBe('3 días')
    expect(interpolate('{count, plural, one {# day} other {# days}}', { count: 1 }, 'en')).toBe('1 day')
    expect(interpolate('{count, plural, one {# jour} other {# jours}}', { count: 0 }, 'fr')).toBe('0 jour')
    expect(interpolate('{count, plural, one {# jour} other {# jours}}', { count: 2 }, 'fr')).toBe('2 jours')
  })

  it('formatea el número con el idioma y admite =0 y texto alrededor', () => {
    const tpl = 'Tienes {count, plural, =0 {ningún viaje} one {# viaje} other {# viajes}} guardados'
    expect(interpolate(tpl, { count: 0 }, 'es')).toBe('Tienes ningún viaje guardados')
    expect(interpolate(tpl, { count: 1200 }, 'es')).toContain('1200 viajes'.replace('1200', new Intl.NumberFormat('es-CO').format(1200)))
    expect(interpolate('{n, plural, other {# Gäste}}', { n: 1500 }, 'de')).toBe(`${new Intl.NumberFormat('de-DE').format(1500)} Gäste`)
  })

  it('puede anidar variables dentro de una rama', () => {
    expect(interpolate('{count, plural, one {# noche en {place}} other {# noches en {place}}}', { count: 2, place: 'Salento' }, 'es')).toBe('2 noches en Salento')
  })

  it('portugués: 0 y 1 son singular', () => {
    expect(interpolate('{count, plural, one {# dia} other {# dias}}', { count: 0 }, 'pt')).toBe('0 dia')
    expect(interpolate('{count, plural, one {# dia} other {# dias}}', { count: 1 }, 'pt')).toBe('1 dia')
  })
})

describe('createTranslator', () => {
  const es = { 'a': 'Hola', 'b': 'Solo español', 'c': '{n, plural, one {# viaje} other {# viajes}}' }
  const en = { 'a': 'Hello', 'c': '{n, plural, one {# trip} other {# trips}}' }

  it('traduce y recurre al español cuando falta la clave', () => {
    const t = createTranslator('en', en, es)
    expect(t('a')).toBe('Hello')
    expect(t('b')).toBe('Solo español')
    expect(t('c', { n: 2 })).toBe('2 trips')
    expect(t.locale).toBe('en')
  })

  it('una clave inexistente devuelve la propia clave (visible en desarrollo)', () => {
    expect(createTranslator('en', en, es)('no.existe')).toBe('no.existe')
  })

  it('has() distingue lo traducido de lo que usa respaldo', () => {
    const t = createTranslator('en', en, es)
    expect(t.has('a')).toBe(true)
    expect(t.has('b')).toBe(false)
  })

  it('el respaldo en español usa las reglas de plural del español', () => {
    const t = createTranslator('fr', {}, es)
    expect(t('c', { n: 0 })).toBe('0 viajes')
  })
})
