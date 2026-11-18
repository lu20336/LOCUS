/**
 * Libreta de precios: el usuario anota el total que ve en cada plataforma y
 * LOCUS dice cuál conviene y cuánto se ahorra. Lo anotado se recuerda en el
 * navegador (localStorage) para esa misma búsqueda. Las cotizaciones de LOCUS
 * (precio verificado) entran solas.
 */
import { Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { summarizeQuotes } from '../../lib/compare/priceNotebook'
import type { PriceQuote } from '../../lib/compare/providers'
import { formatCOP, parseBudget } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { inputClassName } from '../FormField'
import { Badge } from '../ui'

export interface NotebookRow {
  providerId: string
  label: string
}

function readSaved(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function PriceNotebook({
  storageKey,
  rows,
  fixedQuotes = [],
  unit,
}: {
  storageKey: string
  rows: readonly NotebookRow[]
  /** Precios ya verificados (ej. LOCUS): se muestran sin poder editarse. */
  fixedQuotes?: readonly PriceQuote[]
  unit?: string
}) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<Record<string, string>>(() => readSaved(storageKey))
  // Si cambia la búsqueda, se cargan las notas de la nueva.
  const [loadedKey, setLoadedKey] = useState(storageKey)
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey)
    setEntries(readSaved(storageKey))
  }

  function update(providerId: string, value: string) {
    const next = { ...entries, [providerId]: value }
    setEntries(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Sin almacenamiento (modo privado): solo se pierde la memoria.
    }
  }

  const quotes: PriceQuote[] = useMemo(
    () => [
      ...fixedQuotes,
      ...rows.flatMap((r) => {
        const total = parseBudget(entries[r.providerId] ?? '')
        return total ? [{ providerId: r.providerId, label: r.label, totalCOP: total, source: 'user' as const }] : []
      }),
    ],
    [entries, rows, fixedQuotes],
  )
  const summary = summarizeQuotes(quotes)
  const byId = new Map(summary.ranked.map((r) => [r.providerId, r]))
  // "Más barata" solo tiene sentido al comparar al menos dos precios.
  const bestId = summary.ranked.length > 1 ? summary.best?.providerId : undefined

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {t('compare.note.before')} <strong className="text-ink">{unit}</strong> {t('compare.note.after')}
      </p>

      <ul className="flex flex-col gap-2">
        {fixedQuotes.map((q) => {
          const r = byId.get(q.providerId)
          return (
            <li key={q.providerId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal/50 bg-teal/10 p-3">
              <span className="font-semibold text-ink">
                {q.label} {q.source === 'locus' ? <Badge tone="teal">{t('compare.note.verified')}</Badge> : <Badge tone="warn">{t('compare.note.reference')}</Badge>}
              </span>
              <span className="flex items-center gap-2 text-ink">
                <strong>{formatCOP(q.totalCOP)}</strong>
                {bestId === q.providerId && <BestTag />}
                {r && r.extraCOP > 0 && <ExtraTag cop={r.extraCOP} pct={r.extraPct} />}
              </span>
            </li>
          )
        })}
        {rows.map((row) => {
          const r = byId.get(row.providerId)
          const id = `pn-${row.providerId}`
          const isBest = bestId === row.providerId
          return (
            <li
              key={row.providerId}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 ${isBest ? 'border-teal bg-teal/10' : 'border-line bg-surface'}`}
            >
              <label htmlFor={id} className="font-semibold text-ink">
                {row.label}
              </label>
              <span className="flex items-center gap-2">
                {isBest && <BestTag />}
                {r && r.extraCOP > 0 && <ExtraTag cop={r.extraCOP} pct={r.extraPct} />}
                <span className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    $
                  </span>
                  <input
                    id={id}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={entries[row.providerId] ?? ''}
                    onChange={(e) => update(row.providerId, e.target.value)}
                    className={`${inputClassName} w-40 pl-7 text-right`}
                  />
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div aria-live="polite" className="min-h-6 text-sm">
        {summary.best && summary.ranked.length > 1 ? (
          <p className="rounded-2xl bg-surface-2 p-3 text-ink">
            <strong>{summary.best.label}</strong> {t('compare.note.summaryA')}{' '}
            <strong className="text-teal-soft">{formatCOP(summary.savingsCOP)}</strong>.
          </p>
        ) : (
          <p className="text-muted">{t('compare.note.needTwo')}</p>
        )}
      </div>
    </div>
  )
}

function BestTag() {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-xs font-bold text-on-coral">
      <Trophy aria-hidden="true" className="size-3.5" /> {t('compare.note.cheapest')}
    </span>
  )
}

function ExtraTag({ cop, pct }: { cop: number; pct: number }) {
  const { t } = useI18n()
  return (
    <span className="text-xs font-semibold text-muted">
      {t('compare.note.more', { amount: formatCOP(cop), pct })}
    </span>
  )
}
