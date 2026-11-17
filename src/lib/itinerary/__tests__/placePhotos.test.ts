import { describe, expect, it } from 'vitest'
import {
  WIKIDATA_CLASSES,
  buildCommonsSearchUrl,
  commonsFileName,
  findDestinationPhotos,
  hasWord,
  isPhotoOfDestination,
  pickWikidataPhotos,
  toPlacePhoto,
} from '../placePhotos'

const cali = { name: 'Cali', region: 'Valle del Cauca', lat: 3.452, lon: -76.5325 }

const info = (over: Record<string, unknown> = {}, meta: Record<string, string> = {}) => ({
  mime: 'image/jpeg',
  width: 1600,
  height: 1000,
  thumburl: 'https://upload.wikimedia.org/thumb.jpg',
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  extmetadata: Object.fromEntries(
    Object.entries({ LicenseShortName: 'CC BY-SA 4.0', Artist: '<a href="#">Ana</a>', ...meta }).map(([k, v]) => [k, { value: v }]),
  ),
  ...over,
})

const row = (cat: string, label: string, file: string, dist: number) => ({
  item: { value: `http://www.wikidata.org/entity/${label}` },
  itemLabel: { value: label },
  cat: { value: cat },
  image: { value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}` },
  dist: { value: String(dist) },
})

describe('hasWord', () => {
  it('reconoce la palabra completa, sin tildes ni mayúsculas', () => {
    expect(hasWord('Panorámica nocturna de Cali 2023.jpg', 'Cali')).toBe(true)
    expect(hasWord('Catedral de BOGOTÁ', 'Bogota')).toBe(true)
  })
  it('no confunde Cali con California', () => {
    expect(hasWord('Humboldt Sink on the California Trail.jpg', 'Cali')).toBe(false)
  })
})

describe('commonsFileName', () => {
  it('saca el nombre del archivo de una URL de Wikidata o de un título', () => {
    expect(commonsFileName('http://commons.wikimedia.org/wiki/Special:FilePath/Teatro%20Imperial.jpg')).toBe('Teatro Imperial.jpg')
    expect(commonsFileName('File:Teatro_Imperial.jpg')).toBe('Teatro Imperial.jpg')
  })
})

describe('pickWikidataPhotos', () => {
  it('elige el lugar más cercano por actividad y la foto del municipio, sin repetir fotos', () => {
    const picked = pickWikidataPhotos(
      [
        row('cultura', 'Teatro Jorge Isaacs', 'Teatro.jpg', 0.3),
        row('cultura', 'Catedral', 'Catedral.jpg', 0.1),
        row('ciudad', 'Cali', 'Cali.jpg', 1.9),
        row('aventura', 'Jardín Botánico de Cali', 'Cali.jpg', 4), // misma foto que la ciudad: se salta
        row('aventura', 'Zoológico de Cali', 'Zoo.jpg', 5),
      ],
      'Cali',
    )
    expect(picked.city).toEqual({ file: 'Cali.jpg', label: 'Cali' })
    expect(picked.byCategory.cultura).toEqual({ file: 'Catedral.jpg', label: 'Catedral' })
    expect(picked.byCategory.aventura?.label).toBe('Zoológico de Cali')
    expect(picked.byCategory.gastronomia).toBeUndefined()
  })

  it('prefiere el tipo de lugar (museo antes que sitio histórico) aunque esté más lejos', () => {
    const withClass = (r: ReturnType<typeof row>, q: string) => ({ ...r, class: { value: `http://www.wikidata.org/entity/${q}` } })
    const picked = pickWikidataPhotos(
      [
        withClass(row('cultura', 'Plaza de toros', 'Toros.jpg', 0.5), 'Q1081138'), // sitio histórico
        withClass(row('cultura', 'Museo La Tertulia', 'Tertulia.jpg', 2), 'Q33506'), // museo
      ],
      'Cali',
    )
    expect(picked.byCategory.cultura?.label).toBe('Museo La Tertulia')
  })

  it('un jardín botánico que también figura como museo es Aventura, no Cultura', () => {
    const jardin = { ...row('cultura', 'Jardín Botánico de Cali', 'Jardin.jpg', 4), item: { value: 'wd:Q1' } }
    const jardinNat = { ...row('aventura', 'Jardín Botánico de Cali', 'Jardin.jpg', 4), item: { value: 'wd:Q1' } }
    const museo = row('cultura', 'Museo del Oro Calima', 'Calima.jpg', 6)
    const picked = pickWikidataPhotos([jardin, jardinNat, museo], 'Cali')
    expect(picked.byCategory.cultura?.label).toBe('Museo del Oro Calima')
    expect(picked.byCategory.aventura?.label).toBe('Jardín Botánico de Cali')
  })

  it('para la ciudad prefiere el municipio con ese nombre aunque haya otro más cerca', () => {
    const picked = pickWikidataPhotos([row('ciudad', 'Motavita', 'M.jpg', 0.5), row('ciudad', 'Tunja', 'T.jpg', 0.9)], 'Tunja')
    expect(picked.city?.label).toBe('Tunja')
  })

  it('nunca usa la foto de un municipio vecino ni un collage como foto de la ciudad', () => {
    expect(pickWikidataPhotos([row('ciudad', 'Motavita', 'M.jpg', 0.5)], 'Tunja').city).toBeUndefined()
    expect(pickWikidataPhotos([row('ciudad', 'Tunja', 'Collage Tunja.jpg', 0.9)], 'Tunja').city).toBeUndefined()
  })

  it('"Aventura" no incluye parques urbanos genéricos (plazas)', () => {
    expect(WIKIDATA_CLASSES.aventura).not.toContain('Q22698')
  })
})

