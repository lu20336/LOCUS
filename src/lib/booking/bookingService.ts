/**
 * Operaciones de reserva sobre Firestore. Todas las operaciones críticas usan
 * TRANSACCIONES (leer-calcular-escribir de forma atómica con reintento ante
 * contención) y las reglas de firestore.rules las validan otra vez en el
 * servidor: aunque alguien manipule este código en su navegador, las reglas
 * rechazan precios alterados, noches ya ocupadas o cupos excedidos.
 *
 * El parámetro `db` se inyecta para poder probar estas funciones contra el
 * emulador con distintos usuarios (tests/rules).
 *
 * PAGOS: por ahora son SIMULADOS (payment.mode = 'simulado'). No se cobra nada.
 */
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import type { Booking, Experience, Listing } from '../domain/types'
import { eachNight } from '../domain/dates'
import { conflictingNights, quoteExperience, quoteStay, refundFor, validateStay, type StayRequest } from '../domain/pricing'
import type { StayPricing } from '../domain/types'
import { SIMULATED_PAYMENT } from './payments'

export type BookingErrorCode = 'INVALID' | 'NOT_AVAILABLE' | 'FULL' | 'NOT_ALLOWED' | 'UNKNOWN'

export class BookingError extends Error {
  readonly code: BookingErrorCode
  constructor(code: BookingErrorCode, message: string) {
    super(message)
    this.name = 'BookingError'
    this.code = code
  }
}

const PAYMENT = SIMULATED_PAYMENT

/** Traduce un error de Firestore a un mensaje comprensible. */
export function toBookingError(error: unknown): BookingError {
  if (error instanceof BookingError) return error
  const code = (error as { code?: string } | null)?.code
  if (code === 'permission-denied') {
    return new BookingError(
      'NOT_ALLOWED',
      'No pudimos confirmar la reserva: alguien pudo reservar esas fechas justo antes, o los datos cambiaron. Revisa la disponibilidad e inténtalo de nuevo.',
    )
  }
  return new BookingError('UNKNOWN', 'No pudimos completar la reserva. Revisa tu conexión e inténtalo de nuevo.')
}

export interface StayBookingArgs {
  listing: Listing
  guestId: string
  guestName: string
  request: StayRequest
  today: string
}

/** Reserva un alojamiento. Devuelve el ID de la reserva. */
export async function placeStayBooking(db: Firestore, args: StayBookingArgs): Promise<string> {
  const { listing, guestId, guestName, request, today } = args
  const problem = validateStay(listing, request, today)
  if (problem) throw new BookingError('INVALID', problem)
  if (listing.hostId === guestId) throw new BookingError('NOT_ALLOWED', 'No puedes reservar tu propio alojamiento.')

  const bookingRef = doc(collection(db, 'bookings'))
  const calendarRef = doc(db, 'listings', listing.id, 'calendar', 'main')
  const pricing = quoteStay(listing, request)
  const dates = eachNight(request.checkIn, request.checkOut)

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(calendarRef)
      const calendar = snap.exists() ? snap.data() : { booked: {}, hostBlocked: {} }
      const taken = conflictingNights(request.checkIn, request.checkOut, calendar.booked ?? {}, calendar.hostBlocked ?? {})
      if (taken.length > 0) {
        throw new BookingError('NOT_AVAILABLE', 'Esas fechas ya no están disponibles. Elige otras noches.')
      }
      tx.set(bookingRef, {
        kind: 'listing',
        itemId: listing.id,
        itemTitle: listing.title,
        hostId: listing.hostId,
        guestId,
        guestName,
        status: listing.bookingMode === 'instant' ? 'confirmed' : 'pending',
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        dates,
        guests: request.guests,
        pricing,
        cancellationPolicy: listing.cancellationPolicy,
        payment: PAYMENT,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const booked = { ...(calendar.booked ?? {}) }
      for (const night of dates) booked[night] = 'booking'
      tx.set(calendarRef, { booked, hostBlocked: calendar.hostBlocked ?? {}, lastBookingId: bookingRef.id })
    })
  } catch (error) {
    throw toBookingError(error)
  }
  return bookingRef.id
}

export interface ExperienceBookingArgs {
  experience: Experience
  guestId: string
  guestName: string
  date: string
  startTime: string
  people: number
  today: string
}

export const slotId = (date: string, startTime: string) => `${date}_${startTime.replace(':', '')}`

