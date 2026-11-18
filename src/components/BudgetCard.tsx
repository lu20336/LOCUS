/**
 * "¿Te alcanza?" del Paso 3: costo estimado del viaje frente al presupuesto,
 * por rubro, con ideas para ajustarlo si no alcanza. Se recalcula al quitar
 * o cambiar paradas. Los precios son promedios (ver lib/flow/tripBudget.ts).
 */
import { CircleCheck, TriangleAlert, Wallet } from 'lucide-react'
import { formatCOP } from '../lib/format'
import { COST_LEVEL_LABELS, type TripBudget } from '../lib/flow/tripBudget'

const STATUS = {
  holgado: { title: 'Te alcanza', tone: 'text-teal-soft', bar: 'bg-teal', Icon: CircleCheck },
  justo: { title: 'Te alcanza, pero justo', tone: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', Icon: CircleCheck },
  falta: { title: 'No te alcanza', tone: 'text-danger', bar: 'bg-danger', Icon: TriangleAlert },
} as const

export function BudgetCard({ estimate, travelers }: { estimate: TripBudget; travelers: number }) {
  const { status, total, budget, difference, lines, tips, level } = estimate
  const s = STATUS[status]
  // Barra: qué parte del presupuesto se usa (llena y en rojo si se pasa).
  const used = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 100

  return (
    <section aria-labelledby="budget-title" className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="budget-title" className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Wallet aria-hidden="true" className="size-5 text-teal-soft" />
            ¿Te alcanza el presupuesto?
          </h3>
          <p className={`mt-1 flex items-center gap-1.5 font-semibold ${s.tone}`}>
            <s.Icon aria-hidden="true" className="size-4" />
            {s.title}
            {status === 'falta' ? ` · faltan unos ${formatCOP(-difference)}` : ` · te sobran unos ${formatCOP(difference)}`}
          </p>
        </div>
        <dl className="text-right text-sm">
          <dt className="text-muted">Costo estimado</dt>
          <dd className="text-xl font-semibold text-navy">{formatCOP(total)}</dd>
          <dd className="text-muted">
            de {formatCOP(budget)}
            {travelers > 1 && <> · {formatCOP(Math.round(total / travelers / 1000) * 1000)} por persona</>}
          </dd>
        </dl>
      </div>

      <div
        role="meter"
        aria-label="Parte del presupuesto que usa el viaje"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${used}%` }} />
      </div>

      <ul className="mt-4 divide-y divide-line">
        {lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="min-w-0">
              <span className="block font-medium text-ink">{line.label}</span>
              <span className="block text-xs text-muted">{line.detail}</span>
            </span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">{formatCOP(line.amount)}</span>
          </li>
        ))}
      </ul>

      {tips.length > 0 && (
        <div className="mt-3 rounded-2xl bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">Para que te alcance puedes:</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
            {tips.map((tip) => (
              <li key={tip.text}>
                {tip.text}
                {tip.saves ? <span className="text-muted"> · ahorras unos {formatCOP(tip.saves)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Estimado con precios promedio de un {COST_LEVEL_LABELS[level]} en Colombia. Los precios reales pueden variar según
        la temporada y dónde comas o te hospedes.
      </p>
    </section>
  )
}
