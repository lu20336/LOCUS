import { describe, expect, it } from 'vitest'
import { FEATURED_DESTINATIONS } from '../featuredDestinations'

describe('FEATURED_DESTINATIONS', () => {
  it.each(FEATURED_DESTINATIONS.map((d) => [d.name, d.places] as const))(
    '%s tiene entre 3 y 6 lugares para visitar, sin repetir',
    (_, places) => {
      expect(places.length).toBeGreaterThanOrEqual(3)
      expect(places.length).toBeLessThanOrEqual(6)
      expect(new Set(places).size).toBe(places.length)
      places.forEach((place) => expect(place.trim()).toBe(place))
    },
  )
})
