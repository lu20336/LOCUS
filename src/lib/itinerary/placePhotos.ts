/**
 * Fotos reales de un destino cualquiera (no solo los 8 destacados), de
 * fuentes libres y gratuitas, sin clave:
 *
 *   1. Wikidata: lugares reales cerca del destino que tienen foto (ej. en Cali,
 *      Cultura → "Teatro Jorge Isaacs"), y la foto del propio municipio para el
 *      encabezado. Una sola consulta SPARQL.
 *   2. Wikimedia Commons: para las actividades sin lugar con foto en Wikidata
 *      (suele pasar con gastronomía, vida nocturna y compras), búsqueda
 *      "ciudad + actividad" con filtros estrictos para no mostrar otro lugar:
 *      la foto debe estar geolocalizada cerca, o nombrar la ciudad Y estar
 *      catalogada en Colombia o en su departamento (así "Long Beach Cali" no pasa).
 *   3. Lo que falte lo cubre la pantalla con la foto de la ciudad (nunca una
 *      foto genérica de otro lugar, salvo que no haya ni eso).
 *
 * Todas las fotos vienen de Wikimedia Commons con licencia libre: se muestran
 * con su autor y licencia (lo exigen CC BY y CC BY-SA).
 */
import type { CategoryId, GeoPoint } from '../../types/itinerary'
import { CATEGORY_IDS } from './categories'
import { haversineKm } from './geo'

export interface PlacePhoto {
  /** Miniatura lista para <img>. */
  url: string
  /** Lugar que muestra, si se sabe (ej. "Teatro Jorge Isaacs"). */
  caption?: string
  author: string
  license: string
  /** Página del archivo en Commons (autor, licencia, original). */
  sourceUrl: string
}

export interface DestinationPhotos {
  /** Foto del municipio (encabezado y respaldo de las tarjetas). */
  city?: PlacePhoto
  byCategory: Partial<Record<CategoryId, PlacePhoto>>
  /** true si algún servicio falló: el resultado sirve, pero no conviene guardarlo en caché. */
  incomplete?: boolean
}

export interface PhotoQuery extends GeoPoint {
  /** Nombre del destino, ej. "Cali". */
  name: string
  /** Departamento, ej. "Valle del Cauca" (ayuda a confirmar fotos sin ubicación). */
  region?: string
}

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
/** Ancho de las miniaturas (suficiente para tarjetas y encabezado en pantallas densas). */
const THUMB_WIDTH = 960
/** Radio para buscar lugares con foto en Wikidata. */
export const WIKIDATA_RADIUS_KM = 8
/** Una foto geolocalizada a más de esto ya no es "del destino". */
export const MAX_PHOTO_KM = 20

/**
 * Clases de Wikidata de cada actividad, EN ORDEN
 * DE PREFERENCIA: se elige el lugar de la primera clase que tenga foto, y entre
 * los de esa clase, el más cercano (ej. en Cultura, un museo antes que una
 * plaza de toros catalogada como sitio histórico).
 * "ciudad" = municipio de Colombia, para la foto del encabezado.
 * Se compara con P31 directo (sin recorrer subclases con P279*): la consulta
 * pasa de 6-25 s a menos de 1 s, por eso la lista incluye las subclases útiles.
 */
export const WIKIDATA_CLASSES: Record<CategoryId | 'ciudad', string[]> = {
  // Identificadores verificados con la API de Wikidata (etiqueta en español al lado).
  playa: ['Q40080'], // playa
  cultura: [
    'Q33506', 'Q207694', 'Q16735822', // museo, museo de arte, museo de historia
    'Q24354', 'Q153562', 'Q1329623', // teatro, teatro de ópera, centro cultural
    'Q2977', 'Q163687', 'Q16970', 'Q108325', // catedral, basílica, iglesia, capilla
    'Q4989906', 'Q179700', 'Q57821', 'Q23413', // monumento, estatua, fortificación, castillo
    'Q839954', 'Q1081138', 'Q7075', // yacimiento arqueológico, sitio histórico, biblioteca
  ],
  gastronomia: ['Q11707', 'Q30022', 'Q330284'], // restaurante, cafetería, mercado
  // Naturaleza (NO "parque" a secas, que incluye plazas urbanas).
  aventura: [
    'Q46169', 'Q179049', 'Q473972', 'Q167346', // parque nacional, reserva natural, área protegida, jardín botánico
    'Q34038', 'Q8072', 'Q8502', 'Q54050', 'Q35509', 'Q23397', 'Q43501', // cascada, volcán, montaña, colina, cueva, lago, zoológico
  ],
  vidaNocturna: ['Q622425', 'Q187456', 'Q212198'], // club nocturno, bar, pub
  compras: ['Q11315', 'Q31374404', 'Q216107', 'Q330284'], // centro comercial, área comercial, grandes almacenes, mercado
  ciudad: ['Q2555896', 'Q1549591', 'Q515'], // municipio de Colombia, gran ciudad, ciudad
}

