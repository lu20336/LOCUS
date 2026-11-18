/**
 * Datos de PRUEBA para el emulador local de Firebase (npm run seed).
 *
 * Solo habla con el emulador (127.0.0.1:8080 y :9099): si no hay emuladores
 * corriendo, se detiene. NUNCA toca el proyecto real. Todo lo que crea queda
 * marcado con isTestData=true y la interfaz lo muestra como "Dato de prueba".
 *
 * Cuentas de prueba (solo existen en tu emulador local):
 *   anfitrion@locus.test  ·  huesped@locus.test  ·  admin@locus.test   (clave: locus-prueba-123)
 */
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import sharp from 'sharp'

const AUTH = 'http://127.0.0.1:9099'
const PASSWORD = 'locus-prueba-123'

async function ensureEmulators() {
  try {
    await fetch(AUTH, { signal: AbortSignal.timeout(2000) })
    await fetch('http://127.0.0.1:8080', { signal: AbortSignal.timeout(2000) })
  } catch {
    console.error('✖ No encuentro los emuladores. Inicia primero `npm run emulators` (o `npm run dev`) y vuelve a correr `npm run seed`.')
    process.exit(1)
  }
}

async function createUser(email: string, displayName: string): Promise<string> {
  const base = `${AUTH}/identitytoolkit.googleapis.com/v1/accounts`
  const body = JSON.stringify({ email, password: PASSWORD, displayName, returnSecureToken: true })
  const headers = { 'Content-Type': 'application/json' }
  let res = await fetch(`${base}:signUp?key=fake`, { method: 'POST', headers, body })
  if (!res.ok) res = await fetch(`${base}:signInWithPassword?key=fake`, { method: 'POST', headers, body })
  const json = (await res.json()) as { localId: string }
  return json.localId
}

async function photo(path: string, side: number, quality: number): Promise<string> {
  const buffer = await sharp(readFileSync(path)).resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer()
  return `data:image/webp;base64,${buffer.toString('base64')}`
}

await ensureEmulators()
const env = await initializeTestEnvironment({ projectId: 'locus-bb57e', firestore: { host: '127.0.0.1', port: 8080 } })

const hostId = await createUser('anfitrion@locus.test', 'Ana Anfitriona')
const guestId = await createUser('huesped@locus.test', 'Gabi Huésped')
const adminId = await createUser('admin@locus.test', 'Admin LOCUS')
const now = Timestamp.now()

const listings = [
  {
    id: 'salento-cabana', status: 'published', title: 'Cabaña con vista al Valle del Cocora', type: 'cabana', municipality: 'Salento', department: 'Quindío',
    lat: 4.6372, lon: -75.5703, capacity: 4, bedrooms: 2, beds: 3, bathrooms: 1, price: 220000, cleaning: 40000, extra: 30000, mode: 'instant', policy: 'moderada',
    amenities: ['wifi', 'cocina', 'terraza', 'vistas', 'estacionamiento'], cover: 'public/images/destinos/salento.jpg',
    photos: ['public/images/lugares/salento/valle-de-cocora.jpg', 'public/images/lugares/salento/mirador-de-salento.jpg', 'public/images/lugares/salento/fincas-cafeteras.jpg'],
    description: 'Cabaña de prueba rodeada de cafetales, a 10 minutos del parque principal de Salento. Ideal para parejas o familias pequeñas que buscan tranquilidad.',
  },
  {
    id: 'cartagena-apto', status: 'published', title: 'Apartamento en el Centro Histórico', type: 'apartamento', municipality: 'Cartagena de Indias', department: 'Bolívar',
    lat: 10.4236, lon: -75.5515, capacity: 5, bedrooms: 2, beds: 3, bathrooms: 2, price: 380000, cleaning: 60000, extra: 40000, mode: 'request', policy: 'estricta',
    amenities: ['wifi', 'aire', 'cocina', 'tv', 'lavadora'], cover: 'public/images/destinos/cartagena.jpg',
    photos: ['public/images/lugares/cartagena/ciudad-amurallada.jpg', 'public/images/lugares/cartagena/barrio-getsemani.jpg', 'public/images/lugares/cartagena/castillo-san-felipe-de-barajas.jpg'],
    description: 'Apartamento de prueba a pasos de la Ciudad Amurallada, con aire acondicionado y todo lo necesario para una estadía cómoda. Se reserva por solicitud.',
  },
  {
    id: 'medellin-habitacion', status: 'published', title: 'Habitación privada cerca del metro', type: 'habitacion', municipality: 'Medellín', department: 'Antioquia',
    lat: 6.2087, lon: -75.5698, capacity: 2, bedrooms: 1, beds: 1, bathrooms: 1, price: 95000, cleaning: 0, extra: 0, mode: 'instant', policy: 'flexible',
    amenities: ['wifi', 'tv', 'mascotas'], cover: 'public/images/destinos/medellin.jpg',
    photos: ['public/images/lugares/medellin/plaza-botero.jpg', 'public/images/lugares/medellin/pueblito-paisa.jpg', 'public/images/lugares/medellin/jardin-botanico.jpg'],
    description: 'Habitación de prueba económica en El Poblado, a 5 minutos del metro. Perfecta para viajeros solos o en pareja que prefieren ahorrar.',
  },
  {
    id: 'guatape-finca', status: 'pending', title: 'Finca con piscina frente al embalse', type: 'finca', municipality: 'Guatapé', department: 'Antioquia',
    lat: 6.2333, lon: -75.1586, capacity: 10, bedrooms: 4, beds: 6, bathrooms: 3, price: 650000, cleaning: 80000, extra: 45000, mode: 'instant', policy: 'moderada',
    amenities: ['piscina', 'cocina', 'wifi', 'mascotas', 'estacionamiento', 'vistas'], cover: 'public/images/destinos/guatape.jpg',
    photos: ['public/images/lugares/guatape/piedra-del-penol.jpg', 'public/images/lugares/guatape/malecon-de-guatape.jpg', 'public/images/lugares/guatape/zocalos-de-colores.jpg'],
    description: 'Finca de prueba pendiente de revisión, con piscina y vista al embalse de Guatapé, para grupos grandes y familias.',
  },
]

