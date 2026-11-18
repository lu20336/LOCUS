/**
 * Comparador de LOCUS: el "intermediario de los intermediarios".
 *
 * QUÉ HACE HOY (y qué NO):
 *  - Arma, para cada plataforma, el enlace de búsqueda con el destino, las fechas
 *    y los viajeros del usuario ya puestos, para que compare en una sola vista y
 *    termine la reserva en la plataforma que elija.
 *  - NO muestra precios de terceros: Booking, Airbnb y las aerolíneas no
 *    publican sus tarifas gratis, y extraerlas de sus páginas (scraping) viola
 *    sus términos y es frágil. Los precios en vivo entran por APIs de socios
 *    (ver docs/NEGOCIO.md → Fase 2); la interfaz ya está lista para recibirlos
 *    (`PriceQuote`).
 *  - Dice con honestidad cuánto de la búsqueda llega llena (`prefill`): si una
 *    plataforma no permite pre-llenar, se le avisa al usuario.
 *
 * Los formatos de URL son los públicos de cada buscador; si alguna plataforma
 * cambia el suyo, el peor caso es que abra su buscador sin los datos (no se
 * rompe nada). Revísalos de vez en cuando (docs/PROVEEDORES.md).
 */
import { withAffiliate, type AffiliateEnv } from './affiliates'

export type CompareKind = 'stay' | 'flight' | 'experience' | 'transport' | 'insurance'

/**
 * Cuánto de la búsqueda llega ya puesto en la plataforma:
 *  - 'full'  destino + fechas + viajeros
 *  - 'place' solo el destino (las fechas se eligen allá)
 *  - 'none'  abre su buscador (se repite la búsqueda)
 */
export type Prefill = 'full' | 'place' | 'none'

export interface CompareProvider {
  id: string
  name: string
  kind: CompareKind
  /** Para qué es bueno (una frase que ayuda a elegir). */
  pitch: string
  /** Etiquetas cortas (tipo de oferta). */
  tags: string[]
}

export interface CompareLink {
  provider: CompareProvider
  url: string
  prefill: Prefill
  /** Enlace con identificador de afiliado de LOCUS. */
  sponsored: boolean
}

/** Precio real de una fuente que SÍ lo publica (hoy: LOCUS; mañana: APIs de socios). */
export interface PriceQuote {
  providerId: string
  label: string
  totalCOP: number
  /** 'locus' = tarifa verificada de LOCUS; 'user' = la anotó el usuario; 'api' = API de un socio. */
  source: 'locus' | 'user' | 'api'
}

export interface StayQuery {
  /** Destino legible, ej. "Cartagena de Indias". */
  place: string
  checkIn?: string
  checkOut?: string
  adults: number
}

const enc = encodeURIComponent
const withDates = (q: StayQuery) => Boolean(q.checkIn && q.checkOut && q.checkIn < q.checkOut)
const cleanPlace = (place: string) => place.split(',')[0].trim()
const withCountry = (place: string) => `${cleanPlace(place)}, Colombia`
const norm = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * KAYAK solo entiende ciudades con la forma "Ciudad,Departamento,Colombia" y
 * ÚNICAMENTE las que conoce (las de abajo se comprobaron una por una; en pueblos
 * como Salento, Guatapé o Villa de Leyva redirige a su página de inicio y se
 * pierde la búsqueda). Para esas, el enlace abre su buscador sin datos.
 */
const KAYAK_CITIES: Record<string, string> = {
  'cartagena de indias': 'Cartagena de Indias,Bolivar,Colombia',
  cartagena: 'Cartagena de Indias,Bolivar,Colombia',
  medellin: 'Medellin,Antioquia,Colombia',
  bogota: 'Bogota,Cundinamarca,Colombia',
  'santa marta': 'Santa Marta,Magdalena,Colombia',
  'san andres': 'San Andres,San Andres y Providencia,Colombia',
  cali: 'Cali,Valle del Cauca,Colombia',
  barranquilla: 'Barranquilla,Atlantico,Colombia',
}
const kayakCity = (place: string) => KAYAK_CITIES[norm(cleanPlace(place))]

/**
 * Civitatis organiza sus páginas por ciudad (`/es/{ciudad}/`); un nombre que no
 * conoce lo manda a su portada. Se listan las ciudades colombianas comprobadas;
 * para el resto se abre la página de Colombia. (`/es/cartagena/` es la de España.)
 */
