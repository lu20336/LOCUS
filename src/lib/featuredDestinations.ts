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
    image: '/images/destinos/cartagena.jpg',
    destination: city('Cartagena, Colombia', 'Cartagena de Indias, Bolívar, Colombia', 10.424, -75.548, 8000),
  },
  {
    id: 'medellin',
    name: 'Medellín',
    elevation: 1495,
    tagline: 'Clima templado todo el año',
    image: '/images/destinos/medellin.jpg',
    destination: city('Medellín, Colombia', 'Medellín, Antioquia, Colombia', 6.2442, -75.5812, 8000),
  },
  {
    id: 'bogota',
    name: 'Bogotá',
    elevation: 2640,
    tagline: 'Cultura en las alturas',
    image: '/images/destinos/bogota.jpg',
    imagePosition: '45% center',
    destination: city('Bogotá, Colombia', 'Bogotá, Distrito Capital, Colombia', 4.6097, -74.0817, 8000),
  },
  {
    id: 'villa-de-leyva',
    name: 'Villa de Leyva',
    elevation: 2149,
    tagline: 'Pueblo colonial, clima frío',
    image: '/images/destinos/villa-de-leyva.jpg',
    imagePosition: '30% center',
    destination: city('Villa de Leyva, Colombia', 'Villa de Leyva, Boyacá, Colombia', 5.6337, -73.5245, 6000),
  },
  {
    id: 'san-andres',
    name: 'San Andrés',
    elevation: 5,
    tagline: 'Isla caribeña',
    image: '/images/destinos/san-andres.jpg',
    destination: city('San Andrés, Colombia', 'San Andrés, San Andrés y Providencia, Colombia', 12.5847, -81.7006, 6000),
  },
  {
    id: 'salento',
    name: 'Salento',
    elevation: 1895,
    tagline: 'Eje cafetero y aventura',
    image: '/images/destinos/salento.jpg',
    destination: city('Salento, Quindío, Colombia', 'Salento, Quindío, Colombia', 4.6372, -75.5703, 8000),
  },
  {
    id: 'santa-marta',
    name: 'Santa Marta',
    elevation: 6,
    tagline: 'Playa y Sierra Nevada',
    image: '/images/destinos/santa-marta.jpg',
    destination: city('Santa Marta, Colombia', 'Santa Marta, Magdalena, Colombia', 11.2408, -74.199, 8000),
  },
  {
    id: 'guatape',
    name: 'Guatapé',
    elevation: 1925,
    tagline: 'Piedra del Peñol y embalse',
    image: '/images/destinos/guatape.jpg',
    imagePosition: '75% center',
    destination: city('Guatapé, Antioquia, Colombia', 'Guatapé, Antioquia, Colombia', 6.2333, -75.1586, 6000),
  },
]