/** Palabras para buscar en Commons (español e inglés: muchos títulos están en inglés). */
export const COMMONS_TERMS: Record<CategoryId, string> = {
  playa: 'playa OR beach',
  cultura: 'museo OR museum OR teatro OR theatre OR monumento OR monument OR catedral OR cathedral OR iglesia OR church',
  gastronomia: 'restaurante OR restaurant OR comida OR food OR gastronomía OR plato OR dish OR "plaza de mercado"',
  aventura: 'mirador OR viewpoint OR cerro OR cascada OR waterfall OR "parque natural" OR sendero OR montaña OR mountain',
  vidaNocturna: 'noche OR night OR bar OR salsa OR discoteca OR nightlife OR nocturna',
  compras: '"centro comercial" OR mall OR mercado OR market OR artesanías OR handicrafts OR tiendas OR shops',
}

const ALLOWED_LICENSE = /^(cc by(-sa)?( \d\.\d)?|cc0|public domain|pd)/i
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png'])

export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** ¿El texto contiene `word` como palabra completa? ("Cali" sí en "Noche en Cali", no en "California"). */
export function hasWord(text: string, word: string): boolean {
  const escaped = normalizeText(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizeText(text))
}

const stripHtml = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/** "File:Teatro_Jorge_Isaacs.jpg" o URL de Special:FilePath → "Teatro Jorge Isaacs.jpg". */
export function commonsFileName(value: string): string {
  const last = decodeURIComponent(value.split('/').pop() ?? value)
  return last.replace(/^File:/, '').replace(/_/g, ' ')
}

// ---------------------------------------------------------------------------
// 1. Wikidata
// ---------------------------------------------------------------------------

export function buildWikidataQuery(point: GeoPoint, radiusKm = WIKIDATA_RADIUS_KM): string {
  const values = Object.entries(WIKIDATA_CLASSES)
    .flatMap(([cat, classes]) => classes.map((q) => `(wd:${q} "${cat}")`))
    .join(' ')
  return `SELECT ?item ?itemLabel ?class ?cat ?image ?dist WHERE {
  VALUES (?class ?cat) { ${values} }
  SERVICE wikibase:around { ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:center "Point(${point.lon} ${point.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" . bd:serviceParam wikibase:distance ?dist . }
  ?item wdt:P31 ?class ; wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY ?dist LIMIT 400`
}

/** Archivos que son montajes de varias fotos (típicos de los artículos de ciudades). */
const COLLAGE = /collage|montaje|montage|mosaico|mosaic/i

/** Búsqueda en Commons de una vista general de la ciudad (si Wikidata no dio una foto usable). */
export const CITY_TERMS = 'panorámica OR panorama OR vista OR view OR skyline OR "plaza de bolívar" OR centro'

interface WikidataRow {
  item: { value: string }
  /** URL de la clase que coincidió, ej. http://www.wikidata.org/entity/Q33506 */
  class?: { value: string }
  itemLabel?: { value: string }
  cat: { value: string }
  image: { value: string }
  dist: { value: string }
}

