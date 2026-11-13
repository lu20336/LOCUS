import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { saveItem, replacePhotos, setItemStatus } from '../../src/lib/catalog/repo'
import { saveDeclared, saveInference, dismissInference, loadProfile } from '../../src/lib/profile/profileService'
import { countMessage, createChat, appendMessage } from '../../src/lib/agent/chatStore'
import { cancelBooking, hostDecideBooking, placeExperienceBooking, placeStayBooking, setHostBlockedDates } from '../../src/lib/booking/bookingService'
import type { Booking, Listing } from '../../src/lib/domain/types'
import {
  ADMIN, EXPERIENCE, GUEST, GUEST2, HOST, LISTING, TINY_IMAGE, createEnv, experienceData, future, listingData, seedBase, stayBooking, today,
} from './helpers'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await createEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
  await seedBase(env)
})

const guestDb = (uid = GUEST) => env.authenticatedContext(uid).firestore()
const hostDb = () => env.authenticatedContext(HOST).firestore()
const adminDb = () => env.authenticatedContext(ADMIN).firestore()
const anonDb = () => env.unauthenticatedContext().firestore()

/** Un Listing como lo lee la app (lo que necesita placeStayBooking). */
const listing = (overrides: Partial<Listing> = {}): Listing =>
  ({
    id: LISTING, hostId: HOST, status: 'published', title: 'Cabaña con vista al valle', type: 'cabana',
    capacity: 4, bedrooms: 2, beds: 3, bathrooms: 1, pricePerNight: 200000, cleaningFee: 30000, includedGuests: 2,
    extraGuestFee: 20000, minNights: 1, maxNights: 14, bookingMode: 'instant', cancellationPolicy: 'flexible', ...overrides,
  }) as Listing

const stay = (checkIn: string, checkOut: string, guests = 2) => ({ checkIn, checkOut, guests })

async function book(uid: string, checkIn: string, checkOut: string, guests = 2, l = listing()) {
  return placeStayBooking(guestDb(uid), { listing: l, guestId: uid, guestName: 'Gabi', request: stay(checkIn, checkOut, guests), today: today() })
}

async function readBooking(id: string): Promise<Booking> {
  let data: object | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'bookings', id))).data()
  })
  return { id, ...(data as object) } as Booking
}

/** La operación debe fallar: sea por la validación del cliente (BookingError) o por las reglas (permission-denied). */
async function rejected(operation: Promise<unknown>) {
  try {
    await operation
  } catch {
    return
  }
  throw new Error('Se esperaba que la operación fuera rechazada, pero tuvo éxito')
}

/** Reserva "tramposa": se salta la validación del cliente y habla directo con Firestore. */
async function rawStay(uid: string, checkIn: string, checkOut: string, bookedAfter: (d: string[]) => Record<string, string>, guests = 2) {
  const db = guestDb(uid)
  const id = doc(collection(db, 'bookings')).id
  const data = stayBooking(checkIn, checkOut, guests, uid)
  return runTransaction(db, async (tx) => {
    tx.set(doc(db, 'bookings', id), data)
    tx.set(doc(db, 'listings', LISTING, 'calendar', 'main'), { booked: bookedAfter(data.dates), hostBlocked: {}, lastBookingId: id })
  })
}

describe('lectura pública y privacidad', () => {
  it('cualquiera lee un alojamiento publicado, pero no un borrador ajeno', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'listings', 'draft1'), listingData({ status: 'draft' }))
    })
    await assertSucceeds(getDoc(doc(anonDb(), 'listings', LISTING)))
    await assertFails(getDoc(doc(anonDb(), 'listings', 'draft1')))
    await assertSucceeds(getDoc(doc(hostDb(), 'listings', 'draft1')))
  })

  it('la consulta pública solo funciona filtrando por status=published', async () => {
    await assertSucceeds(getDocs(query(collection(anonDb(), 'listings'), where('status', '==', 'published'))))
    await assertFails(getDocs(collection(anonDb(), 'listings')))
  })

  it('el perfil del viajero, favoritos y chats son privados', async () => {
    await assertSucceeds(setDoc(doc(guestDb(), 'users', GUEST, 'travelerProfile', 'main'), {
      declared: { vibe: ['playa'] }, inferred: {}, version: 1, completedAt: null, updatedAt: serverTimestamp(),
    }))
    await assertFails(getDoc(doc(guestDb(GUEST2), 'users', GUEST, 'travelerProfile', 'main')))
    await assertFails(getDoc(doc(anonDb(), 'users', GUEST, 'travelerProfile', 'main')))
    await assertFails(setDoc(doc(guestDb(GUEST2), 'users', GUEST, 'favorites', 'x'), { kind: 'listing', refId: 'a', title: 't' }))
  })
})

