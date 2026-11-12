/**
 * Destinos de la sección "Viaja por Colombia" de la pantalla de inicio.
 *
 * Cada uno trae sus coordenadas: al elegir la tarjeta, el campo de destino se
 * llena con `query` y, si el usuario no lo cambia, usamos estas coordenadas en
 * vez de consultar a Nominatim. Así evitamos ambigüedades (hay varios
 * municipios llamados "San Andrés" en Colombia) y ahorramos una petición.
 * Coordenadas y altitudes aproximadas del centro de cada lugar.
 *
 * El clima de la tarjeta se calcula con la altitud y la MISMA regla de pisos
 * térmicos que usa la sugerencia de destino (climateForElevation), para que
 * la portada y el Modo B nunca se contradigan.
 */
import type { Destination } from '../types/itinerary'
import { climateForElevation, type ClimateId } from './itinerary/suggestDestination'

/** Un lugar para visitar, con su foto en /public/images/lugares (créditos en public/images/CREDITOS.md). */
export interface PlaceToVisit {
  name: string
  image: string
}

export interface FeaturedDestination {
  id: string
  name: string
  tagline: string
  /** Foto en /public/images/destinos (ver public/images/CREDITOS.md). */
  image: string
  /** Encuadre de la foto dentro de la tarjeta (CSS object-position). */
  imagePosition?: string
  /** Altitud en metros sobre el nivel del mar. */
  elevation: number
  /** Lugares conocidos para visitar: al pasar el mouse se deslizan sobre la tarjeta con su foto. */
  places: PlaceToVisit[]
  destination: Destination
}

export const climateOf = (item: FeaturedDestination): ClimateId => climateForElevation(item.elevation) ?? 'frio'

const city = (query: string, displayName: string, lat: number, lon: number, radiusMeters: number): Destination => ({
  query,
  displayName,
  lat,
  lon,
  radiusMeters,
})