const CIVITATIS_CITIES: Record<string, string> = {
  'cartagena de indias': 'cartagena-de-indias',
  cartagena: 'cartagena-de-indias',
  medellin: 'medellin',
  bogota: 'bogota',
  'santa marta': 'santa-marta',
  'san andres': 'san-andres',
  guatape: 'guatape',
  cali: 'cali',
}

/* ───────────────────────────── Alojamiento ───────────────────────────── */

const P = (id: string, name: string, kind: CompareKind, pitch: string, tags: string[]): CompareProvider => ({ id, name, kind, pitch, tags })

export const STAY_PROVIDERS = {
  booking: P('booking', 'Booking.com', 'stay', 'La mayor oferta de hoteles; cancelación gratis en muchas tarifas.', ['Hoteles', 'Hostales', 'Apartamentos']),
  airbnb: P('airbnb', 'Airbnb', 'stay', 'Casas, fincas y apartamentos completos; bueno para grupos y estadías largas.', ['Casas y fincas', 'Apartamentos']),
  google: P('google-hotels', 'Google Hoteles', 'stay', 'Cruza los precios de muchas agencias en un solo lugar.', ['Metabuscador']),
  expedia: P('expedia', 'Expedia', 'stay', 'Paquetes y tarifas con programa de puntos (precios en dólares).', ['Hoteles', 'Paquetes']),
  kayak: P('kayak', 'KAYAK', 'stay', 'Compara precios de varias agencias, con filtros potentes.', ['Metabuscador']),
  vrbo: P('vrbo', 'Vrbo', 'stay', 'Casas y fincas completas para familias y grupos.', ['Casas y fincas']),
  despegar: P('despegar', 'Despegar', 'stay', 'Agencia latinoamericana con pago en pesos y cuotas.', ['Hoteles', 'Paquetes']),
  trivago: P('trivago', 'trivago', 'stay', 'Compara el precio del mismo hotel entre agencias.', ['Metabuscador']),
} as const

/** Búsqueda de alojamiento en cada plataforma, con lo que cada una permite pre-llenar. */
export function stayLinks(q: StayQuery, env?: AffiliateEnv): CompareLink[] {
  const place = withCountry(q.place)
  const full = withDates(q)
  const ci = q.checkIn ?? ''
  const co = q.checkOut ?? ''
  const adults = Math.max(1, Math.min(q.adults, 16))
  const dateParams = (inKey: string, outKey: string) => (full ? `&${inKey}=${ci}&${outKey}=${co}` : '')

  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: STAY_PROVIDERS.booking,
      url: `https://www.booking.com/searchresults.es.html?ss=${enc(place)}${dateParams('checkin', 'checkout')}&group_adults=${adults}&no_rooms=1&group_children=0`,
      prefill: full ? 'full' : 'place',
    },
    {
      provider: STAY_PROVIDERS.airbnb,
      url: `https://www.airbnb.com.co/s/${enc(`${cleanPlace(q.place)}--Colombia`.replace(/\s+/g, '-'))}/homes?adults=${adults}${dateParams('checkin', 'checkout')}`,
      prefill: full ? 'full' : 'place',
    },
    {
      provider: STAY_PROVIDERS.google,
      url: `https://www.google.com/travel/search?q=${enc(`hoteles en ${place}`)}`,
      prefill: 'place',
    },
    {
      provider: STAY_PROVIDERS.expedia,
      url: `https://www.expedia.com/Hotel-Search?destination=${enc(place)}&adults=${adults}${dateParams('startDate', 'endDate')}`,
      prefill: full ? 'full' : 'place',
    },
    {
      provider: STAY_PROVIDERS.kayak,
      url: kayakCity(q.place)
        ? `https://www.kayak.com.co/hotels/${enc(kayakCity(q.place) as string)}${full ? `/${ci}/${co}/${adults}adults` : ''}`
        : 'https://www.kayak.com.co/stays',
      prefill: kayakCity(q.place) ? (full ? 'full' : 'place') : 'none',
    },
    {
      provider: STAY_PROVIDERS.vrbo,
      url: `https://www.vrbo.com/search?destination=${enc(place)}&adults=${adults}${dateParams('startDate', 'endDate')}`,
      prefill: full ? 'full' : 'place',
    },
    { provider: STAY_PROVIDERS.despegar, url: 'https://www.despegar.com.co/hoteles/', prefill: 'none' },
    { provider: STAY_PROVIDERS.trivago, url: 'https://www.trivago.com.co/', prefill: 'none' },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

