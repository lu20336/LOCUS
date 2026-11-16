import { describe, expect, it } from 'vitest'
import type { TownCandidate } from '../../itinerary/suggestDestination'
import {
  availableCategories,
  countsForTown,
  countsNear,
  toCounts,
  type AvailabilityData,
} from '../activityAvailability'
import type { CategoryId } from '../../../types/itinerary'

const CATS: CategoryId[] = ['playa', 'cultura', 'gastronomia', 'aventura', 'vidaNocturna', 'compras']

const data: AvailabilityData = {
  radiusMeters: 7000,
  categories: CATS,
  featured: {
    bogota: [0, 54, 900, 12, 300, 20],
    cartagena: [15, 40, 500, 6, 120, 10],
  },
  towns: {
    'node/pasto': [0, 8, 120, 3, 25, 2],
  },
}

const towns: TownCandidate[] = [
  { id: 'node/pasto', name: 'Pasto', lat: 1.2136, lon: -77.2811, place: 'city', elevation: 2527, popularity: 9 },
]

describe('activityAvailability', () => {
  it('toCounts arma el objeto por categoría', () => {
    expect(toCounts(CATS, [1, 2, 3, 4, 5, 6])).toEqual({
      playa: 1,
      cultura: 2,
      gastronomia: 3,
      aventura: 4,
      vidaNocturna: 5,
      compras: 6,
    })
  })

  it('en Bogotá no hay playa', () => {
    const counts = countsNear({ lat: 4.61, lon: -74.08 }, data, towns)
    expect(counts?.playa).toBe(0)
    expect(availableCategories(counts!, CATS)).toEqual(['cultura', 'gastronomia', 'aventura', 'vidaNocturna', 'compras'])
  })

  it('un destino escrito a mano usa los datos de ese mismo pueblo', () => {
    // Coordenadas de Nominatim para Pasto (un poco distintas a las de la lista).
    expect(countsNear({ lat: 1.214, lon: -77.2785, displayName: 'Pasto, Nariño, Colombia' }, data, towns)?.cultura).toBe(8)
  })

  it('Bogotá según Nominatim (a ~5 km del centro de la tarjeta) se reconoce por el nombre', () => {
    const counts = countsNear({ lat: 4.6533, lon: -74.0836, displayName: 'Bogotá, Distrito Capital, Colombia' }, data, towns)
    expect(counts?.cultura).toBe(54)
  })

  it('NUNCA usa los datos de un pueblo vecino (Jardín no es Andes, a 9 km)', () => {
    const andes: TownCandidate = { id: 'node/andes', name: 'Andes', lat: 5.6569, lon: -75.8781, place: 'town', elevation: 1350, popularity: 5 }
    const jardin = { lat: 5.5986, lon: -75.8195, displayName: 'Jardín, Antioquia, Colombia' }
    expect(countsNear(jardin, { ...data, towns: { ...data.towns, 'node/andes': [0, 0, 2, 1, 0, 0] } }, [...towns, andes])).toBeNull()
  })

  it('un pueblo vecino de un destacado no toma sus datos (Bello no es Medellín)', () => {
    const bello = { lat: 6.3373, lon: -75.5579, displayName: 'Bello, Antioquia, Colombia' }
    expect(countsNear(bello, { ...data, featured: { ...data.featured, medellin: [0, 1, 1, 1, 1, 1] } }, towns)).toBeNull()
  })

  it('sin datos devuelve null (la app consulta en vivo)', () => {
    expect(countsNear({ lat: -4.2, lon: -69.94 }, data, towns)).toBeNull() // Leticia, no está en los datos de prueba
  })

  it('countsForTown busca por id y devuelve null si no está', () => {
    expect(countsForTown(data, 'node/pasto')?.gastronomia).toBe(120)
    expect(countsForTown(data, 'node/otro')).toBeNull()
  })
})
