import { describe, expect, it } from 'vitest'
import { formatCOP, parseBudget, todayISO } from '../../format'
import { hasErrors, validateTripDetails, type TripDetailsDraft } from '../validateTripDetails'

const TODAY = '2026-10-02'
const valid: TripDetailsDraft = {
  destination: 'Cartagena',
  startDate: '2026-12-01',
  endDate: '2026-12-05',
  budget: '2.500.000',
}

describe('validateTripDetails', () => {
  it('acepta un viaje completo y coherente', () => {
    expect(validateTripDetails(valid, TODAY)).toEqual({})
    // Un viaje de un solo día también es válido.
    expect(hasErrors(validateTripDetails({ ...valid, endDate: valid.startDate }, TODAY))).toBe(false)
  })

  it('exige todos los campos', () => {
    const errors = validateTripDetails({ destination: ' ', startDate: '', endDate: '', budget: '' }, TODAY)
    expect(Object.keys(errors).sort()).toEqual(['budget', 'destination', 'endDate', 'startDate'])
  })

  it('rechaza un regreso anterior a la salida', () => {
    const errors = validateTripDetails({ ...valid, endDate: '2026-11-30' }, TODAY)
    expect(errors).toEqual({ endDate: 'La fecha de regreso debe ser igual o posterior a la de salida.' })
  })

  it('rechaza fechas pasadas y viajes de más de 14 días', () => {
    expect(validateTripDetails({ ...valid, startDate: '2026-10-01' }, TODAY).startDate).toMatch(/pasado/)
    expect(validateTripDetails({ ...valid, endDate: '2026-12-15' }, TODAY).endDate).toMatch(/14 días/)
    expect(validateTripDetails({ ...valid, endDate: '2026-12-14' }, TODAY)).toEqual({})
  })

  it('valida el presupuesto', () => {
    expect(validateTripDetails({ ...valid, budget: '0' }, TODAY).budget).toMatch(/mayor que cero/)
    expect(validateTripDetails({ ...valid, budget: 'abc' }, TODAY).budget).toMatch(/presupuesto/)
    expect(validateTripDetails({ ...valid, budget: '5000000000' }, TODAY).budget).toMatch(/alto/)
  })
})

describe('formato', () => {
  it('lee presupuestos escritos de varias formas', () => {
    expect(parseBudget('2.500.000')).toBe(2500000)
    expect(parseBudget('$ 1,200,000 COP')).toBe(1200000)
    expect(parseBudget('')).toBeNull()
  })

  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCOP(2500000).replace(/\s/g, ' ')).toBe('$ 2.500.000')
  })

  it('todayISO usa la fecha local', () => {
    expect(todayISO(new Date(2026, 9, 2, 23, 30))).toBe('2026-10-02')
  })
})
