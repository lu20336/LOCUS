/**
 * Completitud y coherencia de los catálogos: todos los idiomas deben tener las mismas claves
 * que el español, con los mismos marcadores {variable}, sin textos vacíos y con plurales bien cerrados.
 */
import { describe, expect, it } from 'vitest'
import { de } from '../messages/de'
import { en } from '../messages/en'
import { es } from '../messages/es'
import { fr } from '../messages/fr'
import { pt } from '../messages/pt'
import { interpolate } from '../translate'

const catalogs = { en, pt, fr, de } as const
const base = es as Record<string, string>

/** Variables usadas fuera y dentro de las ramas de plural, sin repetir y ordenadas. */
function variables(text: string): string[] {
  const names = new Set<string>()
  for (const m of text.matchAll(/\{(\w+)\s*(?:,\s*plural|\})/g)) names.add(m[1])
  return [...names].sort()
}

const balanced = (text: string) => {
  let depth = 0
  for (const ch of text) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return false
  }
  return depth === 0
}

describe('catálogos de idiomas', () => {
  for (const [locale, catalog] of Object.entries(catalogs)) {
    const dict = catalog as Record<string, string>

    it(`${locale}: tiene exactamente las mismas claves que es`, () => {
      const missing = Object.keys(base).filter((k) => !(k in dict))
      const extra = Object.keys(dict).filter((k) => !(k in base))
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it(`${locale}: sin textos vacíos y con llaves balanceadas`, () => {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim().length, key).toBeGreaterThan(0)
        expect(balanced(value), `llaves en ${key}`).toBe(true)
      }
    })

    it(`${locale}: conserva los mismos marcadores {variable} que es`, () => {
      const problems: string[] = []
      for (const [key, value] of Object.entries(dict)) {
        const expected = variables(base[key] ?? '')
        const actual = variables(value)
        if (expected.join() !== actual.join()) problems.push(`${key}: es=[${expected}] ${locale}=[${actual}]`)
      }
      expect(problems).toEqual([])
    })

    it(`${locale}: los plurales se resuelven sin dejar marcadores`, () => {
      const lc = locale as 'en' | 'pt' | 'fr' | 'de'
      for (const [key, value] of Object.entries(dict)) {
        if (!value.includes('plural')) continue
        for (const count of [0, 1, 2, 5, 21]) {
          const vars = Object.fromEntries(variables(value).map((v) => [v, count]))
          const out = interpolate(value, vars, lc)
          expect(out, `${key} (${count})`).not.toMatch(/[{}]|plural/)
        }
      }
    })
  }

  it('el apóstrofo francés no rompe la interpolación', () => {
    expect(interpolate('Plus que {count, plural, one {# jour} other {# jours}} d’attente', { count: 2 }, 'fr')).toContain('2 jours')
    expect(interpolate("L'hôte {name} n'est pas là", { name: 'Ana' }, 'fr')).toBe("L'hôte Ana n'est pas là")
  })
})