/**
 * "El mismo alojamiento en otras plataformas": busca ESE establecimiento por
 * nombre. Airbnb no permite buscar por nombre de un lugar, por eso se hace a
 * través de Google (que sí indexa sus fichas).
 */
export function propertyLinks(name: string, placeName: string, q: Pick<StayQuery, 'checkIn' | 'checkOut' | 'adults'> = { adults: 2 }, env?: AffiliateEnv): CompareLink[] {
  const place = withCountry(placeName)
  const full = withDates({ place, ...q })
  const adults = Math.max(1, Math.min(q.adults, 16))
  const query = `${name} ${cleanPlace(placeName)}`
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: STAY_PROVIDERS.booking,
      url: `https://www.booking.com/searchresults.es.html?ss=${enc(`${query}, Colombia`)}${full ? `&checkin=${q.checkIn}&checkout=${q.checkOut}` : ''}&group_adults=${adults}&no_rooms=1`,
      prefill: full ? 'full' : 'place',
    },
    { provider: STAY_PROVIDERS.google, url: `https://www.google.com/travel/search?q=${enc(query)}`, prefill: 'place' },
    {
      provider: { ...STAY_PROVIDERS.airbnb, pitch: 'Búsqueda del nombre en Airbnb (vía Google).' },
      url: `https://www.google.com/search?q=${enc(`"${name}" ${cleanPlace(placeName)} airbnb.com.co`)}`,
      prefill: 'place',
    },
    {
      provider: P('tripadvisor', 'Tripadvisor', 'stay', 'Opiniones y precios de varias agencias para ese lugar.', ['Opiniones']),
      url: `https://www.tripadvisor.co/Search?q=${enc(query)}`,
      prefill: 'place',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

/* ───────────────────────────── Vuelos ───────────────────────────── */

export interface FlightQuery {
  /** Códigos IATA (BOG, CTG…). */
  origin: string
  destination: string
  date: string
  returnDate?: string
  adults: number
}

const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)
const ddmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7)