/** Para cada actividad (y "ciudad"), el lugar con foto más cercano. Sin repetir fotos entre actividades. */
export function pickWikidataPhotos(
  rows: readonly WikidataRow[],
  cityName: string,
): { city?: { file: string; label: string }; byCategory: Partial<Record<CategoryId, { file: string; label: string }>> } {
  const sorted = [...rows].sort((a, b) => Number(a.dist.value) - Number(b.dist.value))
  // La ciudad: SOLO el municipio con ese nombre (nunca uno vecino) y que no sea
  // un collage de varias fotos (como encabezado recortado se ve mal).
  const cityRow = sorted.find(
    (r) =>
      r.cat.value === 'ciudad' &&
      r.itemLabel !== undefined &&
      hasWord(r.itemLabel.value, cityName) &&
      !COLLAGE.test(commonsFileName(r.image.value)),
  )
  const used = new Set<string>()
  const result: ReturnType<typeof pickWikidataPhotos> = { byCategory: {} }
  if (cityRow) {
    const file = commonsFileName(cityRow.image.value)
    result.city = { file, label: cityRow.itemLabel?.value ?? cityName }
    used.add(file)
  }
  const classRank = (r: WikidataRow, category: CategoryId) => {
    const index = WIKIDATA_CLASSES[category].indexOf(r.class?.value.split('/').pop() ?? '')
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  // Un lugar de naturaleza que en Wikidata también figura como museo (ej. el
  // Jardín Botánico de Cali) es foto de Aventura, no de Cultura.
  const natureItems = new Set(sorted.filter((r) => r.cat.value === 'aventura' || r.cat.value === 'playa').map((r) => r.item.value))
  const isNatureCategory = (c: CategoryId) => c === 'aventura' || c === 'playa'
  for (const category of CATEGORY_IDS) {
    const candidates = sorted.filter(
      (r) =>
        r.cat.value === category &&
        !used.has(commonsFileName(r.image.value)) &&
        (isNatureCategory(category) || !natureItems.has(r.item.value)),
    )
    // Primero el tipo de lugar preferido; a igual tipo, el más cercano (sorted ya va por distancia).
    const row = candidates.reduce<WikidataRow | undefined>(
      (best, r) => (!best || classRank(r, category) < classRank(best, category) ? r : best),
      undefined,
    )
    if (!row) continue
    const file = commonsFileName(row.image.value)
    used.add(file)
    result.byCategory[category] = { file, label: row.itemLabel?.value ?? '' }
  }
  return result
}

// ---------------------------------------------------------------------------
// 2. Commons (búsqueda) e imageinfo
// ---------------------------------------------------------------------------

interface CommonsPage {
  title: string
  index?: number
  coordinates?: { lat: number; lon: number }[]
  imageinfo?: {
    mime: string
    width: number
    height: number
    thumburl?: string
    descriptionurl: string
    extmetadata?: Record<string, { value: string } | undefined>
  }[]
}

export function buildCommonsSearchUrl(place: string, category: CategoryId | 'ciudad'): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '30',
    gsrsearch: `"${place}" (${category === 'ciudad' ? CITY_TERMS : COMMONS_TERMS[category]}) filetype:bitmap`,
    prop: 'coordinates|imageinfo',
    colimit: 'max',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  })
  return `${COMMONS_API}?${params}`
}

export function buildImageInfoUrl(files: string[]): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    titles: files.map((f) => `File:${f}`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  })
  return `${COMMONS_API}?${params}`
}

/** Convierte un archivo de Commons en PlacePhoto si es una imagen usable con licencia libre. */
export function toPlacePhoto(page: CommonsPage, caption?: string): PlacePhoto | null {
  const info = page.imageinfo?.[0]
  if (!info?.thumburl || !ALLOWED_MIME.has(info.mime) || info.width < 640) return null
  const meta = info.extmetadata ?? {}
  const license = stripHtml(meta.LicenseShortName?.value)
  if (!ALLOWED_LICENSE.test(license)) return null
  return {
    url: info.thumburl,
    caption,
    // Commons a veces escribe "No machine-readable author provided. Ana assumed (…)": nos quedamos con "Ana".
    author:
      stripHtml(meta.Artist?.value).replace(/^No machine-readable author provided\.\s*(.+?)\s+assumed\b.*$/i, '$1') ||
      'Autor desconocido',
    license,
    sourceUrl: info.descriptionurl,
  }
}