/** Reserva cupos en una sesión de una experiencia. */
export async function placeExperienceBooking(db: Firestore, args: ExperienceBookingArgs): Promise<string> {
  const { experience, guestId, guestName, date, startTime, people, today } = args
  if (date < today) throw new BookingError('INVALID', 'Elige una fecha que no haya pasado.')
  if (!experience.startTimes.includes(startTime)) throw new BookingError('INVALID', 'Elige un horario disponible.')
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (!experience.weekdays.includes(weekday)) throw new BookingError('INVALID', 'La experiencia no se ofrece ese día.')
  if (!Number.isInteger(people) || people < 1) throw new BookingError('INVALID', 'Indica cuántas personas van.')
  if (people > experience.capacity) throw new BookingError('FULL', `El cupo máximo es de ${experience.capacity} personas.`)
  if (experience.hostId === guestId) throw new BookingError('NOT_ALLOWED', 'No puedes reservar tu propia experiencia.')

  const bookingRef = doc(collection(db, 'bookings'))
  const slotRef = doc(db, 'experiences', experience.id, 'slots', slotId(date, startTime))
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(slotRef)
      const booked = snap.exists() ? (snap.data().booked as number) : 0
      if (booked + people > experience.capacity) {
        throw new BookingError('FULL', `Solo quedan ${Math.max(0, experience.capacity - booked)} cupos en esa sesión.`)
      }
      tx.set(bookingRef, {
        kind: 'experience',
        itemId: experience.id,
        itemTitle: experience.title,
        hostId: experience.hostId,
        guestId,
        guestName,
        status: 'confirmed',
        date,
        startTime,
        people,
        pricing: quoteExperience(experience.pricePerPerson, people),
        cancellationPolicy: experience.cancellationPolicy,
        payment: PAYMENT,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      tx.set(slotRef, { booked: booked + people, lastBookingId: bookingRef.id })
    })
  } catch (error) {
    throw toBookingError(error)
  }
  return bookingRef.id
}

/** Cancela una reserva (huésped o anfitrión) y libera sus noches o cupos en el mismo lote. */
export async function cancelBooking(
  db: Firestore,
  booking: Booking,
  by: 'guest' | 'host',
  today: string,
): Promise<void> {
  const bookingRef = doc(db, 'bookings', booking.id)
  try {
    await runTransaction(db, async (tx) => {
      let refundAmount = 0
      if (booking.kind === 'listing') {
        const pricing = booking.pricing as StayPricing
        refundAmount =
          by === 'host' ? pricing.total : refundFor(booking.cancellationPolicy, pricing.total, pricing.nightly, booking.checkIn!, today)
        const calendarRef = doc(db, 'listings', booking.itemId, 'calendar', 'main')
        const snap = await tx.get(calendarRef)
        const calendar = snap.data() ?? { booked: {}, hostBlocked: {} }
        const booked = { ...(calendar.booked ?? {}) }
        for (const night of booking.dates ?? []) delete booked[night]
        tx.update(calendarRef, { booked, lastBookingId: booking.id })
      } else {
        refundAmount = (booking.pricing as { total: number }).total
        const ref = doc(db, 'experiences', booking.itemId, 'slots', slotId(booking.date!, booking.startTime!))
        const snap = await tx.get(ref)
        const booked = (snap.data()?.booked as number | undefined) ?? 0
        tx.update(ref, { booked: booked - (booking.people ?? 0), lastBookingId: booking.id })
      }
      tx.update(bookingRef, {
        status: by === 'guest' ? 'cancelled_by_guest' : 'cancelled_by_host',
        refundAmount,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    throw toBookingError(error)
  }
}

/** El anfitrión confirma una solicitud pendiente o la rechaza (liberando las noches). */
export async function hostDecideBooking(db: Firestore, booking: Booking, decision: 'confirm' | 'reject', today: string) {
  if (decision === 'reject') return cancelBooking(db, booking, 'host', today)
  try {
    await runTransaction(db, async (tx) => {
      tx.update(doc(db, 'bookings', booking.id), { status: 'confirmed', updatedAt: serverTimestamp() })
    })
  } catch (error) {
    throw toBookingError(error)
  }
}

/** El anfitrión marca la reserva como completada (habilita la reseña del huésped). */
export async function completeBooking(db: Firestore, booking: Booking) {
  try {
    await runTransaction(db, async (tx) => {
      tx.update(doc(db, 'bookings', booking.id), { status: 'completed', updatedAt: serverTimestamp() })
    })
  } catch (error) {
    throw toBookingError(error)
  }
}

/** El anfitrión bloquea o libera noches (mantenimiento, uso propio, otra plataforma…). */
export async function setHostBlockedDates(db: Firestore, listingId: string, dates: string[], blocked: boolean) {
  const ref = doc(db, 'listings', listingId, 'calendar', 'main')
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.data() ?? { booked: {}, hostBlocked: {}, lastBookingId: '' }
      const hostBlocked = { ...(data.hostBlocked ?? {}) }
      for (const night of dates) {
        if (blocked) hostBlocked[night] = 'host'
        else delete hostBlocked[night]
      }
      tx.set(ref, { booked: data.booked ?? {}, hostBlocked, lastBookingId: data.lastBookingId ?? '' })
    })
  } catch (error) {
    throw toBookingError(error)
  }
}
