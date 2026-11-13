import { describe, expect, it } from 'vitest'
import { addDays, eachNight, nightsBetween } from '../dates'
import { conflictingNights, quoteExperience, quoteStay, refundFor, validateStay } from '../pricing'
import { hasFormErrors, inColombia, validateExperienceDraft, validateListingDraft, type ExperienceDraft, type ListingDraft } from '../validation'

const listing = { pricePerNight: 200000, cleaningFee: 30000, includedGuests: 2, extraGuestFee: 20000, capacity: 4, minNights: 2, maxNights: 10 }

describe('fechas de calendario', () => {
  it('cuenta noches (salida excluida)', () => {
    expect(nightsBetween('2026-12-10', '2026-12-13')).toBe(3)
    expect(eachNight('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
    expect(eachNight('2026-12-10', '2026-12-10')).toEqual([])
  })
  it('suma días cruzando fin de mes y de año', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('tarifas', () => {
  it('calcula noches, limpieza y huéspedes extra', () => {
    const q = quoteStay(listing, { checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 4 })
    expect(q.nights).toBe(3)
    expect(q.subtotal).toBe(600000)
    expect(q.extraGuestsFee).toBe(2 * 20000 * 3)
    expect(q.total).toBe(600000 + 30000 + 120000)
    expect(q.serviceFee).toBe(0)
  })
  it('sin huéspedes extra no cobra recargo', () => {
    expect(quoteStay(listing, { checkIn: '2026-12-10', checkOut: '2026-12-12', guests: 2 }).extraGuestsFee).toBe(0)
  })
  it('precio de experiencias por persona', () => {
    expect(quoteExperience(80000, 3).total).toBe(240000)
  })
})

describe('validación de la estadía', () => {
  const today = '2026-12-01'
  it.each([
    [{ checkIn: '2026-11-30', checkOut: '2026-12-03', guests: 2 }, /pasado/],
    [{ checkIn: '2026-12-05', checkOut: '2026-12-05', guests: 2 }, /posterior/],
    [{ checkIn: '2026-12-05', checkOut: '2026-12-06', guests: 2 }, /mínima/],
    [{ checkIn: '2026-12-05', checkOut: '2026-12-20', guests: 2 }, /máxima/],
    [{ checkIn: '2026-12-05', checkOut: '2026-12-08', guests: 9 }, /hasta 4/],
    [{ checkIn: '', checkOut: '', guests: 2 }, /fechas/],
  ])('rechaza %j', (request, message) => {
    expect(validateStay(listing, request, today)).toMatch(message)
  })
  it('acepta una solicitud válida', () => {
    expect(validateStay(listing, { checkIn: '2026-12-05', checkOut: '2026-12-08', guests: 3 }, today)).toBeNull()
  })
})

describe('disponibilidad', () => {
  it('detecta noches ocupadas o bloqueadas; la salida de uno es la llegada de otro', () => {
    const booked = { '2026-12-10': 'booking', '2026-12-11': 'booking' }
    const blocked = { '2026-12-20': 'host' }
    expect(conflictingNights('2026-12-09', '2026-12-11', booked, blocked)).toEqual(['2026-12-10'])
    expect(conflictingNights('2026-12-12', '2026-12-14', booked, blocked)).toEqual([])
    expect(conflictingNights('2026-12-11', '2026-12-13', booked, blocked)).toEqual(['2026-12-11'])
    expect(conflictingNights('2026-12-19', '2026-12-22', booked, blocked)).toEqual(['2026-12-20'])
    // el huésped que sale el 10 puede ser reemplazado por quien llega el 12
    expect(conflictingNights('2026-12-12', '2026-12-13', booked, blocked)).toEqual([])
  })
})

describe('reembolsos según la política', () => {
  const total = 600000
  const night = 200000
  it('flexible: total hasta 1 día antes; después se cobra la primera noche', () => {
    expect(refundFor('flexible', total, night, '2026-12-10', '2026-12-08')).toBe(total)
    expect(refundFor('flexible', total, night, '2026-12-10', '2026-12-10')).toBe(total - night)
  })
  it('moderada: total hasta 5 días antes; después 50 %', () => {
    expect(refundFor('moderada', total, night, '2026-12-10', '2026-12-05')).toBe(total)
    expect(refundFor('moderada', total, night, '2026-12-10', '2026-12-07')).toBe(300000)
  })
  it('estricta: 50 % hasta 14 días antes; después nada', () => {
    expect(refundFor('estricta', total, night, '2026-12-30', '2026-12-10')).toBe(300000)
    expect(refundFor('estricta', total, night, '2026-12-30', '2026-12-25')).toBe(0)
  })
})

describe('validación de formularios del anfitrión', () => {
  const ok: ListingDraft = {
    title: 'Cabaña bonita', description: 'x'.repeat(60), type: 'cabana', capacity: 4, bedrooms: 2, beds: 2, bathrooms: 1, department: 'Quindío', municipality: 'Salento',
    addressReference: '', lat: 4.63, lon: -75.57, amenities: [], pricePerNight: 150000, cleaningFee: 0, includedGuests: 2, extraGuestFee: 0, minNights: 1, maxNights: 7,
    bookingMode: 'instant', cancellationPolicy: 'flexible', checkInTime: '15:00', checkOutTime: '11:00', rules: '', photoCount: 3,
  }
  it('acepta un borrador válido', () => {
    expect(hasFormErrors(validateListingDraft(ok, true))).toBe(false)
  })
  it('exige ubicación dentro de Colombia', () => {
    expect(validateListingDraft({ ...ok, lat: 40.4, lon: -3.7 }, false).lat).toBeTruthy()
    expect(validateListingDraft({ ...ok, lat: null, lon: null }, false).lat).toBeTruthy()
    expect(inColombia(12.58, -81.7)).toBe(true) // San Andrés
    expect(inColombia(4.6, -74.08)).toBe(true)
  })
  it('para enviar a revisión pide fotos y descripción', () => {
    const e = validateListingDraft({ ...ok, photoCount: 1, description: 'corta' }, true)
    expect(e.photoCount).toBeTruthy()
    expect(e.description).toBeTruthy()
    expect(hasFormErrors(validateListingDraft({ ...ok, photoCount: 0 }, false))).toBe(false)
  })
  it('revisa precios y reglas de estadía', () => {
    expect(validateListingDraft({ ...ok, pricePerNight: 100 }, false).pricePerNight).toBeTruthy()
    expect(validateListingDraft({ ...ok, includedGuests: 9 }, false).includedGuests).toBeTruthy()
    expect(validateListingDraft({ ...ok, minNights: 5, maxNights: 2 }, false).maxNights).toBeTruthy()
    expect(validateListingDraft({ ...ok, pricePerNight: Number.NaN }, false).pricePerNight).toBeTruthy()
  })
  it('experiencias: horarios y días', () => {
    const exp: ExperienceDraft = {
      title: 'Tour', description: 'x'.repeat(60), category: 'tour', department: 'Bolívar', municipality: 'Cartagena', addressReference: '', lat: 10.4, lon: -75.5,
      durationMinutes: 120, pricePerPerson: 50000, capacity: 8, minAge: 0, languages: ['es'], weekdays: [1], startTimes: ['09:00'], requirements: '',
      cancellationPolicy: 'flexible', providerName: 'Operador', photoCount: 1,
    }
    expect(hasFormErrors(validateExperienceDraft(exp, true))).toBe(false)
    expect(validateExperienceDraft({ ...exp, startTimes: ['25:00'] }, false).startTimes).toBeTruthy()
    expect(validateExperienceDraft({ ...exp, weekdays: [] }, false).weekdays).toBeTruthy()
  })
})
