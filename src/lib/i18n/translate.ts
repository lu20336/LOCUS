/**
 * Motor de traducción (sin dependencias, ~100 líneas) en lugar de i18next/FormatJS.
 * Cubre lo que LOCUS necesita: claves planas tipadas, interpolación {nombre}, plurales
 * con la sintaxis ICU mínima y respaldo en español cuando falta una clave.
 *
 *   t('trips.days', { count: 3 })   // "{count, plural, one {# día} other {# días}}"
 *   t('greeting.hello', { name })   // "Hola, {name}"
 *
 * Plurales: {variable, plural, zero {…} one {…} two {…} few {…} many {…} other {…} =0 {…}}
 * "#" dentro de la rama se reemplaza por el número formateado con el idioma.
 */
import type { Locale } from './locales'
import { LOCALE_META } from './locales'

export type Vars = Record<string, string | number>
export type Dictionary = Record<string, string>

/** Encuentra la llave que cierra el "{" de `start` (soporta llaves anidadas). */
function matchBrace(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return i
  }
  return -1
}

function formatPlural(spec: string, vars: Vars, locale: Locale): string {
  // spec = "count, plural, one {# día} other {# días}"
  const head = /^\s*(\w+)\s*,\s*plural\s*,/.exec(spec)
  if (!head) return `{${spec}}`
  const value = Number(vars[head[1]] ?? 0)
  const branches = new Map<string, string>()
  let rest = spec.slice(head[0].length)
  for (;;) {
    const m = /^\s*(=?\w+)\s*\{/.exec(rest)
    if (!m) break
    const open = m[0].length - 1
    const close = matchBrace(rest, open)
    if (close < 0) break
    branches.set(m[1], rest.slice(open + 1, close))
    rest = rest.slice(close + 1)
  }
  const category = new Intl.PluralRules(LOCALE_META[locale].bcp47).select(value)
  const chosen = branches.get(`=${value}`) ?? branches.get(category) ?? branches.get('other') ?? ''
  const shown = new Intl.NumberFormat(LOCALE_META[locale].bcp47).format(value)
  return interpolate(chosen.replaceAll('#', shown), vars, locale)
}

/** Reemplaza {variable} y resuelve los bloques plural. Las variables ausentes quedan visibles ({x}) para detectar errores. */
export function interpolate(template: string, vars: Vars | undefined, locale: Locale): string {
  if (!template.includes('{')) return template
  let out = ''
  for (let i = 0; i < template.length; i++) {
    if (template[i] !== '{') {
      out += template[i]
      continue
    }
    const close = matchBrace(template, i)
    if (close < 0) {
      out += template.slice(i)
      break
    }
    const inner = template.slice(i + 1, close)
    if (inner.includes(',')) out += formatPlural(inner, vars ?? {}, locale)
    else out += vars && inner in vars ? String(vars[inner]) : `{${inner}}`
    i = close
  }
  return out
}

export interface Translator {
  (key: string, vars?: Vars): string
  locale: Locale
  /** ¿Existe la clave en el idioma actual (sin respaldo)? */
  has: (key: string) => boolean
}

/** Crea `t` para un idioma con respaldo en `fallback` (español) y, al final, la propia clave. */
export function createTranslator(locale: Locale, dictionary: Dictionary, fallback: Dictionary): Translator {
  const t = ((key: string, vars?: Vars) => {
    const template = dictionary[key] ?? fallback[key]
    if (template === undefined) return key
    return interpolate(template, vars, dictionary[key] === undefined ? 'es' : locale)
  }) as Translator
  t.locale = locale
  t.has = (key) => key in dictionary
  return t
}
