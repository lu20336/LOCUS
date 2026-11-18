/**
 * Planes típicos de cada destino para "Sugerir planes con lo que me sobra":
 * lo que la gente hace allá (Islas del Rosario en Cartagena, Comuna 13 en
 * Medellín, termales en Manizales…), con un precio promedio por persona
 * (pesos de 2026, aproximado) y el lugar donde se hace o de donde sale.
 *
 * Para agregar un destino: una entrada con `places` (el nombre del destino en
 * minúsculas y sin tildes, como lo deja normalizePlaceName). Si el destino no
 * está aquí, se ofrecen los planes generales de tripBudget.ts (tour, cena…).
 */
import type { ExtraPart } from '../../types/itinerary'

export interface DestinationPlan {
  id: string
  /** Destinos donde aplica (nombre normalizado; basta con que empiece así). */
  places: string[]
  title: string
  detail: string
  /** Precio promedio por persona (COP). */
  perPerson: number
  part: ExtraPart
  /**
   * Dónde se hace. `match` busca el lugar en los datos del mapa para tener su
   * ubicación exacta; si no aparece, se muestra el nombre con un enlace de búsqueda.
   */
  venue?: { role: string; name: string; kind: string; match: RegExp }
}

const COFFEE_TOWNS = ['salento', 'filandia', 'armenia', 'pereira', 'montenegro', 'quimbaya', 'circasia']