/**
 * ¿Esta foto de Commons es de verdad del destino?
 *   - Si está geolocalizada: a menos de MAX_PHOTO_KM.
 *   - Si no: el título nombra la ciudad (palabra completa) Y sus categorías o
 *     descripción mencionan Colombia o el departamento.
 * Además, apaisada (las tarjetas son horizontales).
 */
export function isPhotoOfDestination(page: CommonsPage, query: PhotoQuery): boolean {
  const info = page.imageinfo?.[0]
  if (!info || info.width < info.height) return false
  const coords = page.coordinates?.[0]
  if (coords) return haversineKm(query, coords) < MAX_PHOTO_KM
  if (!hasWord(page.title, query.name)) return false
  const meta = info.extmetadata ?? {}
  const context = `${meta.Categories?.value ?? ''} ${stripHtml(meta.ImageDescription?.value)}`
  return hasWord(context, 'colombia') || (query.region !== undefined && hasWord(context, query.region))
}

// ---------------------------------------------------------------------------
// Búsqueda completa
// ---------------------------------------------------------------------------

export async function findDestinationPhotos(
  query: PhotoQuery,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<DestinationPhotos> {
  const getJson = async <T>(url: string): Promise<T> => {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  }
  const photos: DestinationPhotos = { byCategory: {} }

  // 1. Wikidata: lugares reales con foto + foto de la ciudad.
  let picked: ReturnType<typeof pickWikidataPhotos> = { byCategory: {} }
  const sparqlUrl = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(buildWikidataQuery(query))}`
  // Un reintento: el servicio de consultas de Wikidata a veces tarda en la primera petición.
  let wikidataOk = false
  for (let attempt = 0; attempt < 2 && !wikidataOk; attempt++) {
    try {
      const data = await getJson<{ results: { bindings: WikidataRow[] } }>(sparqlUrl)
      picked = pickWikidataPhotos(data.results.bindings, query.name)
      wikidataOk = true
    } catch {
      // Si tampoco responde la segunda vez, seguimos con Commons.
    }
  }
  if (!wikidataOk) photos.incomplete = true

  const wikidataFiles = [picked.city, ...Object.values(picked.byCategory)].filter(
    (x): x is { file: string; label: string } => Boolean(x),
  )
  if (wikidataFiles.length > 0) {
    try {
      const data = await getJson<{ query?: { pages?: CommonsPage[]; normalized?: { from: string; to: string }[] } }>(
        buildImageInfoUrl(wikidataFiles.map((f) => f.file)),
      )
      const byTitle = new Map((data.query?.pages ?? []).map((p) => [commonsFileName(p.title), p]))
      const photoOf = (entry?: { file: string; label: string }) => {
        const page = entry && byTitle.get(entry.file)
        return page ? toPlacePhoto(page, entry.label) : null
      }
      photos.city = photoOf(picked.city) ?? undefined
      for (const category of CATEGORY_IDS) {
        const photo = photoOf(picked.byCategory[category])
        if (photo) photos.byCategory[category] = photo
      }
    } catch {
      // Sin metadatos no podemos dar crédito: preferimos no mostrar esas fotos.
      photos.incomplete = true
    }
  }

  // 2. Commons: lo que quedó sin foto (una búsqueda por actividad, en serie).
  const usedUrls = new Set([photos.city?.url, ...Object.values(photos.byCategory).map((p) => p?.url)])
  const missing = [...(photos.city ? [] : (['ciudad'] as const)), ...CATEGORY_IDS.filter((c) => !photos.byCategory[c])]
  for (const category of missing) {
    try {
      const data = await getJson<{ query?: { pages?: CommonsPage[] } }>(buildCommonsSearchUrl(query.name, category))
      const pages = (data.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      for (const page of pages) {
        if (!isPhotoOfDestination(page, query)) continue
        if (category === 'ciudad' && COLLAGE.test(page.title)) continue
        const photo = toPlacePhoto(page, category === 'ciudad' ? query.name : undefined)
        if (photo && !usedUrls.has(photo.url)) {
          if (category === 'ciudad') photos.city = photo
          else photos.byCategory[category] = photo
          usedUrls.add(photo.url)
          break
        }
      }
    } catch {
      // Esa actividad usará la foto de la ciudad.
      photos.incomplete = true
    }
  }
  return photos
}
