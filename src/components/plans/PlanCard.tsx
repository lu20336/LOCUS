import { Check } from 'lucide-react'
import { formatCOP } from '../../lib/format'
import { BADGE_LABEL, priceFor, type Interval, type Plan } from '../../lib/plans/plans'

export type PlanAction = 'current' | 'trial' | 'choose' | 'downgrade' | 'login'

const ACTION_LABEL: Record<PlanAction, (plan: Plan) => string> = {
  current: () => 'Tu plan actual',
  trial: (p) => `Probar ${p.trialDays} días gratis`,
  choose: () => 'Elegir este plan',
  downgrade: () => 'Volver a Free',
  login: () => 'Ingresa para elegir',
}

export function PlanCard({
  plan,
  interval,
  action,
  featured,
  onSelect,
}: {
  plan: Plan
  interval: Interval
  action: PlanAction
  featured: boolean
  onSelect: () => void
}) {
  const price = priceFor(plan, interval)
  const free = plan.monthlyCOP === 0
  return (
    <article
      aria-label={plan.name}
      className={`relative flex h-full flex-col rounded-3xl border bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${featured ? 'border-teal ring-2 ring-teal/30' : 'border-line'} ${action === 'current' ? 'bg-teal/5' : ''}`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-navy px-3 py-1 text-xs font-bold text-surface shadow-sm">{BADGE_LABEL[plan.badge]}</span>
      )}
      <h3 className="font-serif text-2xl font-semibold text-navy">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold text-ink">{free ? 'Gratis' : formatCOP(price.perMonthCOP)}</span>
        {!free && <span className="text-sm text-muted">/ mes</span>}
      </p>
      <p className="min-h-5 text-xs text-muted">
        {free
          ? 'Para siempre'
          : interval === 'annual'
            ? `${formatCOP(price.periodCOP)} al año · ahorras ${price.annualSavingsPct} %`
            : 'Cancela cuando quieras'}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-ink">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal-soft" />
            {h}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={action === 'current'}
        className={`mt-6 rounded-xl px-5 py-3 font-bold transition disabled:cursor-default ${
          action === 'current'
            ? 'border border-teal/50 bg-teal/10 text-ink'
            : action === 'downgrade'
              ? 'border border-line text-ink hover:bg-surface-2'
              : featured
                ? 'bg-coral text-on-coral shadow-sm hover:brightness-105'
                : 'border-2 border-teal text-ink hover:bg-teal/10'
        }`}
      >
        {ACTION_LABEL[action](plan)}
      </button>
    </article>
  )
}
