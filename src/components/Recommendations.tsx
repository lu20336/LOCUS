import { Link } from 'react-router'
import { useI18n } from '../lib/i18n/I18nProvider'
import { recommendDestinations } from '../lib/profile/recommend'
import type { Answers } from '../lib/profile/survey'
import { CLIMATES } from '../lib/itinerary/suggestDestination'
import { climateOf } from '../lib/featuredDestinations'
import { FavoriteButton } from './FavoriteButton'
import { Badge } from './ui'

/** Destinos sugeridos según el perfil, cada uno con el porqué. Basado en reglas (sin IA). */
export function Recommendations({ answers, limit = 3 }: { answers: Answers; limit?: number }) {
  const { t } = useI18n()
  const list = recommendDestinations(answers, limit)
  if (list.length === 0) {
    return <p className="text-muted">{t('rec.empty')}</p>
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map(({ destination: d, reasons }) => (
        <li key={d.id} className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:shadow-lg">
          <div className="relative aspect-[4/3]">
            <img src={d.image} alt="" loading="lazy" style={{ objectPosition: d.imagePosition }} className="size-full object-cover" />
            <FavoriteButton className="absolute right-3 top-3" item={{ kind: 'destination', refId: d.id, title: d.name, subtitle: d.tagline }} />
            <span className="absolute left-3 top-3"><Badge>{t('rec.climate', { climate: CLIMATES[climateOf(d)].label.toLowerCase() })}</Badge></span>
          </div>
          <div className="p-4">
            <h3 className="font-serif text-xl font-semibold text-navy"><Link to={`/destinos/${d.id}`} className="after:absolute after:inset-0">{d.name}</Link></h3>
            <p className="text-sm text-muted">{d.tagline}</p>
            <p className="mt-2 text-sm text-ink">{t('rec.because', { reasons: reasons.slice(0, 2).join(t('rec.and')) })}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
