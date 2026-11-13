import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { addDays, eachNight, nightsBetween } from '../../src/lib/domain/dates'
import { quoteStay } from '../../src/lib/domain/pricing'

export const HOST = 'host1'
export const GUEST = 'guest1'
export const GUEST2 = 'guest2'
export const ADMIN = 'admin1'
export const LISTING = 'listing1'
export const EXPERIENCE = 'exp1'

/** Fecha "hoy" en UTC (las reglas comparan contra request.time, que es UTC). */
export const today = () => new Date().toISOString().slice(0, 10)
export const future = (days: number) => addDays(today(), days)

/** 1×1 px WebP válido (para pasar la validación del prefijo data:image). */
export const TINY_IMAGE = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'locus-bb57e',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
}

export function listingData(overrides: Record<string, unknown> = {}, hostId = HOST) {
  return {
    hostId,
    status: 'draft',
    title: 'Cabaña con vista al valle',
    description: 'Una cabaña tranquila.',
    type: 'cabana',
    capacity: 4,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    department: 'Quindío',
    municipality: 'Salento',
    addressReference: 'Vereda Boquía',
    lat: 4.637,
    lon: -75.57,
    amenities: ['wifi'],
    pricePerNight: 200000,
    cleaningFee: 30000,
    includedGuests: 2,
    extraGuestFee: 20000,
    minNights: 1,
    maxNights: 14,
    bookingMode: 'instant',
    cancellationPolicy: 'flexible',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    rules: '',
    cover: TINY_IMAGE,
    photoCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

export function experienceData(overrides: Record<string, unknown> = {}, hostId = HOST) {
  return {
    hostId,
    status: 'draft',
    title: 'Caminata por el Valle de Cocora',
    description: 'Recorrido guiado.',
    category: 'caminata',
    department: 'Quindío',
    municipality: 'Salento',
    addressReference: 'Parque principal',
    lat: 4.637,
    lon: -75.57,
    durationMinutes: 240,
    pricePerPerson: 80000,
    capacity: 6,
    minAge: 8,
    languages: ['es'],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startTimes: ['08:00'],
    requirements: '',
    cancellationPolicy: 'flexible',
    providerName: 'Guías de Salento',
    cover: TINY_IMAGE,
    photoCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

/** Datos mínimos con las reglas deshabilitadas: anfitrión, alojamiento publicado y calendario vacío. */
export async function seedBase(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const now = Timestamp.now()
    await setDoc(doc(db, 'hosts', HOST), { displayName: 'Ana Anfitriona', bio: '', verified: false, createdAt: now, updatedAt: now })
    await setDoc(doc(db, 'admins', ADMIN), { createdAt: now })
    await setDoc(doc(db, 'listings', LISTING), { ...listingData({ status: 'published' }), createdAt: now, updatedAt: now })
    await setDoc(doc(db, 'listings', LISTING, 'calendar', 'main'), { booked: {}, hostBlocked: {}, lastBookingId: '' })
    await setDoc(doc(db, 'experiences', EXPERIENCE), { ...experienceData({ status: 'published' }), createdAt: now, updatedAt: now })
  })
}

/** Reserva de alojamiento coherente con el precio publicado (lo que enviaría el cliente real). */
export function stayBooking(checkIn: string, checkOut: string, guests = 2, guestId = GUEST, overrides: Record<string, unknown> = {}) {
  const pricing = quoteStay(
    { pricePerNight: 200000, cleaningFee: 30000, includedGuests: 2, extraGuestFee: 20000, capacity: 4, minNights: 1, maxNights: 14 },
    { checkIn, checkOut, guests },
  )
  return {
    kind: 'listing',
    itemId: LISTING,
    itemTitle: 'Cabaña con vista al valle',
    hostId: HOST,
    guestId,
    guestName: 'Gabi Huésped',
    status: 'confirmed',
    checkIn,
    checkOut,
    dates: eachNight(checkIn, checkOut),
    guests,
    pricing,
    cancellationPolicy: 'flexible',
    payment: { mode: 'simulado', status: 'simulated_paid' },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

export const nights = nightsBetween
