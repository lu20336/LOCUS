/**
 * Herramientas del agente. El modelo NO inventa datos: cuando necesita
 * hospedajes, experiencias, clima, lugares o rutas, llama a estas funciones,
 * que consultan fuentes reales (Firestore de LOCUS, OpenStreetMap, Open-Meteo)
 * y devuelven tanto el resultado para el modelo como TARJETAS para el usuario
 * construidas con esos mismos datos.
 *
 * Todas son de SOLO LECTURA salvo `save_inference` (que escribe en la parte
 * "inferida" del perfil, a la vista del usuario). El agente NO tiene ninguna
 * herramienta para reservar, pagar ni cambiar respuestas declaradas: esas
 * acciones solo las hace el usuario con su propia confirmación.
 */
import { Schema, type FunctionDeclaration } from 'firebase/ai'
import { db } from '../firebase/client'
import { fetchCalendar, fetchItem, fetchPublished } from '../catalog/repo'
import { averageRating, fetchReviews } from '../catalog/reviews'
import { availableListings, filterExperiences, filterListings } from '../catalog/search'
import { EXPERIENCE_CATEGORIES, LISTING_TYPES, CANCELLATION_POLICIES, type Experience, type ExperienceCategory, type Listing, type ListingType } from '../domain/types'
import { FEATURED_DESTINATIONS, climateOf } from '../featuredDestinations'
import { resolveDestination, findFeaturedDestination } from '../flow/resolveDestination'
import { AIRLINE_SITES, findAirport, flightLinks, nearestAirports } from '../flights/airports'
import { formatCOP } from '../format'
import { osmClient, suggestionDeps } from '../itinerary/browserClient'
import { placesClient } from '../itinerary/fallbackClient'
import { CATEGORIES, isCategoryId } from '../itinerary/categories'
import { buildItinerary, tripDates } from '../itinerary/generateItinerary'
import { geocodeDestination } from '../itinerary/generateItinerary'
import { haversineKm } from '../itinerary/geo'
import { CLIMATES } from '../itinerary/suggestDestination'
import { loadProfile, saveInference } from '../profile/profileService'
import { DESTINATION_META, recommendDestinations } from '../profile/recommend'
import { summarize, type Answers } from '../profile/survey'
import { fetchForecast, rainRisk } from '../weather/openMeteo'
import type { CategoryId, Destination } from '../../types/itinerary'
import type { AgentCard, ToolContext, ToolOutcome } from './types'

// --- Utilidades de validación (los argumentos vienen del modelo: no son de fiar) ---
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '')
const strList = (v: unknown, max = 8) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [])

async function resolvePlace(name: string): Promise<Destination | null> {
  if (!name) return null
  try {
    return await resolveDestination(name, { geocode: (q) => geocodeDestination(q, osmClient), loadTowns: suggestionDeps.loadTowns })
  } catch {
    return null
  }
}

const NEAR_KM = 40
const MAX_RESULTS = 6

