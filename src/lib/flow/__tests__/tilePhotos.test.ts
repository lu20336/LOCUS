import { describe, expect, it } from 'vitest'
import type { CategoryId } from '../../../types/itinerary'
import type { PlacePhoto } from '../../itinerary/placePhotos'
import { assignTilePhotos } from '../tilePhotos'

const CATS: CategoryId[] = ['playa', 'cultura', 'gastronomia', 'aventura', 'vidaNocturna', 'compras']
const generic = Object.fromEntries(CATS.map((c) => [c, `/generic/${c}.jpg`])) as Record<CategoryId, string>
const photo = (url: string): PlacePhoto => ({ url, author: 'Ana', license: 'CC BY 4.0', sourceUrl: 'x' })

const urls = (assigned: ReturnType<typeof assignTilePhotos>) => Object.values(assigned).map((p) => p?.url)

describe('assignTilePhotos', () => {
  it('ninguna tarjeta repite foto ni usa la del encabezado', () => {
    const header = { url: 'city.jpg' }
    const assigned = assignTilePhotos({
      categories: ['cultura', 'gastronomia', 'aventura', 'vidaNocturna', 'compras'],
      header,
      auto: { byCategory: { cultura: photo('museo.jpg'), aventura: photo('city.jpg') }, extras: [photo('vista1.jpg'), photo('vista2.jpg')] },
      generic,
    })
    const all = urls(assigned)
    expect(new Set(all).size).toBe(all.length)
    expect(all).not.toContain('city.jpg')
    expect(assigned.cultura?.url).toBe('museo.jpg')
    expect(assigned.gastronomia?.url).toBe('vista1.jpg')
    expect(assigned.aventura?.url).toBe('vista2.jpg')
    expect(assigned.vidaNocturna?.url).toBe('/generic/vidaNocturna.jpg')
  })

  it('un respaldo no le quita la foto propia a otra tarjeta', () => {
    const assigned = assignTilePhotos({
      categories: ['gastronomia', 'compras'],
      header: null,
      auto: { byCategory: { compras: photo('mercado.jpg') }, extras: [photo('mercado.jpg'), photo('vista.jpg')] },
      generic,
    })
    expect(assigned.compras?.url).toBe('mercado.jpg')
    expect(assigned.gastronomia?.url).toBe('vista.jpg')
  })

  it('las fotos revisadas a mano van primero y mientras se busca el resto queda pendiente', () => {
    const assigned = assignTilePhotos({
      categories: ['playa', 'cultura'],
      header: { url: 'cartagena.jpg' },
      curated: { playa: 'playa-cartagena.jpg' },
      auto: null,
      generic,
    })
    expect(assigned.playa?.url).toBe('playa-cartagena.jpg')
    expect(assigned.cultura).toBeNull()
  })
})
