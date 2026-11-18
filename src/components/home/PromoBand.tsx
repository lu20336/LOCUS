/**
 * Dos invitaciones comerciales (DEMOSTRATIVAS) al final de la portada: LOCUS Plus
 * para viajeros y Anfitriones Fundadores para quien quiere publicar. Los planes y
 * descuentos son de prueba (ver /planes y docs/NEGOCIO.md).
 */
import { Rocket, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { usePlans } from '../../lib/plans/planContext'

export function PromoBand() {
  const { t } = useI18n()
  const { planFor } = usePlans()
  const traveler = planFor('guest')
  return (
    <section aria-label={t('promo.label')} className="grid gap-5 md:grid-cols-2">
      <Link to="/planes" className="group relative overflow-hidden rounded-3xl bg-navy p-7 text-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <Sparkles aria-hidden="true" className="size-8 text-teal" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{t('promo.travelers')}</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">{traveler.monthlyCOP === 0 ? t('promo.tryPlus') : t('promo.yourPlan', { name: traveler.name })}</h3>
        <p className="mt-2 max-w-md opacity-90">{t('promo.travelersText')}</p>
        <span className="mt-4 inline-flex rounded-xl bg-coral px-4 py-2 font-bold text-on-coral transition group-hover:brightness-105">{t('promo.seePlans')}</span>
        <p className="mt-2 text-xs opacity-70">{t('promo.noCharge')}</p>
      </Link>
      <Link to="/anfitrion" className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <Rocket aria-hidden="true" className="size-8 text-teal-soft" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t('promo.hosts')}</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold text-navy sm:text-3xl">{t('promo.hostsTitle')}</h3>
        <p className="mt-2 max-w-md text-muted">{t('promo.hostsText')}</p>
        <span className="mt-4 inline-flex rounded-xl border-2 border-teal px-4 py-2 font-bold text-ink transition group-hover:bg-teal/10">{t('promo.hostsCta')}</span>
      </Link>
    </section>
  )
}
