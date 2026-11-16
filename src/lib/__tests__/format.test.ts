import { describe, expect, it } from 'vitest'
import { countTripDays, formatDate, formatDateRange } from '../format'

describe('formatDateRange', () => {
  it('un solo día muestra una sola fecha', () => {
    expect(formatDateRange('2026-12-10', '2026-12-10')).toBe(formatDate('2026-12-10'))
  })

  it('mismo mes: no repite mes ni año', () => {
    expect(formatDateRange('2026-12-10', '2026-12-12')).toBe(`10–${formatDate('2026-12-12')}`)
  })

  it('meses o años distintos: las dos fechas completas', () => {
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe(`${formatDate('2026-12-30')} – ${formatDate('2027-01-02')}`)
  })
})

describe('countTripDays', () => {
  it('cuenta ambos extremos', () => {
    expect(countTripDays('2026-12-10', '2026-12-10')).toBe(1)
    expect(countTripDays('2026-12-30', '2027-01-02')).toBe(4)
  })
})