// --- Declaraciones para Gemini ------------------------------------------------
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_listings',
    description:
      'Busca alojamientos reservables publicados por anfitriones de LOCUS en Colombia. Úsala SIEMPRE antes de recomendar hospedajes. Devuelve solo alojamientos reales; si no hay, devuelve count 0.',
    parameters: Schema.object({
      properties: {
        destination: Schema.string({ description: 'Ciudad, municipio o departamento de Colombia, ej. "Salento".' }),
        check_in: Schema.string({ description: 'Llegada AAAA-MM-DD (opcional).' }),
        check_out: Schema.string({ description: 'Salida AAAA-MM-DD (opcional).' }),
        guests: Schema.integer({ description: 'Número de huéspedes (opcional).' }),
        max_price_per_night: Schema.integer({ description: 'Precio máximo por noche en COP (opcional).' }),
        types: Schema.array({ items: Schema.string(), description: 'Tipos: casa, apartamento, habitacion, hotel, hostal, cabana, finca, glamping.' }),
      },
      optionalProperties: ['destination', 'check_in', 'check_out', 'guests', 'max_price_per_night', 'types'],
    }),
  },
  {
    name: 'get_listing_details',
    description: 'Detalles de un alojamiento de LOCUS por su ID (obtenido de search_listings), incluida su disponibilidad en unas fechas.',
    parameters: Schema.object({
      properties: {
        listing_id: Schema.string({ description: 'ID del alojamiento.' }),
        check_in: Schema.string({ description: 'AAAA-MM-DD (opcional).' }),
        check_out: Schema.string({ description: 'AAAA-MM-DD (opcional).' }),
      },
      optionalProperties: ['check_in', 'check_out'],
    }),
  },
  {
    name: 'search_experiences',
    description: 'Busca experiencias, tours y actividades reservables publicadas por anfitriones de LOCUS. Úsala antes de recomendar experiencias.',
    parameters: Schema.object({
      properties: {
        destination: Schema.string({ description: 'Ciudad o municipio (opcional).' }),
        category: Schema.string({ description: 'caminata, tour, gastronomia, acuatica, cultural, aves, aventura, rural, bienestar (opcional).' }),
        max_price_per_person: Schema.integer({ description: 'Precio máximo por persona en COP (opcional).' }),
      },
      optionalProperties: ['destination', 'category', 'max_price_per_person'],
    }),
  },
  {
    name: 'get_destination_info',
    description: 'Información de un destino de Colombia: ubicación, clima típico por altitud, lugares conocidos y aeropuerto más cercano.',
    parameters: Schema.object({ properties: { destination: Schema.string({ description: 'Nombre del destino.' }) } }),
  },
  {
    name: 'get_weather',
    description: 'Pronóstico del clima (hasta 7 días) y condiciones actuales de un destino. El pronóstico es una estimación, no una certeza.',
    parameters: Schema.object({
      properties: {
        destination: Schema.string({ description: 'Nombre del destino.' }),
        days: Schema.integer({ description: 'Días de pronóstico, 1 a 7.' }),
      },
      optionalProperties: ['days'],
    }),
  },
  {
    name: 'find_places',
    description:
      'Lugares reales de interés cerca de un destino (datos de OpenStreetMap) por categoría. No incluye horarios ni precios.',
    parameters: Schema.object({
      properties: {
        destination: Schema.string({ description: 'Nombre del destino.' }),
        categories: Schema.array({ items: Schema.string(), description: 'playa, cultura, gastronomia, aventura, vidaNocturna, compras.' }),
      },
    }),
  },
  {
    name: 'plan_itinerary',
    description:
      'Arma un itinerario día a día con lugares reales y la ruta más corta (máx. 14 días). Úsala cuando el usuario pida organizar un viaje con destino, fechas e intereses.',
    parameters: Schema.object({
      properties: {
        destination: Schema.string({ description: 'Destino en Colombia.' }),
        start_date: Schema.string({ description: 'AAAA-MM-DD.' }),
        end_date: Schema.string({ description: 'AAAA-MM-DD.' }),
        categories: Schema.array({ items: Schema.string(), description: 'playa, cultura, gastronomia, aventura, vidaNocturna, compras.' }),
        budget_cop: Schema.integer({ description: 'Presupuesto total en COP (opcional).' }),
      },
      optionalProperties: ['budget_cop'],
    }),
  },
  {
    name: 'recommend_destinations',
    description: 'Recomienda destinos destacados de Colombia según el perfil del usuario (si autorizó su uso) o según los criterios indicados.',
    parameters: Schema.object({
      properties: {
        climate: Schema.string({ description: 'calido, templado, frio o indiferente (opcional).' }),
        interests: Schema.array({ items: Schema.string(), description: 'Ej. playa, montana, cultura, gastronomia, aventura, naturaleza (opcional).' }),
      },
      optionalProperties: ['climate', 'interests'],
    }),
  },
  {
    name: 'flight_search_links',
    description:
      'Enlaces para BUSCAR vuelos en proveedores externos (LOCUS no vende tiquetes ni conoce precios). Úsala cuando pregunten por vuelos.',
    parameters: Schema.object({
      properties: {
        origin: Schema.string({ description: 'Ciudad o código IATA de origen.' }),
        destination: Schema.string({ description: 'Ciudad o código IATA de destino.' }),
        date: Schema.string({ description: 'Fecha de ida AAAA-MM-DD.' }),
        return_date: Schema.string({ description: 'Fecha de regreso AAAA-MM-DD (opcional).' }),
        passengers: Schema.integer({ description: 'Pasajeros (opcional).' }),
      },
      optionalProperties: ['return_date', 'passengers'],
    }),
  },
  {
    name: 'get_traveler_profile',
    description: 'Preferencias de viaje declaradas por el usuario (solo si inició sesión y autorizó su uso).',
    parameters: Schema.object({ properties: {} }),
  },
  {
    name: 'save_inference',
    description:
      'Anota una preferencia que el USUARIO expresó claramente en la conversación (ej. "prefiere playas tranquilas"). Se guarda aparte de sus respuestas declaradas y él puede verla y borrarla. Úsala con moderación y solo si autorizó su perfil.',
    parameters: Schema.object({
      properties: {
        key: Schema.string({ description: 'Etiqueta corta en minúsculas, ej. "playas_tranquilas".' }),
        text: Schema.string({ description: 'La preferencia en una frase.' }),
      },
    }),
  },
]