describe('publicación de alojamientos (anfitrión)', () => {
  it('un anfitrión crea borradores y los envía a revisión, pero no se auto-publica', async () => {
    await assertSucceeds(setDoc(doc(hostDb(), 'listings', 'n1'), listingData({ status: 'draft' })))
    await assertSucceeds(setDoc(doc(hostDb(), 'listings', 'n2'), listingData({ status: 'pending' })))
    await assertFails(setDoc(doc(hostDb(), 'listings', 'n3'), listingData({ status: 'published' })))
    await assertFails(updateDoc(doc(hostDb(), 'listings', 'n1'), { status: 'published', updatedAt: serverTimestamp() }))
  })

  it('sin perfil de anfitrión no se puede publicar', async () => {
    await assertFails(setDoc(doc(guestDb(), 'listings', 'n1'), listingData({}, GUEST)))
  })

  it('no se puede publicar a nombre de otro anfitrión', async () => {
    await assertFails(setDoc(doc(guestDb(), 'listings', 'n1'), listingData({}, HOST)))
  })

  it('rechaza precios, coordenadas y portadas inválidas', async () => {
    await assertFails(setDoc(doc(hostDb(), 'listings', 'a'), listingData({ pricePerNight: 5 })))
    await assertFails(setDoc(doc(hostDb(), 'listings', 'b'), listingData({ lat: 40.4, lon: -3.7 })))
    await assertFails(setDoc(doc(hostDb(), 'listings', 'c'), listingData({ cover: 'https://ejemplo.com/foto.jpg' })))
    await assertFails(setDoc(doc(hostDb(), 'listings', 'd'), listingData({ capacity: 0 })))
    await assertFails(setDoc(doc(hostDb(), 'listings', 'e'), listingData({ campoExtra: 'x' })))
  })

  it('solo el administrador publica o rechaza', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'listings', 'p1'), listingData({ status: 'pending' }))
    })
    await assertFails(updateDoc(doc(hostDb(), 'listings', 'p1'), { status: 'published', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(guestDb(), 'listings', 'p1'), { status: 'published', updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(adminDb(), 'listings', 'p1'), { status: 'published', updatedAt: serverTimestamp() }))
  })

  it('las fotos solo las sube el dueño, con ID p0..p19 y tamaño acotado', async () => {
    const photo = (dataUrl = TINY_IMAGE) => ({ order: 0, dataUrl, alt: '' })
    await assertSucceeds(setDoc(doc(hostDb(), 'listings', LISTING, 'photos', 'p0'), photo()))
    await assertFails(setDoc(doc(hostDb(), 'listings', LISTING, 'photos', 'p20'), photo()))
    await assertFails(setDoc(doc(guestDb(), 'listings', LISTING, 'photos', 'p1'), photo()))
    await assertFails(setDoc(doc(hostDb(), 'listings', LISTING, 'photos', 'p2'), photo('data:text/html;base64,AAAA')))
    await assertFails(setDoc(doc(hostDb(), 'listings', LISTING, 'photos', 'p3'), photo(`data:image/webp;base64,${'A'.repeat(460000)}`)))
  })
})

