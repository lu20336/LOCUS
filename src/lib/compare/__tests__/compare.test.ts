import { describe, expect, it } from 'vitest'
import { withAffiliate } from '../affiliates'
import { notebookKey, summarizeQuotes } from '../priceNotebook'
import { airlineLinks, experienceLinks, flightSearchLinks, propertyLinks, stayLinks } from '../providers'

const NO_AFF = {}

describe('stayLinks', () => {
  const q = { place: 'Cartagena de Indias, Bolívar, Colombia', checkIn: '2026-12-05', checkOut: '2026-12-08', adults: 3 }

  it('pre-llena destino, fechas y viajeros en Booking, Airbnb, Expedia, KAYAK y Vrbo', () => {
    const links = Object.fromEntries(stayLinks(q, NO_AFF).map((l) => [l.provider.id, l]))
    expect(links.booking.url).toContain('ss=Cartagena%20de%20Indias%2C%20Colombia')
    expect(links.booking.url).toContain('checkin=2026-12-05')
    expect(links.booking.url).toContain('group_adults=3')
    expect(links.airbnb.url).toContain('/s/Cartagena-de-Indias--Colombia/homes')
    expect(links.airbnb.url).toContain('checkin=2026-12-05')
    expect(links.expedia.url).toContain('startDate=2026-12-05')
    expect(links.kayak.url).toContain('/2026-12-05/2026-12-08/3adults')
    expect(links.vrbo.url).toContain('adults=3')
    expect(links.booking.prefill).toBe('full')
  })

  it('sin fechas solo pre-llena el destino', () => {
    const links = stayLinks({ place: 'Salento', adults: 2 }, NO_AFF)
    const booking = links.find((l) => l.provider.id === 'booking')!
    expect(booking.url).not.toContain('checkin')
    expect(booking.prefill).toBe('place')
  })

  it('fechas invertidas se tratan como sin fechas', () => {
    const booking = stayLinks({ place: 'Salento', checkIn: '2026-12-08', checkOut: '2026-12-05', adults: 2 }, NO_AFF).find(
      (l) => l.provider.id === 'booking',
    )!
    expect(booking.url).not.toContain('checkin')
  })

  it('las plataformas sin pre-llenado se declaran como tales', () => {
    const none = stayLinks(q, NO_AFF).filter((l) => l.prefill === 'none').map((l) => l.provider.id)
    expect(none).toEqual(expect.arrayContaining(['despegar', 'trivago']))
  })

  it('limita los adultos a un rango válido', () => {
    const booking = stayLinks({ place: 'Cali', adults: 99 }, NO_AFF).find((l) => l.provider.id === 'booking')!
    expect(booking.url).toContain('group_adults=16')
  })
})

describe('propertyLinks', () => {
  it('busca el establecimiento por nombre y manda Airbnb por Google', () => {
    const links = propertyLinks('Finca El Cafetal', 'Salento', { checkIn: '2026-12-05', checkOut: '2026-12-08', adults: 4 }, NO_AFF)
    const booking = links.find((l) => l.provider.id === 'booking')!
    expect(decodeURIComponent(booking.url)).toContain('Finca El Cafetal Salento, Colombia')
    const airbnb = links.find((l) => l.provider.id === 'airbnb')!
    expect(airbnb.url.startsWith('https://www.google.com/search?q=')).toBe(true)
    expect(decodeURIComponent(airbnb.url)).toContain('"Finca El Cafetal"')
  })
})

describe('flightSearchLinks', () => {
  it('arma ida y vuelta en los cuatro metabuscadores', () => {
    const links = Object.fromEntries(
      flightSearchLinks({ origin: 'bog', destination: 'ctg', date: '2026-12-05', returnDate: '2026-12-08', adults: 2 }, NO_AFF).map(
        (l) => [l.provider.id, l],
      ),
    )
    expect(links.skyscanner.url).toContain('/bog/ctg/261205/261208/')
    expect(links['kayak-flights'].url).toContain('/BOG-CTG/2026-12-05/2026-12-08/2adults')
    expect(links.aviasales.url).toContain('/search/BOG0512CTG08122')
    expect(decodeURIComponent(links['google-flights'].url)).toContain('from BOG to CTG on 2026-12-05 returning 2026-12-08')
  })

  it('solo ida: un regreso anterior a la ida se ignora', () => {
    const links = flightSearchLinks({ origin: 'BOG', destination: 'MDE', date: '2026-12-05', returnDate: '2026-12-01', adults: 1 }, NO_AFF)
    expect(links.find((l) => l.provider.id === 'aviasales')!.url).toContain('/search/BOG0512MDE1')
  })
})

describe('listas fijas', () => {
  it('experiencias y aerolíneas devuelven enlaces https', () => {
    for (const l of [...experienceLinks('Salento', NO_AFF), ...airlineLinks(NO_AFF)]) expect(l.url.startsWith('https://')).toBe(true)
    expect(airlineLinks(NO_AFF).every((l) => l.prefill === 'none')).toBe(true)
  })
})

describe('withAffiliate', () => {
  it('agrega el fragmento del programa y marca el enlace como patrocinado', () => {
    const r = withAffiliate('booking', 'https://www.booking.com/searchresults.es.html?ss=Cali', { booking: 'aid=123&label=locus' })
    expect(r.sponsored).toBe(true)
    expect(new URL(r.url).searchParams.get('aid')).toBe('123')
    expect(new URL(r.url).searchParams.get('label')).toBe('locus')
    expect(new URL(r.url).searchParams.get('ss')).toBe('Cali')
  })

  it('sin variable el enlace queda limpio', () => {
    expect(withAffiliate('booking', 'https://x.test/?a=1', {})).toEqual({ url: 'https://x.test/?a=1', sponsored: false })
  })

  it('acepta el id con guion y un "?" inicial', () => {
    const r = withAffiliate('kayak-flights', 'https://x.test/', { kayak_flights: '?marker=9' })
    expect(r.sponsored).toBe(true)
    expect(r.url).toContain('marker=9')
  })

  it('una URL inválida no se toca', () => {
    expect(withAffiliate('booking', 'no es url', { booking: 'aid=1' })).toEqual({ url: 'no es url', sponsored: false })
  })
})

describe('summarizeQuotes', () => {
  const q = (providerId: string, totalCOP: number) => ({ providerId, label: providerId, totalCOP, source: 'user' as const })

  it('ordena, marca la mejor y calcula diferencias y ahorro', () => {
    const s = summarizeQuotes([q('a', 900_000), q('b', 750_000), q('c', 1_000_000)])
    expect(s.best?.providerId).toBe('b')
    expect(s.ranked.map((r) => r.providerId)).toEqual(['b', 'a', 'c'])
    expect(s.ranked[1]).toMatchObject({ extraCOP: 150_000, extraPct: 20 })
    expect(s.savingsCOP).toBe(250_000)
  })

  it('ignora precios vacíos, negativos o no numéricos', () => {
    const s = summarizeQuotes([q('a', 0), q('b', -5), q('c', Number.NaN), q('d', 500_000)])
    expect(s.ranked).toHaveLength(1)
    expect(s.savingsCOP).toBe(0)
  })

  it('sin datos no hay mejor opción', () => {
    expect(summarizeQuotes([])).toEqual({ ranked: [], best: null, savingsCOP: 0 })
  })
})

describe('notebookKey', () => {
  it('es estable e ignora mayúsculas y espacios del destino', () => {
    expect(notebookKey('stay', ' Cali ', '2026-12-05', '2026-12-08', 2)).toBe(notebookKey('stay', 'cali', '2026-12-05', '2026-12-08', 2))
  })
})
