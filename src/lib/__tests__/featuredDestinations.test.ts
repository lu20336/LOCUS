import { describe, expect, it } from 'vitest'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'

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
