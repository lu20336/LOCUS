import { describe, expect, it } from 'vitest'
import type { TownCandidate } from '../../itinerary/suggestDestination'
import { MAX_OPTIONS, searchDestinations } from '../destinationOptions'

const town = (id: string, name: string, place: TownCandidate['place'] = 'town'): TownCandidate => ({
  id,
  name,
  lat: 5,
  lon: -75,
  place,
  elevation: 1500,
  popularity: 1,
})

// En el orden de la lista real: del más al menos poblado.
const towns: TownCandidate[] = [
  town('n/1', 'Medellín', 'city'),
  town('n/2', 'Montería', 'city'),
  town('n/3', 'Rionegro', 'city'),
  town('n/4', 'Rionegro'),
  town('n/5', 'Mesitas del Colegio'),
  town('n/6', 'Puerto Medina'),
  town('n/7', 'El Carmen de Bolívar'),
]

const names = (text: string) => searchDestinations(text, towns).map((o) => o.name)

describe('searchDestinations', () => {
  it('"med" sugiere Medellín primero, con departamento y coordenadas', () => {
    const [first] = searchDestinations('med', towns)
    expect(first).toMatchObject({ name: 'Medellín', detail: 'Antioquia, Colombia' })
    expect(first.destination).toMatchObject({ query: 'Medellín, Antioquia, Colombia', lat: 6.2442, lon: -75.5812 })
  })

  it('ignora tildes y mayúsculas, y no repite Medellín (destacado y municipio)', () => {
    expect(names('MEDELLIN')).toEqual(['Medellín'])
  })

  it('primero los que empiezan por lo escrito, después los que lo tienen en otra palabra', () => {
    expect(names('me')).toEqual(['Medellín', 'Mesitas del Colegio', 'Puerto Medina'])
  })

  it('encuentra por una palabra intermedia: "leyva" → Villa de Leyva', () => {
    expect(names('leyva')).toEqual(['Villa de Leyva'])
  })

  it('un municipio de la lista trae su destino listo para usar', () => {
    const [option] = searchDestinations('monte', towns)
    expect(option).toMatchObject({ name: 'Montería', detail: 'Colombia' })
    expect(option.destination.query).toBe('Montería, Colombia')
  })

  it('con nombres repetidos queda solo el más poblado', () => {
    const rionegro = searchDestinations('rionegro', towns)
    expect(rionegro).toHaveLength(1)
    expect(rionegro[0].id).toBe('n/3')
  })

  it('no sugiere con menos de 2 letras ni si nada coincide', () => {
    expect(names('m')).toEqual([])
    expect(names('   ')).toEqual([])
    expect(names('xyz')).toEqual([])
  })

  it(`devuelve como máximo ${MAX_OPTIONS} opciones`, () => {
    const many = Array.from({ length: 20 }, (_, i) => town(`m/${i}`, `San Pueblo ${i}`))
    expect(searchDestinations('san', many)).toHaveLength(MAX_OPTIONS)
  })

  it('sin la lista de municipios sugiere al menos los destacados', () => {
    expect(searchDestinations('car', []).map((o) => o.name)).toEqual(['Cartagena de Indias'])
  })

  it('un destacado se muestra con su nombre oficial y se encuentra por el corto', () => {
    const [option] = searchDestinations('cartagena', [])
    expect(option).toMatchObject({ name: 'Cartagena de Indias', detail: 'Bolívar, Colombia' })
  })

  it('no repite un destacado aunque el municipio tenga otro nombre (mismo lugar)', () => {
    const lista = [
      { ...town('c/1', 'Cartagena de Indias', 'city'), lat: 10.4, lon: -75.51 },
      { ...town('c/2', 'Cartagena del Chairá'), lat: 1.33, lon: -74.84 },
    ]
    expect(searchDestinations('carta', lista).map((o) => o.name)).toEqual([
      'Cartagena de Indias',
      'Cartagena del Chairá',
    ])
    expect(searchDestinations('carta', lista)[0].id).toBe('featured:cartagena')
  })
})
