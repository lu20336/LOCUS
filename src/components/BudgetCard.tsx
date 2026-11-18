/**
 * "¿Te alcanza?" del Paso 3: costo estimado del viaje frente al presupuesto,
 * por rubro, con ideas para ajustarlo si no alcanza. Se recalcula al quitar
 * o cambiar paradas. Los precios son promedios (ver lib/flow/tripBudget.ts).
 */
import { useState } from 'react'
import { ChevronDown, CircleCheck, Plus, Sparkles, TriangleAlert, Wallet, X } from 'lucide-react'
import { formatCOP } from '../lib/format'
import { COST_LEVEL_LABELS, type SpareOption, type TripBudget } from '../lib/flow/tripBudget'
import type { BudgetExtra } from '../types/itinerary'

const STATUS = {
  holgado: { title: 'Te alcanza', tone: 'text-teal-soft', bar: 'bg-teal', Icon: CircleCheck },
  justo: { title: 'Te alcanza, pero justo', tone: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', Icon: CircleCheck },
  falta: { title: 'No te alcanza', tone: 'text-danger', bar: 'bg-danger', Icon: TriangleAlert },
} as const

export function BudgetCard({
  estimate,
  travelers,
  adjustments = [],
  onFit,
  spare = [],
  onAddSpare,
  extras = [],
  onRemoveExtra,
}: {
  estimate: TripBudget
  travelers: number
  /** Lo que se cambió para que el plan cumpla el presupuesto. */
  adjustments?: string[]
  /** Vuelve a ajustar el plan (cuando un cambio del usuario lo saca del presupuesto). */
  onFit?: () => void
  /** Planes que caben en lo que sobra (spareSuggestions). */
  spare?: SpareOption[]
  onAddSpare?: (option: SpareOption) => void
  /** Planes extra ya agregados, con su botón para quitarlos. */
  extras?: BudgetExtra[]
  onRemoveExtra?: (extra: BudgetExtra) => void
}) {
  const { status, total, budget, difference, lines, tips, level } = estimate
  const [showSpare, setShowSpare] = useState(false)
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

      {extras.length > 0 && onRemoveExtra && (
        <ul aria-label="Planes extra que agregaste" className="mt-1 flex flex-wrap gap-2">
          {extras.map((extra) => (
            <li
              key={extra.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 py-1 pl-3 pr-1 text-sm text-ink"
            >
              {extra.title}
              {extra.dayIndex !== undefined && ` · Día ${extra.dayIndex + 1}`} · {formatCOP(extra.amount)}
              <button
                type="button"
                onClick={() => onRemoveExtra(extra)}
                aria-label={`Quitar ${extra.title}`}
                className="grid size-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adjustments.length > 0 && (
        <div className="mt-3 rounded-2xl border border-teal/40 bg-teal/10 p-4">
          <p className="text-sm font-semibold text-ink">Ajustamos tu plan para que cumpla tu presupuesto:</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
            {adjustments.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}

      {status === 'falta' && onFit && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4">
          <p className="min-w-0 flex-1 text-sm text-ink">
            Con los cambios que hiciste el plan se pasa de tu presupuesto.
          </p>
          <button
            type="button"
            onClick={onFit}
            className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
          >
            Ajustar a mi presupuesto
          </button>
        </div>
      )}

      {status !== 'falta' && spare.length > 0 && onAddSpare && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showSpare}
            aria-controls="spare-plans"
            onClick={() => setShowSpare((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-teal px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-teal/10"
          >
            <Sparkles aria-hidden="true" className="size-4 text-teal-soft" />
            Sugerir planes con lo que me sobra ({formatCOP(difference)})
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showSpare ? 'rotate-180' : ''}`} />
          </button>

          {showSpare && (
            <div id="spare-plans" className="mt-3">
              <p className="text-sm text-muted">
                Todos caben en lo que te sobra. Al agregar uno, la lista se actualiza con lo que queda.
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {spare.map((option) => (
                  <li
                    key={option.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{option.title}</span>
                      <span className="block text-xs text-muted">{option.detail}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">+{formatCOP(option.cost)}</span>
                    <button
                      type="button"
                      onClick={() => onAddSpare(option)}
                      aria-label={`Agregar ${option.title} (${formatCOP(option.cost)})`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Agregar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