export const DESTINATION_PLANS: DestinationPlan[] = [
  // --- Cartagena ------------------------------------------------------------
  {
    id: 'islas-rosario',
    places: ['cartagena'],
    title: 'Islas del Rosario en lancha',
    detail: 'Día completo con almuerzo y playa',
    perPerson: 250_000,
    part: 'todo el día',
    venue: { role: 'Sale de', name: 'Muelle de La Bodeguita', kind: 'Muelle', match: /bodeguita/i },
  },
  {
    id: 'chiva-rumbera',
    places: ['cartagena'],
    title: 'Chiva rumbera',
    detail: 'Recorrido nocturno con música y una parada para bailar',
    perPerson: 70_000,
    part: 'noche',
    venue: { role: 'Punto de encuentro', name: 'Torre del Reloj', kind: 'Monumento', match: /torre del reloj/i },
  },
  {
    id: 'getsemani-grafiti',
    places: ['cartagena'],
    title: 'Tour de grafitis y cultura por Getsemaní',
    detail: 'Unas 2 horas con guía local',
    perPerson: 60_000,
    part: 'tarde',
    venue: { role: 'Punto de encuentro', name: 'Plaza de la Trinidad', kind: 'Plaza', match: /plaza de la trinidad/i },
  },
  {
    id: 'volcan-totumo',
    places: ['cartagena'],
    title: 'Baño de lodo en el Volcán del Totumo',
    detail: 'Medio día con transporte desde la ciudad',
    perPerson: 130_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Volcán del Totumo', kind: 'Volcán de lodo', match: /totumo/i },
  },
  {
    id: 'atardecer-bahia',
    places: ['cartagena'],
    title: 'Atardecer en velero por la bahía',
    detail: 'Unas 2 horas con una bebida',
    perPerson: 160_000,
    part: 'tarde',
    venue: { role: 'Sale de', name: 'Muelle de La Bodeguita', kind: 'Muelle', match: /bodeguita/i },
  },

  // --- San Andrés -----------------------------------------------------------
  {
    id: 'johnny-cay',
    places: ['san andres'],
    title: 'Johnny Cay y El Acuario en lancha',
    detail: 'Día completo; la entrada a Johnny Cay se paga aparte',
    perPerson: 90_000,
    part: 'todo el día',
    venue: { role: 'Sale de', name: 'Playa Spratt Bight', kind: 'Playa', match: /spratt/i },
  },
  {
    id: 'buceo-san-andres',
    places: ['san andres', 'providencia'],
    title: 'Bautizo de buceo',
    detail: 'Una inmersión con instructor, sin experiencia previa',
    perPerson: 250_000,
    part: 'mañana',
  },
  {
    id: 'vuelta-isla',
    places: ['san andres'],
    title: 'Vuelta a la isla en carrito de golf',
    detail: 'Hoyo Soplador, West View y La Piscinita',
    perPerson: 80_000,
    part: 'tarde',
  },

  // --- Santa Marta ----------------------------------------------------------
  {
    id: 'tayrona',
    places: ['santa marta', 'taganga'],
    title: 'Día en el Parque Tayrona',
    detail: 'Transporte, entrada y caminata a las playas',
    perPerson: 180_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Parque Nacional Natural Tayrona', kind: 'Parque nacional', match: /tayrona|el zaino/i },
  },
  {
    id: 'minca',
    places: ['santa marta'],
    title: 'Minca: café, cascadas y aves',
    detail: 'Día completo con transporte',
    perPerson: 150_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Minca', kind: 'Pueblo', match: /^minca$/i },
  },
  {
    id: 'buceo-taganga',
    places: ['santa marta', 'taganga'],
    title: 'Bautizo de buceo en Taganga',
    detail: 'Una inmersión con instructor',
    perPerson: 250_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Taganga', kind: 'Bahía', match: /taganga/i },
  },

  // --- Medellín -------------------------------------------------------------
  {
    id: 'comuna-13',
    places: ['medellin'],
    title: 'Graffiti tour por la Comuna 13',
    detail: 'Escaleras eléctricas, murales e historia con guía local',
    perPerson: 60_000,
    part: 'mañana',
    venue: { role: 'Punto de encuentro', name: 'Estación San Javier del Metro', kind: 'Metro', match: /san javier/i },
  },
  {
    id: 'guatape-desde-medellin',
    places: ['medellin'],
    title: 'Día en Guatapé y la Piedra del Peñol',
    detail: 'Transporte, subida a la piedra y paseo por el pueblo',
    perPerson: 180_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Piedra del Peñol', kind: 'Mirador', match: /piedra del pe[ñn]ol/i },
  },
  {
    id: 'metrocable-arvi',
    places: ['medellin'],
    title: 'Metrocable y Parque Arví',
    detail: 'Vistas de la ciudad desde el cable y caminata por el bosque',
    perPerson: 40_000,
    part: 'tarde',
    venue: { role: 'Sale de', name: 'Estación Acevedo del Metro', kind: 'Metro', match: /acevedo/i },
  },
  {
    id: 'parapente-medellin',
    places: ['medellin', 'bello'],
    title: 'Parapente en San Félix',
    detail: 'Vuelo de unos 20 minutos con piloto',
    perPerson: 250_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'San Félix (Bello)', kind: 'Zona de vuelo', match: /san f[eé]lix/i },
  },

  // --- Bogotá ---------------------------------------------------------------
  {
    id: 'monserrate',
    places: ['bogota'],
    title: 'Subida a Monserrate',
    detail: 'En teleférico o funicular, con vista de toda la ciudad',
    perPerson: 40_000,
    part: 'tarde',
    venue: { role: 'Sale de', name: 'Estación del teleférico de Monserrate', kind: 'Teleférico', match: /monserrate/i },
  },
  {
    id: 'catedral-sal',
    places: ['bogota', 'chia', 'cajica'],
    title: 'Catedral de Sal de Zipaquirá',
    detail: 'Medio día con transporte y entrada',
    perPerson: 150_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Catedral de Sal de Zipaquirá', kind: 'Catedral', match: /catedral de sal/i },
  },
  {
    id: 'bici-bogota',
    places: ['bogota'],
    title: 'Tour en bicicleta por Bogotá',
    detail: 'Unas 4 horas por La Candelaria, mercados y grafitis',
    perPerson: 90_000,
    part: 'mañana',
    venue: { role: 'Punto de encuentro', name: 'La Candelaria', kind: 'Barrio', match: /^la candelaria$/i },
  },
  {
    id: 'andres-carne-de-res',
    places: ['bogota', 'chia'],
    title: 'Noche en Andrés Carne de Res',
    detail: 'Cena y rumba en Chía',
    perPerson: 200_000,
    part: 'noche',
    venue: { role: 'Lugar', name: 'Andrés Carne de Res (Chía)', kind: 'Restaurante', match: /andr[eé]s carne de res/i },
  },

  // --- Cali -----------------------------------------------------------------
  {
    id: 'clase-salsa-cali',
    places: ['cali'],
    title: 'Clase de salsa caleña',
    detail: 'Una hora y media en una escuela de salsa',
    perPerson: 60_000,
    part: 'tarde',
  },
  {
    id: 'juanchito',
    places: ['cali'],
    title: 'Noche de salsa en Juanchito',
    detail: 'Salsotecas con orquesta en vivo',
    perPerson: 80_000,
    part: 'noche',
    venue: { role: 'Lugar', name: 'Juanchito', kind: 'Zona de salsotecas', match: /juanchito/i },
  },
  {
    id: 'cristo-rey',
    places: ['cali'],
    title: 'Atardecer en el Cristo Rey',
    detail: 'Mirador sobre toda la ciudad',
    perPerson: 40_000,
    part: 'tarde',
    venue: { role: 'Lugar', name: 'Cristo Rey', kind: 'Mirador', match: /cristo rey/i },
  },

  // --- Manizales ------------------------------------------------------------
  {
    id: 'termales-otono',
    places: ['manizales'],
    title: 'Tarde en los Termales del Otoño',
    detail: 'Piscinas de aguas termales',
    perPerson: 90_000,
    part: 'tarde',
    venue: { role: 'Lugar', name: 'Termales del Otoño', kind: 'Termales', match: /termales del oto/i },
  },
  {
    id: 'nevado-ruiz',
    places: ['manizales'],
    title: 'Tour al Nevado del Ruiz',
    detail: 'Día completo en el Parque Nacional Natural Los Nevados',
    perPerson: 250_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Parque Nacional Natural Los Nevados', kind: 'Parque nacional', match: /los nevados/i },
  },
  {
    id: 'recinto-pensamiento',
    places: ['manizales'],
    title: 'Recinto del Pensamiento',
    detail: 'Mariposario, telesilla y bosque de guaduas',
    perPerson: 40_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Recinto del Pensamiento', kind: 'Parque', match: /recinto del pensamiento/i },
  },
  {
    id: 'hacienda-venecia',
    places: ['manizales'],
    title: 'Tour de café en la Hacienda Venecia',
    detail: 'Recorrido por la finca, cata y almuerzo',
    perPerson: 120_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Hacienda Venecia', kind: 'Finca cafetera', match: /hacienda venecia/i },
  },

  // --- Eje Cafetero (Salento, Filandia, Armenia, Pereira) ---------------------
  {
    id: 'cocora-caballo',
    places: ['salento', 'filandia', 'armenia', 'pereira'],
    title: 'Cabalgata en el Valle de Cocora',
    detail: 'Unas 3 horas entre las palmas de cera',
    perPerson: 90_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Valle de Cocora', kind: 'Valle', match: /cocora/i },
  },
  {
    id: 'finca-eje',
    places: COFFEE_TOWNS,
    title: 'Tour en una finca cafetera',
    detail: 'Recorrido por el cafetal, cata y cómo se prepara',
    perPerson: 70_000,
    part: 'tarde',
  },
  {
    id: 'tejo',
    places: ['salento', 'filandia'],
    title: 'Jugar tejo',
    detail: 'El deporte nacional, con mecha y cerveza',
    perPerson: 30_000,
    part: 'noche',
  },
  {
    id: 'termales-santa-rosa',
    places: ['pereira', 'santa rosa de cabal'],
    title: 'Termales de Santa Rosa de Cabal',
    detail: 'Piscinas termales al pie de una cascada',
    perPerson: 110_000,
    part: 'tarde',
    venue: { role: 'Lugar', name: 'Termales de Santa Rosa de Cabal', kind: 'Termales', match: /termales/i },
  },
  {
    id: 'parque-del-cafe',
    places: ['armenia', 'montenegro', 'quimbaya', 'pereira'],
    title: 'Día en el Parque del Café',
    detail: 'Atracciones, show del café y teleférico',
    perPerson: 100_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Parque del Café', kind: 'Parque temático', match: /parque del caf/i },
  },
  {
    id: 'panaca',
    places: ['armenia', 'quimbaya', 'montenegro'],
    title: 'Día en Panaca',
    detail: 'Parque de la vida en el campo, con shows de animales',
    perPerson: 90_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Panaca', kind: 'Parque temático', match: /panaca/i },
  },

  // --- Guatapé --------------------------------------------------------------
  {
    id: 'piedra-penol',
    places: ['guatape'],
    title: 'Subir la Piedra del Peñol',
    detail: 'Unos 700 escalones y la mejor vista del embalse',
    perPerson: 25_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Piedra del Peñol', kind: 'Mirador', match: /piedra del pe[ñn]ol/i },
  },
  {
    id: 'lancha-embalse',
    places: ['guatape'],
    title: 'Paseo en lancha por el embalse',
    detail: 'Una hora entre islas y fincas',
    perPerson: 50_000,
    part: 'tarde',
    venue: { role: 'Sale de', name: 'Malecón de Guatapé', kind: 'Malecón', match: /malec[oó]n/i },
  },

  // --- Villa de Leyva -------------------------------------------------------
  {
    id: 'pozos-azules',
    places: ['villa de leyva'],
    title: 'Pozos Azules y el desierto',
    detail: 'Recorrido en bicicleta o cuatrimoto',
    perPerson: 80_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Pozos Azules', kind: 'Lagunas', match: /pozos azules/i },
  },
  {
    id: 'vinedo-leyva',
    places: ['villa de leyva'],
    title: 'Tarde de vinos en un viñedo',
    detail: 'Recorrido por el viñedo y cata',
    perPerson: 80_000,
    part: 'tarde',
  },

  // --- San Gil y Barichara --------------------------------------------------
  {
    id: 'rafting-fonce',
    places: ['san gil'],
    title: 'Rafting en el río Fonce',
    detail: 'Unas 2 horas, nivel principiante',
    perPerson: 70_000,
    part: 'mañana',
    venue: { role: 'Lugar', name: 'Río Fonce', kind: 'Río', match: /fonce/i },
  },
  {
    id: 'chicamocha',
    places: ['san gil', 'bucaramanga'],
    title: 'Parque Nacional del Chicamocha',
    detail: 'Teleférico sobre el cañón',
    perPerson: 100_000,
    part: 'todo el día',
    venue: { role: 'Lugar', name: 'Parque Nacional del Chicamocha', kind: 'Parque', match: /chicamocha/i },
  },
  {
    id: 'camino-guane',
    places: ['san gil', 'barichara'],
    title: 'Camino Real de Barichara a Guane',
    detail: 'Caminata de unas 2 horas por un camino de piedra',
    perPerson: 40_000,
    part: 'mañana',
  },

  // --- Leticia y Palomino ---------------------------------------------------
  {
    id: 'rio-amazonas',
    places: ['leticia'],
    title: 'Excursión por el río Amazonas',
    detail: 'Puerto Nariño, delfines rosados y comunidades',
    perPerson: 250_000,
    part: 'todo el día',
    venue: { role: 'Sale de', name: 'Muelle de Leticia', kind: 'Muelle', match: /muelle/i },
  },
  {
    id: 'tubing-palomino',
    places: ['palomino'],
    title: 'Bajar el río Palomino en neumático',
    detail: 'Unas 2 horas hasta el mar',
    perPerson: 50_000,
    part: 'tarde',
  },
]

/** Los planes propios del destino (nombre ya normalizado), o [] si no tiene. */
export function destinationPlans(name: string): DestinationPlan[] {
  return DESTINATION_PLANS.filter((plan) => plan.places.some((place) => name === place || name.startsWith(`${place} `)))
}
