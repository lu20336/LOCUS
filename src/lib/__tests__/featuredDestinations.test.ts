import { describe, expect, it } from 'vitest'
import { FEATURED_DESTINATIONS, findFeaturedNear } from '../featuredDestinations'

describe('findFeaturedNear', () => {
  it('reconoce un destacado aunque las coordenadas vengan de Nominatim (un poco distintas)', () => {
    // Centro de Cartagena según Nominatim vs. el de la tarjeta (10.424, -75.548).
    expect(findFeaturedNear({ lat: 10.4265566, lon: -75.5441671 })?.id).toBe('cartagena')
  })

  it('devuelve null lejos de cualquier destacado', () => {
    expect(findFeaturedNear({ lat: 1.214, lon: -77.2785 })).toBeNull() // Pasto
  })
})

/** Fotos que existen en public/images/lugares (se publican con la app). */
const PLACE_PHOTOS = new Set(
  Object.keys(import.meta.glob('/public/images/lugares/**/*.jpg')).map((path) => path.replace(/^\/public/, '')),
)

describe('FEATURED_DESTINATIONS', () => {
  it.each(FEATURED_DESTINATIONS.map((d) => [d.name, d.places] as const))(
    '%s tiene entre 3 y 6 lugares para visitar, sin repetir y con foto',
    (_, places) => {
      expect(places.length).toBeGreaterThanOrEqual(3)
      expect(places.length).toBeLessThanOrEqual(6)
      expect(new Set(places.map((p) => p.name)).size).toBe(places.length)
      for (const place of places) {
        expect(place.name.trim()).toBe(place.name)
        expect(PLACE_PHOTOS.has(place.image), `falta la foto ${place.image}`).toBe(true)
      }
    },
  )

  it('no hay fotos de lugares sin usar', () => {
    const used = new Set(FEATURED_DESTINATIONS.flatMap((d) => d.places.map((p) => p.image)))
    expect([...PLACE_PHOTOS].filter((photo) => !used.has(photo))).toEqual([])
  })
})