describe('isPhotoOfDestination', () => {
  it('acepta fotos geolocalizadas cerca y rechaza las lejanas', () => {
    expect(isPhotoOfDestination({ title: 'File:A.jpg', coordinates: [{ lat: 3.45, lon: -76.53 }], imageinfo: [info()] }, cali)).toBe(true)
    expect(isPhotoOfDestination({ title: 'File:Cali.jpg', coordinates: [{ lat: 36.7, lon: -119.4 }], imageinfo: [info()] }, cali)).toBe(false)
  })

  it('sin ubicación exige el nombre en el título Y Colombia o el departamento en sus categorías', () => {
    const ok = { title: 'File:Noche en Cali.jpg', imageinfo: [info({}, { Categories: 'Cali|Night in Colombia' })] }
    const sinPais = { title: 'File:1983 long Beach Cali.jpg', imageinfo: [info({}, { Categories: 'Long Beach, California' })] }
    expect(isPhotoOfDestination(ok, cali)).toBe(true)
    expect(isPhotoOfDestination(sinPais, cali)).toBe(false)
  })

  it('rechaza fotos verticales (las tarjetas son horizontales)', () => {
    const vertical = { title: 'File:A.jpg', coordinates: [{ lat: 3.45, lon: -76.53 }], imageinfo: [info({ width: 800, height: 1200 })] }
    expect(isPhotoOfDestination(vertical, cali)).toBe(false)
  })
})

describe('toPlacePhoto', () => {
  it('toma autor (sin HTML) y licencia', () => {
    expect(toPlacePhoto({ title: 'File:A.jpg', imageinfo: [info()] }, 'Teatro')).toMatchObject({
      author: 'Ana',
      license: 'CC BY-SA 4.0',
      caption: 'Teatro',
    })
  })
  it('limpia el texto automático de Commons cuando no hay autor estructurado', () => {
    const page = {
      title: 'File:A.jpg',
      imageinfo: [info({}, { Artist: 'No machine-readable author provided. Boninerd assumed (based on copyright claims).' })],
    }
    expect(toPlacePhoto(page)?.author).toBe('Boninerd')
  })

  it('descarta licencias no libres y archivos que no son fotos', () => {
    expect(toPlacePhoto({ title: 'File:A.jpg', imageinfo: [info({}, { LicenseShortName: 'Fair use' })] })).toBeNull()
    expect(toPlacePhoto({ title: 'File:A.svg', imageinfo: [info({ mime: 'image/svg+xml' })] })).toBeNull()
  })
})

describe('buildCommonsSearchUrl', () => {
  it('busca el nombre exacto con las palabras de la actividad y permite CORS', () => {
    const url = new URL(buildCommonsSearchUrl('Cali', 'gastronomia'))
    expect(url.searchParams.get('origin')).toBe('*')
    expect(url.searchParams.get('gsrsearch')).toMatch(/^"Cali" \(restaurante OR restaurant/)
  })
})

describe('findDestinationPhotos', () => {
  it('combina Wikidata y Commons, y si un servicio falla sigue con el otro', async () => {
    const fetchFn = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://query.wikidata.org')) return new Response('caído', { status: 503 })
      const search = new URL(url).searchParams.get('gsrsearch') ?? ''
      const pages = search.includes('noche')
        ? [{ title: 'File:Noche en Cali.jpg', index: 1, coordinates: [{ lat: 3.45, lon: -76.53 }], imageinfo: [info()] }]
        : []
      return new Response(JSON.stringify({ query: { pages } }), { status: 200 })
    }) as typeof fetch
    const photos = await findDestinationPhotos(cali, fetchFn)
    expect(photos.city).toBeUndefined()
    expect(photos.incomplete).toBe(true) // Wikidata falló: no se guarda en caché
    expect(photos.byCategory.vidaNocturna?.author).toBe('Ana')
    expect(photos.byCategory.gastronomia).toBeUndefined()
  })
})
