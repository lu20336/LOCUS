/**
 * Fotos de calle cercanas con Mapillary (imágenes de colaboradores, NO un
 * catálogo turístico profesional: la cobertura en Colombia es irregular y la
 * calidad varía). Requiere un token de CLIENTE gratuito en VITE_MAPILLARY_TOKEN;
 * sin token no se muestra nada. Endpoint: graph.mapillary.com/images
 * (lat, lng, radius ≤ 50 m, limit ≤ 100).
 */
import { useAsync } from '../lib/useAsync'
import { useI18n } from '../lib/i18n/I18nProvider'

const TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined

interface StreetImage {
  id: string
  thumb_1024_url: string
}

async function fetchImages(lat: number, lon: number): Promise<StreetImage[]> {
  const params = new URLSearchParams({
    access_token: TOKEN!,
    fields: 'id,thumb_1024_url',
    lat: lat.toFixed(6),
    lng: lon.toFixed(6),
    radius: '50',
    limit: '6',
  })
  const response = await fetch(`https://graph.mapillary.com/images?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('mapillary')
  const json = (await response.json()) as { data?: StreetImage[] }
  return (json.data ?? []).filter((i) => i.thumb_1024_url?.startsWith('https://'))
}

export function StreetPhotos({ lat, lon }: { lat: number; lon: number }) {
  const { t } = useI18n()
  const { data } = useAsync(() => (TOKEN ? fetchImages(lat, lon) : Promise.resolve([])), [lat, lon])
  if (!TOKEN || !data || data.length === 0) return null
  return (
    <section aria-labelledby="street-title" className="rounded-3xl border border-line bg-surface p-5">
      <h2 id="street-title" className="text-xl font-semibold text-navy">{t('sp.title')}</h2>
      <p className="mt-1 text-sm text-muted">Fotos de calle aportadas por la comunidad de Mapillary cerca de este punto.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((img) => (
          <li key={img.id}>
            <a href={`https://www.mapillary.com/app/?pKey=${img.id}`} target="_blank" rel="noreferrer">
              <img src={img.thumb_1024_url} alt="Foto de calle cercana" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{t('sp.credit')}</p>
    </section>
  )
}