describe('reservas de alojamientos', () => {
  it('reserva válida: queda confirmada y ocupa las noches', async () => {
    const id = await book(GUEST, future(10), future(13))
    const b = await readBooking(id)
    if (b.status !== 'confirmed') throw new Error(`estado inesperado ${b.status}`)
    const cal = await assertSucceeds(getDoc(doc(anonDb(), 'listings', LISTING, 'calendar', 'main')))
    const booked = Object.keys(cal.data()!.booked)
    if (booked.length !== 3) throw new Error(`se esperaban 3 noches ocupadas y hay ${booked.length}`)
  })

  it('no permite reservar noches ocupadas (ni parcialmente)', async () => {
    await book(GUEST, future(10), future(13))
    await rejected(book(GUEST2, future(12), future(15)))
    await rejected(book(GUEST2, future(10), future(11)))
  })

  it('SERVIDOR: las reglas rechazan pisar noches ya ocupadas aunque se salte la validación del cliente', async () => {
    await book(GUEST, future(10), future(13))
    // intento 1: sobrescribir el calendario con otra reserva que incluye noches ocupadas
    await assertFails(rawStay(GUEST2, future(12), future(15), (d) => ({ [future(10)]: 'booking', [future(11)]: 'booking', [future(12)]: 'booking', ...Object.fromEntries(d.map((x) => [x, 'booking'])) })))
    // intento 2: borrar las noches de la otra reserva y quedarse con ellas
    await assertFails(rawStay(GUEST2, future(10), future(13), (d) => Object.fromEntries(d.map((x) => [x, 'booking']))))
  })

  it('permite reservas consecutivas (la salida de una es la llegada de otra)', async () => {
    await book(GUEST, future(10), future(13))
    await assertSucceeds(book(GUEST2, future(13), future(15)))
  })

  it('dos reservas simultáneas del mismo rango: solo una gana', async () => {
    const results = await Promise.allSettled([book(GUEST, future(20), future(23)), book(GUEST2, future(20), future(23))])
    const ok = results.filter((r) => r.status === 'fulfilled').length
    if (ok !== 1) throw new Error(`se esperaba exactamente 1 reserva ganadora y hubo ${ok}`)
  })

  it('las reglas rechazan un precio manipulado desde el navegador', async () => {
    const db = guestDb()
    const id = doc(collection(db, 'bookings')).id
    const data = stayBooking(future(10), future(12), 2, GUEST)
    const cheat = { ...data, pricing: { ...data.pricing, total: 1000, subtotal: 1000 } }
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), cheat)
      tx.set(doc(db, 'listings', LISTING, 'calendar', 'main'), {
        booked: Object.fromEntries(cheat.dates.map((d) => [d, 'booking'])), hostBlocked: {}, lastBookingId: id,
      })
    }))
  })

  it('las reglas rechazan una reserva que no toca el calendario (sin bloquear noches)', async () => {
    const db = guestDb()
    await assertFails(setDoc(doc(db, 'bookings', 'sinCalendario'), stayBooking(future(10), future(12), 2, GUEST)))
  })

  it('las reglas rechazan bloquear noches distintas a las de la reserva', async () => {
    const db = guestDb()
    const id = doc(collection(db, 'bookings')).id
    const data = stayBooking(future(10), future(12), 2, GUEST)
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), data)
      tx.set(doc(db, 'listings', LISTING, 'calendar', 'main'), {
        booked: { [future(10)]: 'booking', [future(30)]: 'booking' }, hostBlocked: {}, lastBookingId: id,
      })
    }))
  })

  it('rechaza reservar con fechas pasadas, huéspedes de más, o a nombre de otro', async () => {
    await rejected(book(GUEST, future(-3), future(-1)))
    await rejected(book(GUEST, future(10), future(12), 9))
    const db = guestDb()
    const id = doc(collection(db, 'bookings')).id
    const data = stayBooking(future(10), future(12), 2, GUEST2)
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), data)
      tx.set(doc(db, 'listings', LISTING, 'calendar', 'main'), {
        booked: Object.fromEntries(data.dates.map((d) => [d, 'booking'])), hostBlocked: {}, lastBookingId: id,
      })
    }))
  })

  it('el anfitrión no puede reservar su propio alojamiento', async () => {
    await rejected(placeStayBooking(hostDb(), { listing: listing(), guestId: HOST, guestName: 'Ana', request: stay(future(10), future(12)), today: today() }))
  })

  it('modo solicitud: la reserva nace pendiente y el anfitrión la confirma', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'listings', LISTING), { bookingMode: 'request' })
    })
    const id = await book(GUEST, future(10), future(12), 2, listing({ bookingMode: 'request' }))
    const pending = await readBooking(id)
    if (pending.status !== 'pending') throw new Error('debía quedar pendiente')
    await assertSucceeds(hostDecideBooking(hostDb(), pending, 'confirm', today()))
    // el huésped no puede confirmarse a sí mismo una reserva ajena
    await assertFails(updateDoc(doc(guestDb(GUEST2), 'bookings', id), { status: 'confirmed', updatedAt: serverTimestamp() }))
  })

  it('el huésped y el anfitrión ven la reserva; un tercero no', async () => {
    const id = await book(GUEST, future(10), future(12))
    await assertSucceeds(getDoc(doc(guestDb(), 'bookings', id)))
    await assertSucceeds(getDoc(doc(hostDb(), 'bookings', id)))
    await assertFails(getDoc(doc(guestDb(GUEST2), 'bookings', id)))
    await assertFails(getDoc(doc(anonDb(), 'bookings', id)))
  })
})

