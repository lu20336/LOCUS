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
import { getT } from '../i18n/store'

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
    get title() {
      return getT()('dp.islas-rosario.t')
    },
    get detail() {
      return getT()('dp.islas-rosario.d')
    },
    perPerson: 250_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Muelle de La Bodeguita', get kind() { return getT()('dk.muelle') }, match: /bodeguita/i },
  },
  {
    id: 'chiva-rumbera',
    places: ['cartagena'],
    get title() {
      return getT()('dp.chiva-rumbera.t')
    },
    get detail() {
      return getT()('dp.chiva-rumbera.d')
    },
    perPerson: 70_000,
    part: 'noche',
    venue: { get role() { return getT()('dr.punto-de-encuentro') }, name: 'Torre del Reloj', get kind() { return getT()('dk.monumento') }, match: /torre del reloj/i },
  },
  {
    id: 'getsemani-grafiti',
    places: ['cartagena'],
    get title() {
      return getT()('dp.getsemani-grafiti.t')
    },
    get detail() {
      return getT()('dp.getsemani-grafiti.d')
    },
    perPerson: 60_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.punto-de-encuentro') }, name: 'Plaza de la Trinidad', get kind() { return getT()('dk.plaza') }, match: /plaza de la trinidad/i },
  },
  {
    id: 'volcan-totumo',
    places: ['cartagena'],
    get title() {
      return getT()('dp.volcan-totumo.t')
    },
    get detail() {
      return getT()('dp.volcan-totumo.d')
    },
    perPerson: 130_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Volcán del Totumo', get kind() { return getT()('dk.volcan-de-lodo') }, match: /totumo/i },
  },
  {
    id: 'atardecer-bahia',
    places: ['cartagena'],
    get title() {
      return getT()('dp.atardecer-bahia.t')
    },
    get detail() {
      return getT()('dp.atardecer-bahia.d')
    },
    perPerson: 160_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Muelle de La Bodeguita', get kind() { return getT()('dk.muelle') }, match: /bodeguita/i },
  },

  // --- San Andrés -----------------------------------------------------------
  {
    id: 'johnny-cay',
    places: ['san andres'],
    get title() {
      return getT()('dp.johnny-cay.t')
    },
    get detail() {
      return getT()('dp.johnny-cay.d')
    },
    perPerson: 90_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Playa Spratt Bight', get kind() { return getT()('dk.playa') }, match: /spratt/i },
  },
  {
    id: 'buceo-san-andres',
    places: ['san andres', 'providencia'],
    get title() {
      return getT()('dp.buceo-san-andres.t')
    },
    get detail() {
      return getT()('dp.buceo-san-andres.d')
    },
    perPerson: 250_000,
    part: 'mañana',
  },
  {
    id: 'vuelta-isla',
    places: ['san andres'],
    get title() {
      return getT()('dp.vuelta-isla.t')
    },
    get detail() {
      return getT()('dp.vuelta-isla.d')
    },
    perPerson: 80_000,
    part: 'tarde',
  },

  // --- Santa Marta ----------------------------------------------------------
  {
    id: 'tayrona',
    places: ['santa marta', 'taganga'],
    get title() {
      return getT()('dp.tayrona.t')
    },
    get detail() {
      return getT()('dp.tayrona.d')
    },
    perPerson: 180_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Parque Nacional Natural Tayrona', get kind() { return getT()('dk.parque-nacional') }, match: /tayrona|el zaino/i },
  },
  {
    id: 'minca',
    places: ['santa marta'],
    get title() {
      return getT()('dp.minca.t')
    },
    get detail() {
      return getT()('dp.minca.d')
    },
    perPerson: 150_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Minca', get kind() { return getT()('dk.pueblo') }, match: /^minca$/i },
  },
  {
    id: 'buceo-taganga',
    places: ['santa marta', 'taganga'],
    get title() {
      return getT()('dp.buceo-taganga.t')
    },
    get detail() {
      return getT()('dp.buceo-taganga.d')
    },
    perPerson: 250_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Taganga', get kind() { return getT()('dk.bahia') }, match: /taganga/i },
  },

  // --- Medellín -------------------------------------------------------------
  {
    id: 'comuna-13',
    places: ['medellin'],
    get title() {
      return getT()('dp.comuna-13.t')
    },
    get detail() {
      return getT()('dp.comuna-13.d')
    },
    perPerson: 60_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.punto-de-encuentro') }, name: 'Estación San Javier del Metro', get kind() { return getT()('dk.metro') }, match: /san javier/i },
  },
  {
    id: 'guatape-desde-medellin',
    places: ['medellin'],
    get title() {
      return getT()('dp.guatape-desde-medellin.t')
    },
    get detail() {
      return getT()('dp.guatape-desde-medellin.d')
    },
    perPerson: 180_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Piedra del Peñol', get kind() { return getT()('dk.mirador') }, match: /piedra del pe[ñn]ol/i },
  },
  {
    id: 'metrocable-arvi',
    places: ['medellin'],
    get title() {
      return getT()('dp.metrocable-arvi.t')
    },
    get detail() {
      return getT()('dp.metrocable-arvi.d')
    },
    perPerson: 40_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Estación Acevedo del Metro', get kind() { return getT()('dk.metro') }, match: /acevedo/i },
  },
  {
    id: 'parapente-medellin',
    places: ['medellin', 'bello'],
    get title() {
      return getT()('dp.parapente-medellin.t')
    },
    get detail() {
      return getT()('dp.parapente-medellin.d')
    },
    perPerson: 250_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'San Félix (Bello)', get kind() { return getT()('dk.zona-de-vuelo') }, match: /san f[eé]lix/i },
  },

  // --- Bogotá ---------------------------------------------------------------
  {
    id: 'monserrate',
    places: ['bogota'],
    get title() {
      return getT()('dp.monserrate.t')
    },
    get detail() {
      return getT()('dp.monserrate.d')
    },
    perPerson: 40_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Estación del teleférico de Monserrate', get kind() { return getT()('dk.teleferico') }, match: /monserrate/i },
  },
  {
    id: 'catedral-sal',
    places: ['bogota', 'chia', 'cajica'],
    get title() {
      return getT()('dp.catedral-sal.t')
    },
    get detail() {
      return getT()('dp.catedral-sal.d')
    },
    perPerson: 150_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Catedral de Sal de Zipaquirá', get kind() { return getT()('dk.catedral') }, match: /catedral de sal/i },
  },
  {
    id: 'bici-bogota',
    places: ['bogota'],
    get title() {
      return getT()('dp.bici-bogota.t')
    },
    get detail() {
      return getT()('dp.bici-bogota.d')
    },
    perPerson: 90_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.punto-de-encuentro') }, name: 'La Candelaria', get kind() { return getT()('dk.barrio') }, match: /^la candelaria$/i },
  },
  {
    id: 'andres-carne-de-res',
    places: ['bogota', 'chia'],
    get title() {
      return getT()('dp.andres-carne-de-res.t')
    },
    get detail() {
      return getT()('dp.andres-carne-de-res.d')
    },
    perPerson: 200_000,
    part: 'noche',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Andrés Carne de Res (Chía)', get kind() { return getT()('dk.restaurante') }, match: /andr[eé]s carne de res/i },
  },

  // --- Cali -----------------------------------------------------------------
  {
    id: 'clase-salsa-cali',
    places: ['cali'],
    get title() {
      return getT()('dp.clase-salsa-cali.t')
    },
    get detail() {
      return getT()('dp.clase-salsa-cali.d')
    },
    perPerson: 60_000,
    part: 'tarde',
  },
  {
    id: 'juanchito',
    places: ['cali'],
    get title() {
      return getT()('dp.juanchito.t')
    },
    get detail() {
      return getT()('dp.juanchito.d')
    },
    perPerson: 80_000,
    part: 'noche',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Juanchito', get kind() { return getT()('dk.zona-de-salsotecas') }, match: /juanchito/i },
  },
  {
    id: 'cristo-rey',
    places: ['cali'],
    get title() {
      return getT()('dp.cristo-rey.t')
    },
    get detail() {
      return getT()('dp.cristo-rey.d')
    },
    perPerson: 40_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Cristo Rey', get kind() { return getT()('dk.mirador') }, match: /cristo rey/i },
  },

  // --- Manizales ------------------------------------------------------------
  {
    id: 'termales-otono',
    places: ['manizales'],
    get title() {
      return getT()('dp.termales-otono.t')
    },
    get detail() {
      return getT()('dp.termales-otono.d')
    },
    perPerson: 90_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Termales del Otoño', get kind() { return getT()('dk.termales') }, match: /termales del oto/i },
  },
  {
    id: 'nevado-ruiz',
    places: ['manizales'],
    get title() {
      return getT()('dp.nevado-ruiz.t')
    },
    get detail() {
      return getT()('dp.nevado-ruiz.d')
    },
    perPerson: 250_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Parque Nacional Natural Los Nevados', get kind() { return getT()('dk.parque-nacional') }, match: /los nevados/i },
  },
  {
    id: 'recinto-pensamiento',
    places: ['manizales'],
    get title() {
      return getT()('dp.recinto-pensamiento.t')
    },
    get detail() {
      return getT()('dp.recinto-pensamiento.d')
    },
    perPerson: 40_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Recinto del Pensamiento', get kind() { return getT()('dk.parque') }, match: /recinto del pensamiento/i },
  },
  {
    id: 'hacienda-venecia',
    places: ['manizales'],
    get title() {
      return getT()('dp.hacienda-venecia.t')
    },
    get detail() {
      return getT()('dp.hacienda-venecia.d')
    },
    perPerson: 120_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Hacienda Venecia', get kind() { return getT()('dk.finca-cafetera') }, match: /hacienda venecia/i },
  },

  // --- Eje Cafetero (Salento, Filandia, Armenia, Pereira) ---------------------
  {
    id: 'cocora-caballo',
    places: ['salento', 'filandia', 'armenia', 'pereira'],
    get title() {
      return getT()('dp.cocora-caballo.t')
    },
    get detail() {
      return getT()('dp.cocora-caballo.d')
    },
    perPerson: 90_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Valle de Cocora', get kind() { return getT()('dk.valle') }, match: /cocora/i },
  },
  {
    id: 'finca-eje',
    places: COFFEE_TOWNS,
    get title() {
      return getT()('dp.finca-eje.t')
    },
    get detail() {
      return getT()('dp.finca-eje.d')
    },
    perPerson: 70_000,
    part: 'tarde',
  },
  {
    id: 'tejo',
    places: ['salento', 'filandia'],
    get title() {
      return getT()('dp.tejo.t')
    },
    get detail() {
      return getT()('dp.tejo.d')
    },
    perPerson: 30_000,
    part: 'noche',
  },
  {
    id: 'termales-santa-rosa',
    places: ['pereira', 'santa rosa de cabal'],
    get title() {
      return getT()('dp.termales-santa-rosa.t')
    },
    get detail() {
      return getT()('dp.termales-santa-rosa.d')
    },
    perPerson: 110_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Termales de Santa Rosa de Cabal', get kind() { return getT()('dk.termales') }, match: /termales/i },
  },
  {
    id: 'parque-del-cafe',
    places: ['armenia', 'montenegro', 'quimbaya', 'pereira'],
    get title() {
      return getT()('dp.parque-del-cafe.t')
    },
    get detail() {
      return getT()('dp.parque-del-cafe.d')
    },
    perPerson: 100_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Parque del Café', get kind() { return getT()('dk.parque-tematico') }, match: /parque del caf/i },
  },
  {
    id: 'panaca',
    places: ['armenia', 'quimbaya', 'montenegro'],
    get title() {
      return getT()('dp.panaca.t')
    },
    get detail() {
      return getT()('dp.panaca.d')
    },
    perPerson: 90_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Panaca', get kind() { return getT()('dk.parque-tematico') }, match: /panaca/i },
  },

  // --- Guatapé --------------------------------------------------------------
  {
    id: 'piedra-penol',
    places: ['guatape'],
    get title() {
      return getT()('dp.piedra-penol.t')
    },
    get detail() {
      return getT()('dp.piedra-penol.d')
    },
    perPerson: 25_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Piedra del Peñol', get kind() { return getT()('dk.mirador') }, match: /piedra del pe[ñn]ol/i },
  },
  {
    id: 'lancha-embalse',
    places: ['guatape'],
    get title() {
      return getT()('dp.lancha-embalse.t')
    },
    get detail() {
      return getT()('dp.lancha-embalse.d')
    },
    perPerson: 50_000,
    part: 'tarde',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Malecón de Guatapé', get kind() { return getT()('dk.malecon') }, match: /malec[oó]n/i },
  },

  // --- Villa de Leyva -------------------------------------------------------
  {
    id: 'pozos-azules',
    places: ['villa de leyva'],
    get title() {
      return getT()('dp.pozos-azules.t')
    },
    get detail() {
      return getT()('dp.pozos-azules.d')
    },
    perPerson: 80_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Pozos Azules', get kind() { return getT()('dk.lagunas') }, match: /pozos azules/i },
  },
  {
    id: 'vinedo-leyva',
    places: ['villa de leyva'],
    get title() {
      return getT()('dp.vinedo-leyva.t')
    },
    get detail() {
      return getT()('dp.vinedo-leyva.d')
    },
    perPerson: 80_000,
    part: 'tarde',
  },

  // --- San Gil y Barichara --------------------------------------------------
  {
    id: 'rafting-fonce',
    places: ['san gil'],
    get title() {
      return getT()('dp.rafting-fonce.t')
    },
    get detail() {
      return getT()('dp.rafting-fonce.d')
    },
    perPerson: 70_000,
    part: 'mañana',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Río Fonce', get kind() { return getT()('dk.rio') }, match: /fonce/i },
  },
  {
    id: 'chicamocha',
    places: ['san gil', 'bucaramanga'],
    get title() {
      return getT()('dp.chicamocha.t')
    },
    get detail() {
      return getT()('dp.chicamocha.d')
    },
    perPerson: 100_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.lugar') }, name: 'Parque Nacional del Chicamocha', get kind() { return getT()('dk.parque') }, match: /chicamocha/i },
  },
  {
    id: 'camino-guane',
    places: ['san gil', 'barichara'],
    get title() {
      return getT()('dp.camino-guane.t')
    },
    get detail() {
      return getT()('dp.camino-guane.d')
    },
    perPerson: 40_000,
    part: 'mañana',
  },

  // --- Leticia y Palomino ---------------------------------------------------
  {
    id: 'rio-amazonas',
    places: ['leticia'],
    get title() {
      return getT()('dp.rio-amazonas.t')
    },
    get detail() {
      return getT()('dp.rio-amazonas.d')
    },
    perPerson: 250_000,
    part: 'todo el día',
    venue: { get role() { return getT()('dr.sale-de') }, name: 'Muelle de Leticia', get kind() { return getT()('dk.muelle') }, match: /muelle/i },
  },
  {
    id: 'tubing-palomino',
    places: ['palomino'],
    get title() {
      return getT()('dp.tubing-palomino.t')
    },
    get detail() {
      return getT()('dp.tubing-palomino.d')
    },
    perPerson: 50_000,
    part: 'tarde',
  },
]

/** Los planes propios del destino (nombre ya normalizado), o [] si no tiene. */
export function destinationPlans(name: string): DestinationPlan[] {
  return DESTINATION_PLANS.filter((plan) => plan.places.some((place) => name === place || name.startsWith(`${place} `)))
}
