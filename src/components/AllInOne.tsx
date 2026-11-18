/**
 * Propuesta de valor de la portada: "todo tu viaje en un solo lugar".
 * Cuatro accesos al comparador (ya con el tipo elegido) y el recorrido
 * Planea → Compara → Reserva, que explica en 10 segundos qué es LOCUS.
 */
import { Compass, Hotel, Plane, Scale, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useI18n } from '../lib/i18n/I18nProvider'

const TILES: { to: string; icon: LucideIcon; title: string; text: string }[] = [
  { to: '/comparar?tipo=alojamiento', icon: Hotel, title: 'allin.stay', text: 'allin.stayText' },
  { to: '/comparar?tipo=vuelos', icon: Plane, title: 'allin.flights', text: 'allin.flightsText' },
  { to: '/comparar?tipo=experiencias', icon: Ticket, title: 'allin.experiences', text: 'allin.experiencesText' },
  { to: '/comparar?tipo=transporte', icon: ShieldCheck, title: 'allin.transport', text: 'allin.transportText' },
]

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Compass, title: 'allin.step1', text: 'allin.step1Text' },
  { icon: Scale, title: 'allin.step2', text: 'allin.step2Text' },
  { icon: Plane, title: 'allin.step3', text: 'allin.step3Text' },
]

export function AllInOne() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="allinone-title">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-soft">{t('allin.eyebrow')}</p>
        <h2 id="allinone-title" className="mt-2 text-3xl font-semibold text-navy sm:text-5xl">
          {t('allin.title')}
        </h2>
        <p className="mt-3 text-lg text-muted">
          {t('allin.subtitle')}
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <li key={tile.title}>
            <Link
              to={tile.to}
              className="group flex h-full flex-col gap-2 rounded-3xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal/60 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-teal/15 text-teal-soft">
                <tile.icon aria-hidden="true" className="size-6" />
              </span>
              <span className="font-serif text-xl font-semibold text-navy">{t(tile.title)}</span>
              <span className="text-sm text-muted">{t(tile.text)}</span>
              <span className="mt-auto pt-2 text-sm font-bold text-teal-soft group-hover:underline">{t('allin.compareCta')}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-4 rounded-3xl bg-surface-2 p-5">
            <s.icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-teal-soft" />
            <div>
              <p className="font-semibold text-ink">{t(s.title)}</p>
              <p className="mt-1 text-sm text-muted">{t(s.text)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