/** Metabuscadores de vuelos con la ruta, las fechas y los pasajeros ya puestos. */
export function flightSearchLinks(q: FlightQuery, env?: AffiliateEnv): CompareLink[] {
  const o = q.origin.toUpperCase()
  const d = q.destination.toUpperCase()
  const people = Math.max(1, Math.min(q.adults, 9))
  const back = q.returnDate && q.returnDate > q.date ? q.returnDate : undefined
  const google = `Flights from ${o} to ${d} on ${q.date}${back ? ` returning ${back}` : ''}`
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: P('google-flights', 'Google Vuelos', 'flight', 'Compara aerolíneas y muestra el calendario de precios más baratos.', ['Metabuscador']),
      url: `https://www.google.com/travel/flights?q=${enc(google)}`,
      prefill: 'full',
    },
    {
      provider: P('skyscanner', 'Skyscanner', 'flight', 'Metabuscador con alertas de precio y "mes más barato".', ['Metabuscador']),
      url: `https://www.skyscanner.com.co/transporte/vuelos/${o.toLowerCase()}/${d.toLowerCase()}/${yymmdd(q.date)}/${back ? `${yymmdd(back)}/` : ''}?adultsv2=${people}`,
      prefill: 'full',
    },
    {
      provider: P('kayak-flights', 'KAYAK', 'flight', 'Compara agencias y aerolíneas; filtros de escalas y equipaje.', ['Metabuscador']),
      url: `https://www.kayak.com.co/flights/${o}-${d}/${q.date}${back ? `/${back}` : ''}/${people}adults`,
      prefill: 'full',
    },
    {
      provider: P('aviasales', 'Aviasales', 'flight', 'Suele mostrar tarifas de agencias pequeñas más baratas.', ['Metabuscador']),
      url: `https://www.aviasales.com/search/${o}${ddmm(q.date)}${d}${back ? ddmm(back) : ''}${people}`,
      prefill: 'full',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

/** Sitios oficiales: a veces la tarifa directa es la más barata (equipaje, cambios). Se abren sin pre-llenar. */
export function airlineLinks(env?: AffiliateEnv): CompareLink[] {
  const site = (id: string, name: string, url: string, pitch: string): Omit<CompareLink, 'sponsored'> => ({
    provider: P(id, name, 'flight', pitch, ['Aerolínea']),
    url,
    prefill: 'none',
  })
  const raw = [
    site('avianca', 'Avianca', 'https://www.avianca.com/co/es/', 'Mayor red nacional; programa LifeMiles.'),
    site('latam', 'LATAM', 'https://www.latamairlines.com/co/es', 'Rutas nacionales e internacionales; programa LATAM Pass.'),
    site('wingo', 'Wingo', 'https://www.wingo.com/es', 'Bajo costo; revisa el equipaje, se cobra aparte.'),
    site('jetsmart', 'JetSMART', 'https://jetsmart.com/co/es/', 'Bajo costo; revisa el equipaje, se cobra aparte.'),
    site('satena', 'SATENA', 'https://www.satena.com/', 'Rutas regionales a destinos apartados.'),
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

/* ───────────────────────────── Experiencias ───────────────────────────── */

export function experienceLinks(placeName: string, env?: AffiliateEnv): CompareLink[] {
  const place = cleanPlace(placeName)
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: P('getyourguide', 'GetYourGuide', 'experience', 'Tours y entradas con cancelación gratis en muchas actividades.', ['Tours', 'Entradas']),
      url: `https://www.getyourguide.com/s/?q=${enc(`${place} Colombia`)}`,
      prefill: 'place',
    },
    {
      provider: P('viator', 'Viator', 'experience', 'Gran catálogo de excursiones, de Tripadvisor.', ['Tours']),
      url: `https://www.viator.com/searchResults/all?text=${enc(`${place} Colombia`)}`,
      prefill: 'place',
    },
    {
      provider: P('civitatis', 'Civitatis', 'experience', 'Visitas guiadas en español, con precios claros.', ['Tours en español']),
      url: `https://www.civitatis.com/es/${CIVITATIS_CITIES[norm(place)] ?? 'colombia'}/`,
      prefill: CIVITATIS_CITIES[norm(place)] ? 'place' : 'none',
    },
    {
      provider: P('tripadvisor-things', 'Tripadvisor', 'experience', 'Qué hacer, con miles de opiniones de viajeros.', ['Opiniones']),
      url: `https://www.tripadvisor.co/Search?q=${enc(`que hacer en ${place}`)}`,
      prefill: 'place',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

/* ─────────────────────── Transporte terrestre y seguro ─────────────────────── */

export function transportLinks(placeName: string, q: Pick<StayQuery, 'checkIn' | 'checkOut'>, env?: AffiliateEnv): CompareLink[] {
  const full = Boolean(q.checkIn && q.checkOut && q.checkIn < q.checkOut)
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: P('busbud', 'Busbud', 'transport', 'Compara buses entre ciudades.', ['Bus']),
      url: 'https://www.busbud.com/es',
      prefill: 'none',
    },
    {
      provider: P('kayak-cars', 'KAYAK Autos', 'transport', 'Compara alquiler de carro entre varias empresas.', ['Carro']),
      url: kayakCity(placeName)
        ? `https://www.kayak.com.co/cars/${enc(kayakCity(placeName) as string)}${full ? `/${q.checkIn}/${q.checkOut}` : ''}`
        : 'https://www.kayak.com.co/cars',
      prefill: kayakCity(placeName) ? (full ? 'full' : 'place') : 'none',
    },
    {
      provider: P('discovercars', 'Discover Cars', 'transport', 'Alquiler de carro con seguro completo opcional.', ['Carro']),
      url: 'https://www.discovercars.com/colombia',
      prefill: 'none',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

export function insuranceLinks(env?: AffiliateEnv): CompareLink[] {
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: P('assistcard', 'Assist Card', 'insurance', 'Asistencia médica y de viaje para turismo nacional e internacional.', ['Seguro de viaje']),
      url: 'https://www.assistcard.com/co',
      prefill: 'none',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

function sponsor(providerId: string, url: string, env?: AffiliateEnv): Pick<CompareLink, 'url' | 'sponsored'> {
  return withAffiliate(providerId, url, env)
}

/** Texto corto para el usuario: cuánto llega pre-llenado. */
export const PREFILL_LABEL: Record<Prefill, string> = {
  full: 'Con tu búsqueda lista',
  place: 'Con tu destino listo',
  none: 'Repite tu búsqueda allí',
}