export const FEATURED_DESTINATIONS: FeaturedDestination[] = [
  {
    id: 'cartagena',
    name: 'Cartagena',
    elevation: 2,
    tagline: 'Historia y mar Caribe',
    places: [
      { name: 'Ciudad Amurallada', image: '/images/lugares/cartagena/ciudad-amurallada.jpg' },
      { name: 'Castillo San Felipe de Barajas', image: '/images/lugares/cartagena/castillo-san-felipe-de-barajas.jpg' },
      { name: 'Barrio Getsemaní', image: '/images/lugares/cartagena/barrio-getsemani.jpg' },
      { name: 'Islas del Rosario', image: '/images/lugares/cartagena/islas-del-rosario.jpg' },
      { name: 'Playa Blanca de Barú', image: '/images/lugares/cartagena/playa-blanca-de-baru.jpg' },
    ],
    image: '/images/destinos/cartagena.jpg',
    destination: city('Cartagena, Colombia', 'Cartagena de Indias, Bolívar, Colombia', 10.424, -75.548, 8000),
  },
  {
    id: 'medellin',
    name: 'Medellín',
    elevation: 1495,
    tagline: 'Clima templado todo el año',
    places: [
      { name: 'Comuna 13', image: '/images/lugares/medellin/comuna-13.jpg' },
      { name: 'Parque Arví', image: '/images/lugares/medellin/parque-arvi.jpg' },
      { name: 'Plaza Botero', image: '/images/lugares/medellin/plaza-botero.jpg' },
      { name: 'Pueblito Paisa', image: '/images/lugares/medellin/pueblito-paisa.jpg' },
      { name: 'Jardín Botánico', image: '/images/lugares/medellin/jardin-botanico.jpg' },
    ],
    image: '/images/destinos/medellin.jpg',
    destination: city('Medellín, Colombia', 'Medellín, Antioquia, Colombia', 6.2442, -75.5812, 8000),
  },
  {
    id: 'bogota',
    name: 'Bogotá',
    elevation: 2640,
    tagline: 'Cultura en las alturas',
    places: [
      { name: 'La Candelaria', image: '/images/lugares/bogota/la-candelaria.jpg' },
      { name: 'Museo del Oro', image: '/images/lugares/bogota/museo-del-oro.jpg' },
      { name: 'Cerro de Monserrate', image: '/images/lugares/bogota/cerro-de-monserrate.jpg' },
      { name: 'Museo Botero', image: '/images/lugares/bogota/museo-botero.jpg' },
      { name: 'Usaquén', image: '/images/lugares/bogota/usaquen.jpg' },
    ],
    image: '/images/destinos/bogota.jpg',
    imagePosition: '45% center',
    destination: city('Bogotá, Colombia', 'Bogotá, Distrito Capital, Colombia', 4.6097, -74.0817, 8000),
  },
  {
    id: 'villa-de-leyva',
    name: 'Villa de Leyva',
    elevation: 2149,
    tagline: 'Pueblo colonial, clima frío',
    places: [
      { name: 'Plaza Mayor', image: '/images/lugares/villa-de-leyva/plaza-mayor.jpg' },
      { name: 'Pozos Azules', image: '/images/lugares/villa-de-leyva/pozos-azules.jpg' },
      { name: 'Casa Terracota', image: '/images/lugares/villa-de-leyva/casa-terracota.jpg' },
      { name: 'Museo El Fósil', image: '/images/lugares/villa-de-leyva/museo-el-fosil.jpg' },
      { name: 'Convento del Santo Ecce Homo', image: '/images/lugares/villa-de-leyva/convento-del-santo-ecce-homo.jpg' },
    ],
    image: '/images/destinos/villa-de-leyva.jpg',
    imagePosition: '30% center',
    destination: city('Villa de Leyva, Colombia', 'Villa de Leyva, Boyacá, Colombia', 5.6337, -73.5245, 6000),
  },
  {
    id: 'san-andres',
    name: 'San Andrés',
    elevation: 5,
    tagline: 'Isla caribeña',
    places: [
      { name: 'Johnny Cay', image: '/images/lugares/san-andres/johnny-cay.jpg' },
      { name: 'Acuario y Haynes Cay', image: '/images/lugares/san-andres/acuario-y-haynes-cay.jpg' },
      { name: 'Hoyo Soplador', image: '/images/lugares/san-andres/hoyo-soplador.jpg' },
      { name: 'Cueva de Morgan', image: '/images/lugares/san-andres/cueva-de-morgan.jpg' },
      { name: 'West View', image: '/images/lugares/san-andres/west-view.jpg' },
    ],
    image: '/images/destinos/san-andres.jpg',
    destination: city('San Andrés, Colombia', 'San Andrés, San Andrés y Providencia, Colombia', 12.5847, -81.7006, 6000),
  },
  {
    id: 'salento',
    name: 'Salento',
    elevation: 1895,
    tagline: 'Eje cafetero y aventura',
    places: [
      { name: 'Valle de Cocora', image: '/images/lugares/salento/valle-de-cocora.jpg' },
      { name: 'Calle Real', image: '/images/lugares/salento/calle-real.jpg' },
      { name: 'Mirador de Salento', image: '/images/lugares/salento/mirador-de-salento.jpg' },
      { name: 'Fincas cafeteras', image: '/images/lugares/salento/fincas-cafeteras.jpg' },
      { name: 'Río Quindío', image: '/images/lugares/salento/rio-quindio.jpg' },
    ],
    image: '/images/destinos/salento.jpg',
    destination: city('Salento, Quindío, Colombia', 'Salento, Quindío, Colombia', 4.6372, -75.5703, 8000),
  },
  {
    id: 'santa-marta',
    name: 'Santa Marta',
    elevation: 6,
    tagline: 'Playa y Sierra Nevada',
    places: [
      { name: 'Parque Tayrona', image: '/images/lugares/santa-marta/parque-tayrona.jpg' },
      { name: 'Minca', image: '/images/lugares/santa-marta/minca.jpg' },
      { name: 'Taganga', image: '/images/lugares/santa-marta/taganga.jpg' },
      { name: 'Quinta de San Pedro Alejandrino', image: '/images/lugares/santa-marta/quinta-de-san-pedro-alejandrino.jpg' },
      { name: 'El Rodadero', image: '/images/lugares/santa-marta/el-rodadero.jpg' },
    ],
    image: '/images/destinos/santa-marta.jpg',
    destination: city('Santa Marta, Colombia', 'Santa Marta, Magdalena, Colombia', 11.2408, -74.199, 8000),
  },
  {
    id: 'guatape',
    name: 'Guatapé',
    elevation: 1925,
    tagline: 'Piedra del Peñol y embalse',
    places: [
      { name: 'Piedra del Peñol', image: '/images/lugares/guatape/piedra-del-penol.jpg' },
      { name: 'Calle del Recuerdo', image: '/images/lugares/guatape/calle-del-recuerdo.jpg' },
      { name: 'Zócalos de colores', image: '/images/lugares/guatape/zocalos-de-colores.jpg' },
      { name: 'Malecón de Guatapé', image: '/images/lugares/guatape/malecon-de-guatape.jpg' },
      { name: 'Paseo en lancha por el embalse', image: '/images/lugares/guatape/paseo-en-lancha-por-el-embalse.jpg' },
    ],
    image: '/images/destinos/guatape.jpg',
    imagePosition: '75% center',
    destination: city('Guatapé, Antioquia, Colombia', 'Guatapé, Antioquia, Colombia', 6.2333, -75.1586, 6000),
  },
]
