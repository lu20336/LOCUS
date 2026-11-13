/**
 * Cálculo de tarifas y reglas de reserva. Funciones PURAS: el navegador las
 * usa para mostrar el precio y las reglas de Firestore (firestore.rules)
 * repiten la misma aritmética para rechazar cualquier valor manipulado.
 * Si cambias una fórmula aquí, cámbiala también en firestore.rules.
 */
import type { CancellationPolicy, ExperiencePricing, Listing, StayPricing } from './types'
import { daysUntil, eachNight, isIsoDate, nightsBetween } from './dates'

export const MAX_STAY_NIGHTS = 30

export interface StayRequest {
  checkIn: string
  checkOut: string
  guests: number
}

type PricedListing = Pick<
  Listing,
  'pricePerNight' | 'cleaningFee' | 'includedGuests' | 'extraGuestFee' | 'capacity' | 'minNights' | 'maxNights'
>

/** Primer problema de la solicitud (texto para el usuario) o null si es válida. */
export function validateStay(listing: PricedListing, request: StayRequest, today: string): string | null {
  if (!isIsoDate(request.checkIn) || !isIsoDate(request.checkOut)) return 'Elige las fechas de llegada y salida.'
  if (request.checkIn < today) return 'La llegada no puede estar en el pasado.'
  const nights = nightsBetween(request.checkIn, request.checkOut)
  if (nights < 1) return 'La salida debe ser posterior a la llegada.'
  if (nights < listing.minNights) return `La estadía mínima es de ${listing.minNights} ${listing.minNights === 1 ? 'noche' : 'noches'}.`
  if (nights > Math.min(listing.maxNights, MAX_STAY_NIGHTS)) {
    return `La estadía máxima es de ${Math.min(listing.maxNights, MAX_STAY_NIGHTS)} noches.`
  }
  if (!Number.isInteger(request.guests) || request.guests < 1) return 'Indica cuántos huéspedes viajan.'
  if (request.guests > listing.capacity) return `Este alojamiento admite hasta ${listing.capacity} huéspedes.`
  return null
}

export function quoteStay(listing: PricedListing, request: StayRequest): StayPricing {
  const nights = nightsBetween(request.checkIn, request.checkOut)
  const subtotal = listing.pricePerNight * nights
  const extraGuests = Math.max(0, request.guests - listing.includedGuests)
  const extraGuestsFee = extraGuests * listing.extraGuestFee * nights
  const serviceFee = 0 // comisión de LOCUS: pendiente de definir
  return {
    nightly: listing.pricePerNight,
    nights,
    subtotal,
    cleaningFee: listing.cleaningFee,
    extraGuestsFee,
    serviceFee,
    total: subtotal + listing.cleaningFee + extraGuestsFee + serviceFee,
    currency: 'COP',
  }
}

export function quoteExperience(pricePerPerson: number, people: number): ExperiencePricing {
  return { perPerson: pricePerPerson, people, serviceFee: 0, total: pricePerPerson * people, currency: 'COP' }
}

/** ¿Alguna de las noches pedidas está ocupada o bloqueada? */
export function conflictingNights(
  checkIn: string,
  checkOut: string,
  booked: Record<string, unknown>,
  hostBlocked: Record<string, unknown>,
): string[] {
  return eachNight(checkIn, checkOut).filter((night) => night in booked || night in hostBlocked)
}

/**
 * Reembolso estimado según la política (informativo: mientras los pagos sean
 * simulados no se devuelve dinero real).
 *  - flexible: 100 % hasta 1 día antes; después, se descuenta la primera noche.
 *  - moderada: 100 % hasta 5 días antes; después, 50 %.
 *  - estricta: 50 % hasta 14 días antes; después, 0 %.
 */
export function refundFor(
  policy: CancellationPolicy,
  total: number,
  firstNight: number,
  checkIn: string,
  today: string,
): number {
  const days = daysUntil(today, checkIn)
  switch (policy) {
    case 'flexible':
      return days >= 1 ? total : Math.max(0, total - firstNight)
    case 'moderada':
      return days >= 5 ? total : Math.round(total * 0.5)
    case 'estricta':
      return days >= 14 ? Math.round(total * 0.5) : 0
  }
}
