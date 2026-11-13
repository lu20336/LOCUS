/**
 * Resumen de un lugar desde Wikipedia en español (REST API pública, sin API
 * key, con CORS). El texto es CC BY-SA 4.0: hay que mostrar la atribución y el
 * enlace al artículo. Si el artículo no existe o falla la red, no se muestra nada.
 */
export interface WikiSummary {
  title: string
  extract: string
  url: string
  thumbnail?: string
}

const WIKI_TITLES: Record<string, string> = {
  cartagena: 'Cartagena de Indias',
  medellin: 'Medellín',
  bogota: 'Bogotá',
  'villa-de-leyva': 'Villa de Leyva',
  'san-andres': 'San Andrés (Colombia)',
  salento: 'Salento (Quindío)',
  'santa-marta': 'Santa Marta',
  guatape: 'Guatapé',
}

export const wikiTitleFor = (destinationId: string) => WIKI_TITLES[destinationId] ?? null

export function parseWikiSummary(json: unknown): WikiSummary | null {
  const j = json as { type?: string; title?: string; extract?: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source?: string } }
  if (!j || j.type === 'disambiguation' || !j.extract || !j.title) return null
  const url = j.content_urls?.desktop?.page
  if (!url || !url.startsWith('https://')) return null
  return {
    title: j.title,
    extract: j.extract.slice(0, 900),
    url,
    thumbnail: j.thumbnail?.source?.startsWith('https://') ? j.thumbnail.source : undefined,
  }
}

export async function fetchWikiSummary(title: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<WikiSummary | null> {
  const response = await fetchFn(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  return parseWikiSummary(await response.json())
}
