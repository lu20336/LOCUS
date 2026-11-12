import type { FlowStep } from '../types/flow'

const STEPS: { step: FlowStep; label: string }[] = [
  { step: 1, label: 'Tu viaje' },
  { step: 2, label: 'Actividades' },
  { step: 3, label: 'Itinerario' },
  { step: 4, label: 'Confirmación' },
]

/** Indicador de progreso del flujo de 4 pasos. */
export function Stepper({ current }: { current: FlowStep }) {
  return (
    <nav aria-label="Progreso de tu plan">
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
                <span className="sr-only">Paso {step} de 4: </span>
                <span className="hidden sm:inline">{step}. </span>
                {label}
                {isDone && <span className="sr-only"> (completado)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