// --- Ejecución -----------------------------------------------------------------

async function searchListings(a: Record<string, unknown>): Promise<ToolOutcome> {
  const destination = str(a.destination)
  const guests = Math.min(Math.max(num(a.guests) ?? 1, 1), 50)
  const maxPrice = num(a.max_price_per_night)
  const checkIn = isoDate(a.check_in)
  const checkOut = isoDate(a.check_out)
  const types = strList(a.types).filter((t): t is ListingType => t in LISTING_TYPES)

  const all = await fetchPublished<Listing>(db, 'listings')
  const base = { text: destination, guests, minPrice: null, maxPrice, types, amenities: [], checkIn, checkOut }
  let list = filterListings(all, base)
  let usedNearby = false
  if (list.length === 0 && destination) {
    // Sin coincidencia de texto: se buscan alojamientos cerca del punto.
    const place = await resolvePlace(destination)
    if (place) {
      list = filterListings(all, { ...base, text: '' }).filter((l) => haversineKm(place, l) <= NEAR_KM)
      usedNearby = list.length > 0
    }
  }
  if (checkIn && checkOut && checkOut > checkIn && list.length > 0) {
    const entries = await Promise.all(list.slice(0, 30).map(async (l) => [l.id, await fetchCalendar(db, l.id)] as const))
    list = availableListings(list, Object.fromEntries(entries), checkIn, checkOut)
  }
  const top = list.slice(0, MAX_RESULTS)
  const cards: AgentCard[] = top.map((l) => ({
    kind: 'listing', id: l.id, title: l.title, subtitle: `${LISTING_TYPES[l.type]} · ${l.municipality}`, price: `${formatCOP(l.pricePerNight)} / noche`,
    cover: l.photoCount > 0 ? l.cover : undefined, href: `/hospedajes/${l.id}${checkIn && checkOut ? `?llegada=${checkIn}&salida=${checkOut}&huespedes=${guests}` : ''}`,
  }))
  return {
    result: {
      source: 'LOCUS: alojamientos publicados por anfitriones (reservables en la plataforma)',
      count: list.length,
      nearbyMatch: usedNearby,
      listings: top.map((l) => ({
        id: l.id, title: l.title, type: LISTING_TYPES[l.type], municipality: l.municipality, department: l.department, pricePerNightCOP: l.pricePerNight,
        capacity: l.capacity, bookingMode: l.bookingMode === 'instant' ? 'reserva inmediata' : 'por solicitud', cancellationPolicy: l.cancellationPolicy,
      })),
      note: list.length === 0 ? 'No hay alojamientos publicados en LOCUS para esos criterios. No inventes ninguno; puedes sugerir ver alojamientos de referencia de OpenStreetMap desde la ficha del destino.' : undefined,
    },
    cards,
  }
}

async function getListingDetails(a: Record<string, unknown>): Promise<ToolOutcome> {
  const id = str(a.listing_id, 60)
  const l = id ? await fetchItem<Listing>(db, 'listings', id) : null
  if (!l || l.status !== 'published') return { result: { found: false, note: 'No existe un alojamiento publicado con ese ID.' } }
  const checkIn = isoDate(a.check_in)
  const checkOut = isoDate(a.check_out)
  let availability: string | undefined
  if (checkIn && checkOut && checkOut > checkIn) {
    const cal = await fetchCalendar(db, id)
    const free = availableListings([l], { [id]: cal }, checkIn, checkOut).length > 0
    availability = free ? 'disponible en esas fechas (confirmado con el calendario del anfitrión)' : 'NO disponible en esas fechas'
  }
  const reviews = await fetchReviews(db, id)
  return {
    result: {
      id, title: l.title, type: LISTING_TYPES[l.type], municipality: l.municipality, department: l.department, description: l.description.slice(0, 600),
      capacity: l.capacity, bedrooms: l.bedrooms, beds: l.beds, bathrooms: l.bathrooms, amenities: l.amenities, pricePerNightCOP: l.pricePerNight, cleaningFeeCOP: l.cleaningFee,
      includedGuests: l.includedGuests, extraGuestFeeCOP: l.extraGuestFee, minNights: l.minNights, maxNights: l.maxNights,
      bookingMode: l.bookingMode, cancellationPolicy: CANCELLATION_POLICIES[l.cancellationPolicy].description, rating: averageRating(reviews), reviews: reviews.length, availability,
    },
    cards: [{ kind: 'listing', id, title: l.title, subtitle: `${LISTING_TYPES[l.type]} · ${l.municipality}`, price: `${formatCOP(l.pricePerNight)} / noche`, cover: l.photoCount > 0 ? l.cover : undefined, href: `/hospedajes/${id}` }],
  }
}