describe('cancelaciones', () => {
  it('cancelar libera las noches y permite que otro reserve', async () => {
    const id = await book(GUEST, future(10), future(13))
    await assertSucceeds(cancelBooking(guestDb(), await readBooking(id), 'guest', today()))
    if ((await readBooking(id)).status !== 'cancelled_by_guest') throw new Error('no quedó cancelada')
    await assertSucceeds(book(GUEST2, future(10), future(13)))
  })

  it('cancelar sin liberar las noches es rechazado', async () => {
    const id = await book(GUEST, future(10), future(13))
    await assertFails(updateDoc(doc(guestDb(), 'bookings', id), { status: 'cancelled_by_guest', updatedAt: serverTimestamp() }))
  })

  it('liberar noches ajenas (sin cancelar la reserva) es rechazado', async () => {
    const id = await book(GUEST, future(10), future(13))
    const db = guestDb(GUEST2)
    await assertFails(updateDoc(doc(db, 'listings', LISTING, 'calendar', 'main'), { booked: {}, lastBookingId: id }))
  })

  it('un tercero no puede cancelar reservas ajenas', async () => {
    const id = await book(GUEST, future(10), future(13))
    await rejected(cancelBooking(guestDb(GUEST2), await readBooking(id), 'guest', today()))
  })

  it('el anfitrión puede cancelar y libera las noches', async () => {
    const id = await book(GUEST, future(10), future(13))
    await assertSucceeds(cancelBooking(hostDb(), await readBooking(id), 'host', today()))
    await assertSucceeds(book(GUEST2, future(10), future(13)))
  })

  it('no se pueden editar precio ni fechas de una reserva existente', async () => {
    const id = await book(GUEST, future(10), future(13))
    await assertFails(updateDoc(doc(guestDb(), 'bookings', id), { 'pricing.total': 1, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(hostDb(), 'bookings', id), { checkIn: future(40), updatedAt: serverTimestamp() }))
  })
})

describe('calendario del anfitrión', () => {
  it('las noches bloqueadas por el anfitrión no se pueden reservar', async () => {
    await assertSucceeds(setHostBlockedDates(hostDb(), LISTING, [future(10), future(11)], true))
    await rejected(book(GUEST, future(9), future(12)))
    await assertSucceeds(book(GUEST, future(12), future(14)))
  })

  it('el anfitrión no puede borrar noches reservadas desde el calendario', async () => {
    await book(GUEST, future(10), future(12))
    await assertFails(updateDoc(doc(hostDb(), 'listings', LISTING, 'calendar', 'main'), { booked: {} }))
  })

  it('un huésped no puede bloquear noches como si fuera el anfitrión', async () => {
    await rejected(setHostBlockedDates(guestDb(), LISTING, [future(10)], true))
  })
})

describe('experiencias y cupos', () => {
  const exp = () => ({
    id: EXPERIENCE, hostId: HOST, status: 'published', title: 'Caminata por el Valle de Cocora', capacity: 6, pricePerPerson: 80000,
    startTimes: ['08:00'], weekdays: [0, 1, 2, 3, 4, 5, 6], cancellationPolicy: 'flexible',
  }) as never

  const bookExp = (uid: string, people: number, date = future(5)) =>
    placeExperienceBooking(guestDb(uid), { experience: exp(), guestId: uid, guestName: 'Gabi', date, startTime: '08:00', people, today: today() })

  it('respeta el cupo máximo de la sesión', async () => {
    await assertSucceeds(bookExp(GUEST, 4))
    await rejected(bookExp(GUEST2, 3))
    await assertSucceeds(bookExp(GUEST2, 2))
  })

  it('SERVIDOR: las reglas rechazan superar el cupo aunque se salte la validación del cliente', async () => {
    await assertSucceeds(bookExp(GUEST, 4))
    const db = guestDb(GUEST2)
    const id = doc(collection(db, 'bookings')).id
    const base = {
      kind: 'experience', itemId: EXPERIENCE, itemTitle: 'x', hostId: HOST, guestId: GUEST2, guestName: 'g', status: 'confirmed',
      date: future(5), startTime: '08:00', people: 3, cancellationPolicy: 'flexible',
      payment: { mode: 'simulado', status: 'simulated_paid' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      pricing: { perPerson: 80000, people: 3, serviceFee: 0, total: 240000, currency: 'COP' },
    }
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), base)
      tx.set(doc(db, 'experiences', EXPERIENCE, 'slots', `${future(5)}_0800`), { booked: 7, lastBookingId: id })
    }))
    // y tampoco se puede "reiniciar" el contador para colarse
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), base)
      tx.set(doc(db, 'experiences', EXPERIENCE, 'slots', `${future(5)}_0800`), { booked: 3, lastBookingId: id })
    }))
  })

  it('cancelar devuelve los cupos', async () => {
    const id = await bookExp(GUEST, 6)
    await rejected(bookExp(GUEST2, 1))
    await assertSucceeds(cancelBooking(guestDb(), await readBooking(id), 'guest', today()))
    await assertSucceeds(bookExp(GUEST2, 1))
  })

  it('rechaza un precio manipulado y personas de más', async () => {
    const db = guestDb()
    const id = doc(collection(db, 'bookings')).id
    const base = {
      kind: 'experience', itemId: EXPERIENCE, itemTitle: 'x', hostId: HOST, guestId: GUEST, guestName: 'g', status: 'confirmed',
      date: future(5), startTime: '08:00', people: 2, cancellationPolicy: 'flexible',
      payment: { mode: 'simulado', status: 'simulated_paid' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }
    await assertFails(runTransaction(db, async (tx) => {
      tx.set(doc(db, 'bookings', id), { ...base, pricing: { perPerson: 1, people: 2, serviceFee: 0, total: 2, currency: 'COP' } })
      tx.set(doc(db, 'experiences', EXPERIENCE, 'slots', `${future(5)}_0800`), { booked: 2, lastBookingId: id })
    }))
  })

  it('publicación: solo un anfitrión crea experiencias y no se auto-publica', async () => {
    await assertSucceeds(setDoc(doc(hostDb(), 'experiences', 'e1'), experienceData()))
    await assertFails(setDoc(doc(hostDb(), 'experiences', 'e2'), experienceData({ status: 'published' })))
    await assertFails(setDoc(doc(guestDb(), 'experiences', 'e3'), experienceData({}, GUEST)))
  })
})

