/**
 * Vuelos: LOCUS NO vende tiquetes ni muestra precios o disponibilidad de
 * aerolíneas. No existe hoy una API gratuita de vuelos con cobertura nacional
 * en Colombia (Amadeus Self-Service cerró en julio de 2026; Duffel solo ofrece
 * pruebas gratuitas; Aviationstack da 100 llamadas/mes y es de datos, no de
 * reservas). Por eso esta sección es de DESCUBRIMIENTO: sugiere aeropuertos y
 * abre la búsqueda en el proveedor, donde el usuario ve precios reales y compra.
 * Ver docs/PROVEEDORES.md.
 *
 * Coordenadas aproximadas (suficientes para "aeropuerto más cercano").
 */
import { haversineKm } from '../itinerary/geo'
import { normalizePlaceName } from '../flow/resolveDestination'

export interface Airport {
  iata: string
  name: string
  city: string
  lat: number
  lon: number
}

export const AIRPORTS: Airport[] = [
  { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', lat: 4.7016, lon: -74.1469 },
  { iata: 'MDE', name: 'José María Córdova', city: 'Medellín (Rionegro)', lat: 6.1645, lon: -75.4231 },
  { iata: 'EOH', name: 'Olaya Herrera', city: 'Medellín', lat: 6.22, lon: -75.5906 },
  { iata: 'CLO', name: 'Alfonso Bonilla Aragón', city: 'Cali', lat: 3.5432, lon: -76.3816 },
  { iata: 'CTG', name: 'Rafael Núñez', city: 'Cartagena', lat: 10.4424, lon: -75.513 },
  { iata: 'BAQ', name: 'Ernesto Cortissoz', city: 'Barranquilla', lat: 10.8896, lon: -74.7808 },
  { iata: 'SMR', name: 'Simón Bolívar', city: 'Santa Marta', lat: 11.1196, lon: -74.2306 },
  { iata: 'ADZ', name: 'Gustavo Rojas Pinilla', city: 'San Andrés', lat: 12.5836, lon: -81.7112 },
  { iata: 'PVA', name: 'El Embrujo', city: 'Providencia', lat: 13.3569, lon: -81.3583 },
  { iata: 'PEI', name: 'Matecaña', city: 'Pereira', lat: 4.8127, lon: -75.7395 },
  { iata: 'AXM', name: 'El Edén', city: 'Armenia', lat: 4.4528, lon: -75.7664 },
  { iata: 'MZL', name: 'La Nubia', city: 'Manizales', lat: 5.0296, lon: -75.4647 },
  { iata: 'BGA', name: 'Palonegro', city: 'Bucaramanga', lat: 7.1265, lon: -73.1848 },
  { iata: 'CUC', name: 'Camilo Daza', city: 'Cúcuta', lat: 7.9276, lon: -72.5115 },
  { iata: 'LET', name: 'Alfredo Vásquez Cobo', city: 'Leticia', lat: -4.1936, lon: -69.9432 },
  { iata: 'PSO', name: 'Antonio Nariño', city: 'Pasto', lat: 1.3962, lon: -77.2915 },
  { iata: 'PPN', name: 'Guillermo León Valencia', city: 'Popayán', lat: 2.4544, lon: -76.6093 },
  { iata: 'UIB', name: 'El Caraño', city: 'Quibdó', lat: 5.6908, lon: -76.6412 },
  { iata: 'MTR', name: 'Los Garzones', city: 'Montería', lat: 8.8237, lon: -75.8258 },
  { iata: 'VUP', name: 'Alfonso López Pumarejo', city: 'Valledupar', lat: 10.435, lon: -73.2495 },
  { iata: 'RCH', name: 'Almirante Padilla', city: 'Riohacha', lat: 11.5262, lon: -72.926 },
  { iata: 'NVA', name: 'Benito Salas', city: 'Neiva', lat: 2.9501, lon: -75.294 },
  { iata: 'IBE', name: 'Perales', city: 'Ibagué', lat: 4.4216, lon: -75.133 },
  { iata: 'EYP', name: 'El Alcaraván', city: 'Yopal', lat: 5.3191, lon: -72.384 },
  { iata: 'VVC', name: 'La Vanguardia', city: 'Villavicencio', lat: 4.1679, lon: -73.6138 },
  { iata: 'FLA', name: 'Gustavo Artunduaga', city: 'Florencia', lat: 1.5892, lon: -75.5644 },
  { iata: 'CZU', name: 'Las Brujas', city: 'Corozal (Sincelejo)', lat: 9.3328, lon: -75.2856 },
  { iata: 'AUC', name: 'Santiago Pérez', city: 'Arauca', lat: 7.0689, lon: -70.7369 },
]

export function nearestAirports(point: { lat: number; lon: number }, count = 2): (Airport & { km: number })[] {
  return AIRPORTS.map((a) => ({ ...a, km: haversineKm(point, a) })).sort((a, b) => a.km - b.km).slice(0, count)
}

/** Busca un aeropuerto por código IATA o por nombre de ciudad/aeropuerto. */
export function findAirport(text: string): Airport | null {
  const q = normalizePlaceName(text)
  if (!q) return null
  const upper = text.trim().toUpperCase()
  const byCode = AIRPORTS.find((a) => a.iata === upper)
  if (byCode) return byCode
  return (
    AIRPORTS.find((a) => normalizePlaceName(a.city).split(' ')[0] === q.split(' ')[0] && q.length >= 3) ??
    AIRPORTS.find((a) => normalizePlaceName(`${a.city} ${a.name}`).includes(q)) ??
    null
  )
}

export interface FlightLink {
  provider: string
  url: string
  note: string
}

const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)

/**
 * Enlaces de búsqueda en proveedores externos. NO incluyen precios: LOCUS no
 * los conoce. Las fechas deben ser ISO (AAAA-MM-DD).
 */
export function flightLinks(origin: string, destination: string, date: string, returnDate?: string, adults = 1): FlightLink[] {
  const o = origin.toUpperCase()
  const d = destination.toUpperCase()
  const people = Math.min(Math.max(adults, 1), 9)
  const googleQuery = `Flights from ${o} to ${d} on ${date}${returnDate ? ` returning ${returnDate}` : ''}`
  const links: FlightLink[] = [
    { provider: 'Google Flights', url: `https://www.google.com/travel/flights?q=${encodeURIComponent(googleQuery)}`, note: 'Compara precios de varias aerolíneas.' },
    {
      provider: 'Skyscanner',
      url: `https://www.skyscanner.com.co/transporte/vuelos/${o.toLowerCase()}/${d.toLowerCase()}/${yymmdd(date)}/${returnDate ? `${yymmdd(returnDate)}/` : ''}?adultsv2=${people}`,
      note: 'Metabuscador de vuelos.',
    },
  ]
  return links
}

/** Sitios oficiales de aerolíneas que operan en Colombia (página de inicio; no verificamos tarifas). */
export const AIRLINE_SITES: FlightLink[] = [
  { provider: 'Avianca', url: 'https://www.avianca.com/co/es/', note: 'Sitio oficial.' },
  { provider: 'LATAM', url: 'https://www.latamairlines.com/co/es', note: 'Sitio oficial.' },
  { provider: 'Wingo', url: 'https://www.wingo.com/es-co', note: 'Sitio oficial.' },
  { provider: 'SATENA', url: 'https://www.satena.com/', note: 'Sitio oficial (rutas regionales).' },
]