async function searchExperiences(a: Record<string, unknown>): Promise<ToolOutcome> {
  const category = str(a.category)
  const categories = category in EXPERIENCE_CATEGORIES ? [category as ExperienceCategory] : []
  const all = await fetchPublished<Experience>(db, 'experiences')
  const list = filterExperiences(all, { text: str(a.destination), categories, maxPrice: num(a.max_price_per_person) })
  const top = list.slice(0, MAX_RESULTS)
  return {
    result: {
      source: 'LOCUS: experiencias publicadas por anfitriones (reservables en la plataforma)',
      count: list.length,
      experiences: top.map((e) => ({ id: e.id, title: e.title, category: EXPERIENCE_CATEGORIES[e.category], municipality: e.municipality, pricePerPersonCOP: e.pricePerPerson, durationMinutes: e.durationMinutes, capacity: e.capacity })),
      note: list.length === 0 ? 'No hay experiencias publicadas en LOCUS para esos criterios. No inventes ninguna.' : undefined,
    },
    cards: top.map((e) => ({ kind: 'experience', id: e.id, title: e.title, subtitle: `${EXPERIENCE_CATEGORIES[e.category]} · ${e.municipality}`, price: `${formatCOP(e.pricePerPerson)} / persona`, cover: e.photoCount > 0 ? e.cover : undefined, href: `/experiencias/${e.id}` })),
  }
}

async function destinationInfo(a: Record<string, unknown>): Promise<ToolOutcome> {
  const name = str(a.destination)
  const place = await resolvePlace(name)
  if (!place) return { result: { found: false, note: `No pudimos ubicar "${name}" en Colombia.` } }
  const featured = findFeaturedDestination(name) ? FEATURED_DESTINATIONS.find((d) => d.destination.displayName === place.displayName) : undefined
  const airports = nearestAirports(place, 2).map((x) => ({ iata: x.iata, name: `${x.name} (${x.city})`, distanceKm: Math.round(x.km) }))
  const meta = featured ? DESTINATION_META[featured.id] : undefined
  return {
    result: {
      found: true,
      name: place.displayName,
      lat: place.lat, lon: place.lon,
      climate: featured ? `${CLIMATES[climateOf(featured)].label} (${CLIMATES[climateOf(featured)].temperature}, ${featured.elevation} m de altitud)` : 'consulta get_weather para el clima actual',
      tagline: featured?.tagline,
      knownPlaces: featured?.places.map((p) => p.name),
      region: meta?.region,
      nearestAirports: airports,
      source: featured ? 'contenido editorial de LOCUS + coordenadas de OpenStreetMap' : 'OpenStreetMap / lista local de municipios',
    },
    cards: featured ? [{ kind: 'destination', id: featured.id, title: featured.name, subtitle: featured.tagline, image: featured.image, href: `/destinos/${featured.id}` }] : [],
  }
}

async function weather(a: Record<string, unknown>): Promise<ToolOutcome> {
  const name = str(a.destination)
  const place = await resolvePlace(name)
  if (!place) return { result: { found: false, note: `No pudimos ubicar "${name}" en Colombia.` } }
  const days = Math.min(Math.max(num(a.days) ?? 5, 1), 7)
  const f = await fetchForecast(place.lat, place.lon, 7)
  const daily = f.daily.slice(0, days)
  return {
    result: {
      found: true, place: place.displayName,
      currentModelEstimate: f.current ? `${Math.round(f.current.temperature)} °C, ${f.current.description}, humedad ${f.current.humidity}%` : undefined,
      forecast: daily.map((d) => ({ date: d.date, summary: d.description, minC: Math.round(d.tMin), maxC: Math.round(d.tMax), rainProbabilityPct: d.precipitationProbability, rainMm: d.precipitationMm, rainRisk: rainRisk(d) })),
      note: 'Es un PRONÓSTICO (estimación, puede cambiar), no una certeza. Fuente: Open-Meteo.',
    },
    cards: [{ kind: 'weather', title: `Clima en ${place.displayName.split(',')[0]} (pronóstico)`, lines: daily.map((d) => `${d.date}: ${d.description}, ${Math.round(d.tMin)}–${Math.round(d.tMax)} °C, lluvia ${d.precipitationProbability}%`) }],
  }
}