describe('reseñas', () => {
  it('solo el huésped de una reserva completada puede reseñar', async () => {
    const id = await book(GUEST, future(10), future(12))
    const review = { kind: 'listing', itemId: LISTING, guestId: GUEST, guestName: 'Gabi', rating: 5, text: 'Excelente', createdAt: serverTimestamp() }
    await assertFails(setDoc(doc(guestDb(), 'reviews', id), review)) // aún no completada
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'bookings', id), { status: 'completed' })
    })
    await assertFails(setDoc(doc(guestDb(GUEST2), 'reviews', id), { ...review, guestId: GUEST2 }))
    await assertFails(setDoc(doc(guestDb(), 'reviews', id), { ...review, rating: 9 }))
    await assertSucceeds(setDoc(doc(guestDb(), 'reviews', id), review))
  })
})

describe('flujo de publicación tal como lo ejecuta la interfaz del anfitrión', () => {
  const input = () => {
    const { hostId: _h, status: _s, createdAt: _c, updatedAt: _u, ...rest } = listingData({ cover: TINY_IMAGE }) as Record<string, unknown>
    return rest as never
  }

  it('crear borrador → fotos → enviar a revisión → editar → volver a borrador', async () => {
    const db = hostDb()
    const id = await saveItem(db, 'listings', HOST, input(), 'draft')
    await assertSucceeds(replacePhotos(db, 'listings', id, [{ dataUrl: TINY_IMAGE, alt: '' }, { dataUrl: TINY_IMAGE, alt: 'sala' }]))
    await assertSucceeds(setItemStatus(db, 'listings', id, 'pending'))
    await assertSucceeds(saveItem(db, 'listings', HOST, { ...(input() as object), title: 'Nuevo título' } as never, 'pending', { id, createdAt: null }))
    await assertSucceeds(setItemStatus(db, 'listings', id, 'draft'))
    await assertSucceeds(replacePhotos(db, 'listings', id, [{ dataUrl: TINY_IMAGE, alt: '' }])) // quita una
    const snap = await getDocs(collection(db, 'listings', id, 'photos'))
    if (snap.size !== 1) throw new Error(`debía quedar 1 foto y hay ${snap.size}`)
  })

  it('el anfitrión no puede publicar saltándose la moderación con setItemStatus', async () => {
    const db = hostDb()
    const id = await saveItem(db, 'listings', HOST, input(), 'draft')
    await assertFails(setItemStatus(db, 'listings', id, 'published'))
  })

  it('un anfitrión no edita publicaciones de otro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'hosts', 'host2'), { displayName: 'Otro', verified: false })
    })
    const other = env.authenticatedContext('host2').firestore()
    await assertFails(setDoc(doc(other, 'listings', LISTING), listingData({ title: 'Secuestrada' }, 'host2')))
    await assertFails(updateDoc(doc(other, 'listings', LISTING), { pricePerNight: 1000000, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(other, 'listings', LISTING, 'photos', 'p0'), { order: 0, dataUrl: TINY_IMAGE, alt: '' }))
  })

  it('experiencias: crear, editar y enviar a revisión', async () => {
    const db = hostDb()
    const { hostId: _h, status: _s, createdAt: _c, updatedAt: _u, ...rest } = experienceData() as Record<string, unknown>
    const id = await saveItem(db, 'experiences', HOST, rest as never, 'draft')
    await assertSucceeds(setItemStatus(db, 'experiences', id, 'pending'))
  })

  it('perfil del viajero: el agente solo escribe inferencias y las declaradas se conservan', async () => {
    const db = guestDb()
    await assertSucceeds(saveDeclared(db, GUEST, { climate: 'frio' }, true))
    await assertSucceeds(saveInference(db, GUEST, 'playas_tranquilas', 'Prefiere playas tranquilas'))
    const profile = await loadProfile(db, GUEST)
    if (profile?.declared.climate !== 'frio') throw new Error('se perdió una respuesta declarada')
    if (Object.keys(profile.inferred).length !== 1) throw new Error('no quedó la inferencia')
    await assertSucceeds(dismissInference(db, GUEST, 'playas_tranquilas'))
    // otro usuario no puede leer ni escribir ese perfil
    await assertFails(loadProfile(guestDb(GUEST2), GUEST))
  })

  it('mensajes del agente: solo el dueño, con tope diario', async () => {
    const db = guestDb()
    const day = today()
    for (let i = 0; i < 3; i++) await assertSucceeds(countMessage(db, GUEST, day))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', GUEST, 'agentUsage', day), { count: 60 })
    })
    await assertFails(setDoc(doc(db, 'users', GUEST, 'agentUsage', day), { count: 61 }))
    const chatId = await createChat(db, GUEST, 'Mi chat')
    await assertSucceeds(appendMessage(db, GUEST, chatId, { role: 'user', text: 'hola' }))
    await assertFails(getDocs(collection(guestDb(GUEST2), 'users', GUEST, 'agentChats')))
  })
})