const experiences = [
  {
    id: 'cocora-caminata', status: 'published', title: 'Caminata guiada por el Valle de Cocora', category: 'caminata', municipality: 'Salento', department: 'Quindío', lat: 4.6372, lon: -75.5703,
    duration: 300, price: 85000, capacity: 6, minAge: 8, times: ['08:00', '13:00'], weekdays: [0, 1, 2, 3, 4, 5, 6], cover: 'public/images/lugares/salento/valle-de-cocora.jpg',
    photos: ['public/images/lugares/salento/valle-de-cocora.jpg', 'public/images/lugares/salento/rio-quindio.jpg'], provider: 'Guías de Salento (prueba)',
    description: 'Recorrido de prueba de 5 horas entre palmas de cera con un guía local. Incluye explicación de la flora y paradas para fotos.',
  },
  {
    id: 'cartagena-gastro', status: 'published', title: 'Tour gastronómico por Getsemaní', category: 'gastronomia', municipality: 'Cartagena de Indias', department: 'Bolívar', lat: 10.4204, lon: -75.5469,
    duration: 180, price: 120000, capacity: 8, minAge: 0, times: ['17:00'], weekdays: [2, 3, 4, 5, 6], cover: 'public/images/lugares/cartagena/barrio-getsemani.jpg',
    photos: ['public/images/lugares/cartagena/barrio-getsemani.jpg', 'public/images/actividades/gastronomia.jpg'], provider: 'Sabores del Caribe (prueba)',
    description: 'Tour de prueba de tres horas probando platos típicos en el barrio Getsemaní, con historias del barrio contadas por un chef local.',
  },
]

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'admins', adminId), { createdAt: now })
  await setDoc(doc(db, 'users', hostId), { displayName: 'Ana Anfitriona', phone: '', onboardingCompleted: true, onboardingSkipped: false, aiPersonalization: false, isHost: true, createdAt: now, updatedAt: now })
  await setDoc(doc(db, 'users', guestId), { displayName: 'Gabi Huésped', phone: '', onboardingCompleted: false, onboardingSkipped: false, aiPersonalization: false, isHost: false, createdAt: now, updatedAt: now })
  await setDoc(doc(db, 'users', adminId), { displayName: 'Admin LOCUS', phone: '', onboardingCompleted: true, onboardingSkipped: false, aiPersonalization: false, isHost: false, createdAt: now, updatedAt: now })
  await setDoc(doc(db, 'hosts', hostId), { displayName: 'Ana Anfitriona (prueba)', bio: 'Anfitriona de prueba creada por el script de desarrollo.', municipality: 'Salento', languages: ['Español', 'Inglés'], rnt: '', verified: true, createdAt: now, updatedAt: now })

  // Viajes y favoritos de ejemplo para la huésped (para probar "Mis viajes" sin armar uno a mano).
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  const spot = (id: string, name: string, kind: string, category: string, lat: number, lon: number) => ({ id, name, kind, category, lat, lon, score: 50 })
  const trips = [
    { id: 'seed-salento', title: 'Escapada al Eje Cafetero', place: 'Salento', display: 'Salento, Quindío, Colombia', lat: 4.6375, lon: -75.5703, from: 21, to: 23, people: 2, budget: 1800000,
      stops: [spot('node/1', 'Mirador de Salento', 'Mirador', 'aventura', 4.6379, -75.5698), spot('node/2', 'Café de la plaza', 'Café', 'gastronomia', 4.6368, -75.5711)] },
    { id: 'seed-cartagena', title: 'Viaje a Cartagena', place: 'Cartagena de Indias', display: 'Cartagena de Indias, Bolívar, Colombia', lat: 10.4236, lon: -75.5253, from: -40, to: -37, people: 3, budget: 3200000,
      stops: [spot('node/3', 'Castillo San Felipe', 'Fuerte', 'cultura', 10.4226, -75.5392), spot('node/4', 'Playa Bocagrande', 'Playa', 'playa', 10.3997, -75.5565)] },
  ]
  for (const t of trips) {
    const start = day(t.from)
    const end = day(t.to)
    await setDoc(doc(db, 'users', guestId, 'itineraries', t.id), {
      title: t.title,
      destination: { query: t.place, displayName: t.display, lat: t.lat, lon: t.lon, radiusMeters: 8000 },
      startDate: start, endDate: end, budgetCOP: t.budget, travelers: t.people,
      days: [{ day: 1, date: start, places: t.stops, distanceKm: 1.2 }, { day: 2, date: day(t.from + 1), places: [], distanceKm: 0 }],
      notes: '', source: 'planner', createdAt: now, updatedAt: now,
    })
  }
  await setDoc(doc(db, 'users', guestId, 'favorites', 'destination_medellin'), { kind: 'destination', refId: 'medellin', title: 'Medellín', subtitle: 'Ciudad de la eterna primavera', addedAt: now })

  for (const l of listings) {
    const photos = await Promise.all(l.photos.map((p) => photo(p, 1280, 72)))
    await setDoc(doc(db, 'listings', l.id), {
      hostId, status: l.status, title: l.title, description: l.description, type: l.type, capacity: l.capacity, bedrooms: l.bedrooms, beds: l.beds, bathrooms: l.bathrooms,
      department: l.department, municipality: l.municipality, addressReference: `Referencia de prueba en ${l.municipality}`, lat: l.lat, lon: l.lon, amenities: l.amenities,
      pricePerNight: l.price, cleaningFee: l.cleaning, includedGuests: Math.min(2, l.capacity), extraGuestFee: l.extra, minNights: 1, maxNights: 14, bookingMode: l.mode,
      cancellationPolicy: l.policy, checkInTime: '15:00', checkOutTime: '11:00', rules: 'No fiestas. Respetar el silencio después de las 10 p. m.',
      cover: await photo(l.cover, 480, 70), photoCount: photos.length, isTestData: true, createdAt: now, updatedAt: now,
    })
    await setDoc(doc(db, 'listings', l.id, 'calendar', 'main'), { booked: {}, hostBlocked: {}, lastBookingId: '' })
    await Promise.all(photos.map((dataUrl, i) => setDoc(doc(db, 'listings', l.id, 'photos', `p${i}`), { order: i, dataUrl, alt: `Foto ${i + 1} de ${l.title}` })))
  }

  for (const e of experiences) {
    const photos = await Promise.all(e.photos.map((p) => photo(p, 1280, 72)))
    await setDoc(doc(db, 'experiences', e.id), {
      hostId, status: e.status, title: e.title, description: e.description, category: e.category, department: e.department, municipality: e.municipality,
      addressReference: `Punto de encuentro de prueba en ${e.municipality}`, lat: e.lat, lon: e.lon, durationMinutes: e.duration, pricePerPerson: e.price, capacity: e.capacity,
      minAge: e.minAge, languages: ['es', 'en'], weekdays: e.weekdays, startTimes: e.times, requirements: 'Calzado cómodo y agua.', cancellationPolicy: 'flexible',
      providerName: e.provider, cover: await photo(e.photos[0], 480, 70), photoCount: photos.length, isTestData: true, createdAt: now, updatedAt: now,
    })
    await Promise.all(photos.map((dataUrl, i) => setDoc(doc(db, 'experiences', e.id, 'photos', `p${i}`), { order: i, dataUrl, alt: `Foto ${i + 1}` })))
  }
})
await env.cleanup()

console.log('✔ Datos de prueba creados en el emulador.')
console.log('  Cuentas (clave: locus-prueba-123): anfitrion@locus.test · huesped@locus.test · admin@locus.test')
console.log('  Alojamientos: 3 publicados + 1 pendiente de revisión · Experiencias: 2 publicadas')
