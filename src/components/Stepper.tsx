import { useI18n } from '../lib/i18n/I18nProvider'
import type { FlowStep } from '../types/flow'

const STEPS: { step: FlowStep; label: string }[] = [
  { step: 1, label: 'stepper.step1' },
  { step: 2, label: 'stepper.step2' },
  { step: 3, label: 'stepper.step3' },
  { step: 4, label: 'stepper.step4' },
]

/** Indicador de progreso del flujo de 4 pasos. */
export function Stepper({ current }: { current: FlowStep }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('stepper.label')}>
      <ol className="flex items-center gap-2">
        {STEPS.map(({ step, label }) => {
          const isCurrent = step === current
          const isDone = step < current
          return (
            <li key={step} className="flex flex-1 flex-col gap-1.5" aria-current={isCurrent ? 'step' : undefined}>
              <span
                className={`h-1.5 rounded-full ${isDone || isCurrent ? 'bg-teal' : 'bg-line'}`}
                aria-hidden="true"
              />
              <span className={`text-xs ${isCurrent ? 'font-semibold text-ink' : 'text-muted'}`}>
                <span className="sr-only">{t('stepper.stepOf', { step })}</span>
                <span className="hidden sm:inline">{step}. </span>
                {t(label)}
                {isDone && <span className="sr-only">{t('stepper.done')}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