async function findPlaces(a: Record<string, unknown>): Promise<ToolOutcome> {
  const place = await resolvePlace(str(a.destination))
  if (!place) return { result: { found: false, note: 'No pudimos ubicar ese destino en Colombia.' } }
  const categories = strList(a.categories).filter(isCategoryId) as CategoryId[]
  if (categories.length === 0) return { result: { found: false, note: 'Indica al menos una categoría válida.' } }
  const places = await placesClient.findPlaces(place, place.radiusMeters, categories)
  const best: typeof places = []
  for (const c of categories) best.push(...places.filter((p) => p.category === c).sort((x, y) => y.score - x.score).slice(0, 5))
  return {
    result: {
      found: true, source: 'OpenStreetMap (sin horarios ni precios)',
      places: best.map((p) => ({ name: p.name, category: CATEGORIES[p.category].label, kind: p.kind })),
      note: best.length === 0 ? 'OpenStreetMap no devolvió lugares para esas categorías.' : 'No tienes horarios de apertura ni precios: no los inventes.',
    },
    cards: best.length > 0 ? [{ kind: 'places', title: `Lugares cerca de ${place.displayName.split(',')[0]}`, items: best.slice(0, 10).map((p) => ({ name: p.name, kind: p.kind, href: `https://www.openstreetmap.org/${p.id}` })) }] : [],
  }
}

async function planItinerary(a: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const place = await resolvePlace(str(a.destination))
  if (!place) return { result: { ok: false, note: 'No pudimos ubicar ese destino en Colombia.' } }
  const start = isoDate(a.start_date)
  const end = isoDate(a.end_date)
  const categories = strList(a.categories).filter(isCategoryId) as CategoryId[]
  if (!start || !end) return { result: { ok: false, note: 'Faltan las fechas (AAAA-MM-DD). Pídeselas al usuario.' } }
  if (start < ctx.today) return { result: { ok: false, note: `La fecha de inicio ya pasó (hoy es ${ctx.today}).` } }
  try {
    tripDates(start, end)
  } catch (e) {
    return { result: { ok: false, note: (e as Error).message } }
  }
  if (categories.length === 0) return { result: { ok: false, note: 'Pregunta qué actividades le interesan (playa, cultura, gastronomia, aventura, vidaNocturna, compras).' } }
  const budget = num(a.budget_cop) ?? 0
  const itinerary = await buildItinerary(place, { destination: place.displayName, startDate: start, endDate: end, budgetCOP: Math.max(0, budget), categories }, placesClient)
  const total = itinerary.days.reduce((s, d) => s + d.places.length, 0)
  return {
    result: {
      ok: true, source: 'OpenStreetMap; ruta ordenada por cercanía (distancias en línea recta)',
      destination: place.displayName,
      days: itinerary.days.map((d) => ({ day: d.day, date: d.date, kmApprox: d.distanceKm, places: d.places.map((p) => `${p.name} (${p.kind})`) })),
      missingCategories: itinerary.missingCategories,
      note: 'No tienes horarios ni precios de estos lugares: no inventes costos ni horarios. El usuario puede guardar el plan con la tarjeta.',
    },
    cards: [{ kind: 'itinerary', title: `Itinerario por ${place.displayName.split(',')[0]}`, days: itinerary.days.length, places: total, itinerary }],
  }
}

