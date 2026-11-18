/**
 * Calendario mensual accesible (cuadrícula de botones). Sirve para elegir
 * fechas (huésped) y para bloquear noches (anfitrión). El estado de cada día
 * lo decide quien lo usa con `cellState`.
 */
import { useState } from 'react'
import { useI18n } from '../lib/i18n/I18nProvider'
import { addDays } from '../lib/domain/dates'

export type CellTone = 'free' | 'booked' | 'blocked' | 'selected' | 'range' | 'past'

export interface CellState {
  tone: CellTone
  disabled?: boolean
  /** Texto accesible extra, ej. "ocupado". */
  hint?: string
}


const tones: Record<CellTone, string> = {
  free: 'bg-surface text-ink hover:bg-teal/15',
  booked: 'bg-danger/15 text-danger line-through',
  blocked: 'bg-surface-2 text-muted line-through',
  selected: 'bg-navy text-surface font-bold',
  range: 'bg-teal/25 text-ink',
  past: 'bg-transparent text-muted/50',
}

export function MonthCalendar({
  today,
  cellState,
  onSelect,
  ariaLabel = 'Calendario',
  focusDate,
}: {
  today: string
  cellState: (iso: string) => CellState
  onSelect: (iso: string) => void
  ariaLabel?: string
  /** Fecha cuyo mes se muestra al abrir (por defecto, hoy). */
  focusDate?: string
}) {
  const { t, meta } = useI18n()
  const MONTHS = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(meta.bcp47, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, m, 1))))
  const WEEKDAYS = Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(meta.bcp47, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d))))
  const start = focusDate && focusDate >= today ? focusDate : today
  const [year, setYear] = useState(Number(start.slice(0, 4)))
  const [month, setMonth] = useState(Number(start.slice(5, 7)) - 1)

  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const offset = first.getUTCDay()
  const isCurrentMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7)) - 1

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1))
    setYear(d.getUTCFullYear())
    setMonth(d.getUTCMonth())
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(`${year}-${String(month + 1).padStart(2, '0')}-01`, i)),
  ]

  return (
    <div role="group" aria-label={ariaLabel} className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={isCurrentMonth} aria-label={t('mc.prev')} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30">‹</button>
        <p className="font-semibold capitalize text-ink" aria-live="polite">{MONTHS[month]} {year}</p>
        <button type="button" onClick={() => shift(1)} aria-label={t('mc.next')} className="grid size-9 place-items-center rounded-full hover:bg-surface-2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />
          const state = cellState(iso)
          const past = iso < today
          const disabled = past || state.disabled
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(iso)}
              aria-label={`${t('mc.dayOfMonth', { day: Number(iso.slice(8)), month: MONTHS[month] })}${state.hint ? `, ${state.hint}` : ''}`}
              aria-pressed={state.tone === 'selected' || state.tone === 'range'}
              className={`aspect-square rounded-lg text-sm transition-colors disabled:cursor-not-allowed ${tones[past ? 'past' : state.tone]}`}
            >
              {Number(iso.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
