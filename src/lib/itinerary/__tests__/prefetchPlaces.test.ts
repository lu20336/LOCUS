import { describe, expect, it, vi } from 'vitest'
import type { CategoryId, Place } from '../../../types/itinerary'
import { mapWithConcurrency } from '../geoapifyClient'
import { createPrefetchingClient } from '../prefetchPlaces'

const place = (id: string, category: CategoryId): Place => ({ id, name: id, category, kind: 'x', score: 1, lat: 0, lon: 0 })
const ALL: CategoryId[] = ['playa', 'cultura', 'gastronomia', 'aventura', 'vidaNocturna', 'compras']
const center = { lat: 6.2442, lon: -75.5812 }

describe('búsqueda de lugares por adelantado', () => {
  it('pide todas las actividades una vez y luego filtra sin volver a consultar', async () => {
    const base = { findPlaces: vi.fn(async () => [place('museo', 'cultura'), place('bar', 'vidaNocturna'), place('cafe', 'gastronomia')]) }
    const client = createPrefetchingClient(base, ALL)
    client.prefetch(center, 8000)
    client.prefetch(center, 8000) // repetido: no consulta otra vez
    const found = await client.findPlaces(center, 8000, ['cultura', 'gastronomia'])
    expect(found.map((p) => p.id)).toEqual(['museo', 'cafe'])
    expect(base.findPlaces).toHaveBeenCalledTimes(1)
    expect(base.findPlaces).toHaveBeenCalledWith(center, 8000, ALL)
  })

  it('sin búsqueda anticipada (u otro radio) consulta normalmente', async () => {
    const base = { findPlaces: vi.fn(async (_c: unknown, _r: number, cats: CategoryId[]) => cats.map((c) => place(c, c))) }
    const client = createPrefetchingClient(base, ALL)
    client.prefetch(center, 8000)
    await client.findPlaces(center, 6000, ['cultura'])
    expect(base.findPlaces).toHaveBeenLastCalledWith(center, 6000, ['cultura'])
  })

  it('si la búsqueda anticipada falla, reintenta y la olvida', async () => {
    let calls = 0
    const base = {
      findPlaces: vi.fn(async () => {
        calls++
        if (calls === 1) throw new Error('caído')
        return [place('museo', 'cultura')]
      }),
    }
    const client = createPrefetchingClient(base, ALL)
    await client.prefetch(center, 8000).catch(() => undefined)
    expect((await client.findPlaces(center, 8000, ['cultura'])).map((p) => p.id)).toEqual(['museo'])
  })
})

describe('mapWithConcurrency', () => {
  it('conserva el orden y nunca pasa del límite de tareas simultáneas', async () => {
    let running = 0
    let peak = 0
    const result = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, ms))
      running--
      return ms * 2
    })
    expect(result).toEqual([60, 20, 40, 10, 30])
    expect(peak).toBe(2)
  })
})