async function recommend(a: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  let answers: Answers = {}
  if (ctx.uid && ctx.aiConsent) answers = (await loadProfile(db, ctx.uid))?.declared ?? {}
  const climate = str(a.climate)
  const interests = strList(a.interests)
  if (climate) answers = { ...answers, climate }
  if (interests.length > 0) answers = { ...answers, environments: [...new Set([...(answers.environments ?? []), ...interests])], travelerTypes: [...new Set([...(answers.travelerTypes ?? []), ...interests])] }
  const list = recommendDestinations(answers, 3)
  return {
    result: {
      usedProfile: Boolean(ctx.uid && ctx.aiConsent),
      recommendations: list.map((r) => ({ destination: r.destination.name, tagline: r.destination.tagline, reasons: r.reasons })),
      note: list.length === 0 ? 'No hay suficientes datos para recomendar; pregunta al usuario por clima e intereses.' : 'Sugerencias basadas en reglas sobre destinos destacados de LOCUS.',
    },
    cards: list.map((r) => ({ kind: 'destination', id: r.destination.id, title: r.destination.name, subtitle: r.reasons.slice(0, 2).join(' · '), image: r.destination.image, href: `/destinos/${r.destination.id}` })),
  }
}

async function flights(a: Record<string, unknown>): Promise<ToolOutcome> {
  const originText = str(a.origin)
  const destText = str(a.destination)
  const date = isoDate(a.date)
  const returnDate = isoDate(a.return_date) || undefined
  const origin = findAirport(originText) ?? (await nearestFor(originText))
  const dest = findAirport(destText) ?? (await nearestFor(destText))
  if (!origin || !dest) return { result: { ok: false, note: 'No identificamos el aeropuerto de origen o destino. Pregunta la ciudad o el código IATA.' } }
  if (!date) return { result: { ok: false, note: 'Falta la fecha de ida (AAAA-MM-DD).' } }
  const links = flightLinks(origin.iata, dest.iata, date, returnDate, Math.min(Math.max(num(a.passengers) ?? 1, 1), 9))
  return {
    result: {
      ok: true, origin: `${origin.city} (${origin.iata})`, destination: `${dest.city} (${dest.iata})`,
      note: 'LOCUS NO vende tiquetes ni conoce precios, horarios o disponibilidad de vuelos: solo ofrece enlaces para buscarlos en el proveedor. No inventes tarifas.',
    },
    cards: [{ kind: 'flights', origin: `${origin.city} (${origin.iata})`, destination: `${dest.city} (${dest.iata})`, links: [...links, ...AIRLINE_SITES.slice(0, 2)] }],
  }
}

async function nearestFor(text: string) {
  const place = await resolvePlace(text)
  return place ? nearestAirports(place, 1)[0] ?? null : null
}

async function travelerProfile(_a: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  if (!ctx.uid) return { result: { available: false, reason: 'El usuario no ha iniciado sesión.' } }
  if (!ctx.aiConsent) return { result: { available: false, reason: 'El usuario no autorizó usar su perfil para personalizar. Puedes invitarlo a hacerlo desde Mi perfil.' } }
  const profile = await loadProfile(db, ctx.uid)
  if (!profile) return { result: { available: false, reason: 'Aún no completa la encuesta de preferencias.' } }
  return {
    result: {
      available: true,
      declared: summarize(profile.declared).map((s) => ({ topic: s.label, answer: s.answer })),
      inferred: Object.values(profile.inferred).map((i) => i.text),
    },
  }
}

async function inference(a: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  if (!ctx.uid || !ctx.aiConsent) return { result: { saved: false, reason: 'Sin sesión o sin autorización del usuario.' } }
  const text = str(a.text, 200)
  if (text.length < 3) return { result: { saved: false, reason: 'Texto vacío.' } }
  await saveInference(db, ctx.uid, str(a.key, 40), text)
  return { result: { saved: true }, cards: [{ kind: 'note', text: `Anoté en tu perfil: «${text}». Puedes quitarlo cuando quieras en Mi perfil.` }] }
}

const EXECUTORS: Record<string, (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>> = {
  search_listings: searchListings,
  get_listing_details: getListingDetails,
  search_experiences: searchExperiences,
  get_destination_info: destinationInfo,
  get_weather: weather,
  find_places: findPlaces,
  plan_itinerary: planItinerary,
  recommend_destinations: recommend,
  flight_search_links: flights,
  get_traveler_profile: travelerProfile,
  save_inference: inference,
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const executor = EXECUTORS[name]
  if (!executor) return { result: { error: `Herramienta desconocida: ${name}` } }
  try {
    return await executor(args ?? {}, ctx)
  } catch (error) {
    // El modelo recibe el error en texto para poder explicarlo sin inventar datos.
    return { result: { error: 'No se pudo consultar la fuente de datos en este momento.', detail: error instanceof Error ? error.message.slice(0, 120) : undefined } }
  }
}
