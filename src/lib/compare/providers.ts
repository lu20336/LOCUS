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
  booking: P('booking', 'Booking.com', 'stay', 'compare.pitch.booking', ['compare.tag.hoteles', 'compare.tag.hostales', 'compare.tag.apartamentos']),
  airbnb: P('airbnb', 'Airbnb', 'stay', 'compare.pitch.airbnb', ['compare.tag.casas-y-fincas', 'compare.tag.apartamentos']),
  google: P('google-hotels', 'Google Hoteles', 'stay', 'compare.pitch.google-hotels', ['compare.tag.metabuscador']),
  expedia: P('expedia', 'Expedia', 'stay', 'compare.pitch.expedia', ['compare.tag.hoteles', 'compare.tag.paquetes']),
  kayak: P('kayak', 'KAYAK', 'stay', 'compare.pitch.kayak', ['compare.tag.metabuscador']),
  vrbo: P('vrbo', 'Vrbo', 'stay', 'compare.pitch.vrbo', ['compare.tag.casas-y-fincas']),
  despegar: P('despegar', 'Despegar', 'stay', 'compare.pitch.despegar', ['compare.tag.hoteles', 'compare.tag.paquetes']),
  trivago: P('trivago', 'trivago', 'stay', 'compare.pitch.trivago', ['compare.tag.metabuscador']),
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
      provider: { ...STAY_PROVIDERS.airbnb, pitch: 'compare.pitch.airbnb-property' },
      url: `https://www.google.com/search?q=${enc(`"${name}" ${cleanPlace(placeName)} airbnb.com.co`)}`,
      prefill: 'place',
    },
    {
      provider: P('tripadvisor', 'Tripadvisor', 'stay', 'compare.pitch.tripadvisor', ['compare.tag.opiniones']),
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
      provider: P('google-flights', 'Google Vuelos', 'flight', 'compare.pitch.google-flights', ['compare.tag.metabuscador']),
      url: `https://www.google.com/travel/flights?q=${enc(google)}`,
      prefill: 'full',
    },
    {
      provider: P('skyscanner', 'Skyscanner', 'flight', 'compare.pitch.skyscanner', ['compare.tag.metabuscador']),
      url: `https://www.skyscanner.com.co/transporte/vuelos/${o.toLowerCase()}/${d.toLowerCase()}/${yymmdd(q.date)}/${back ? `${yymmdd(back)}/` : ''}?adultsv2=${people}`,
      prefill: 'full',
    },
    {
      provider: P('kayak-flights', 'KAYAK', 'flight', 'compare.pitch.kayak-flights', ['compare.tag.metabuscador']),
      url: `https://www.kayak.com.co/flights/${o}-${d}/${q.date}${back ? `/${back}` : ''}/${people}adults`,
      prefill: 'full',
    },
    {
      provider: P('aviasales', 'Aviasales', 'flight', 'compare.pitch.aviasales', ['compare.tag.metabuscador']),
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
      provider: P('getyourguide', 'GetYourGuide', 'experience', 'compare.pitch.getyourguide', ['compare.tag.tours', 'compare.tag.entradas']),
      url: `https://www.getyourguide.com/s/?q=${enc(`${place} Colombia`)}`,
      prefill: 'place',
    },
    {
      provider: P('viator', 'Viator', 'experience', 'compare.pitch.viator', ['compare.tag.tours']),
      url: `https://www.viator.com/searchResults/all?text=${enc(`${place} Colombia`)}`,
      prefill: 'place',
    },
    {
      provider: P('civitatis', 'Civitatis', 'experience', 'compare.pitch.civitatis', ['compare.tag.tours-en-espanol']),
      url: `https://www.civitatis.com/es/${CIVITATIS_CITIES[norm(place)] ?? 'colombia'}/`,
      prefill: CIVITATIS_CITIES[norm(place)] ? 'place' : 'none',
    },
    {
      provider: P('tripadvisor-things', 'Tripadvisor', 'experience', 'compare.pitch.tripadvisor-things', ['compare.tag.opiniones']),
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
      provider: P('busbud', 'Busbud', 'transport', 'compare.pitch.busbud', ['compare.tag.bus']),
      url: 'https://www.busbud.com/es',
      prefill: 'none',
    },
    {
      provider: P('kayak-cars', 'KAYAK Autos', 'transport', 'compare.pitch.kayak-cars', ['compare.tag.carro']),
      url: kayakCity(placeName)
        ? `https://www.kayak.com.co/cars/${enc(kayakCity(placeName) as string)}${full ? `/${q.checkIn}/${q.checkOut}` : ''}`
        : 'https://www.kayak.com.co/cars',
      prefill: kayakCity(placeName) ? (full ? 'full' : 'place') : 'none',
    },
    {
      provider: P('discovercars', 'Discover Cars', 'transport', 'compare.pitch.discovercars', ['compare.tag.carro']),
      url: 'https://www.discovercars.com/colombia',
      prefill: 'none',
    },
  ]
  return raw.map((l) => ({ ...l, ...sponsor(l.provider.id, l.url, env) }))
}

export function insuranceLinks(env?: AffiliateEnv): CompareLink[] {
  const raw: Omit<CompareLink, 'sponsored'>[] = [
    {
      provider: P('assistcard', 'Assist Card', 'insurance', 'compare.pitch.assistcard', ['compare.tag.seguro-de-viaje']),
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
  full: 'compare.prefill.full',
  place: 'compare.prefill.place',
  none: 'compare.prefill.none',
}
