import { Check, Minus } from 'lucide-react'
import { featuresFor, plansFor, type Audience, type FeatureValue } from '../../lib/plans/plans'
import { Badge } from '../ui'

function Cell({ value }: { value: FeatureValue }) {
  if (value === true) return <><Check aria-hidden="true" className="mx-auto size-5 text-teal-soft" /><span className="sr-only">Incluido</span></>
  if (value === false) return <><Minus aria-hidden="true" className="mx-auto size-5 text-muted/60" /><span className="sr-only">No incluido</span></>
  return <span className="text-sm font-semibold text-ink">{value}</span>
}

/** Comparación completa entre planes. Se desplaza en horizontal en pantallas pequeñas, con la primera columna fija. */
export function ComparisonTable({ audience, currentPlanId }: { audience: Audience; currentPlanId: string }) {
  const plans = plansFor(audience)
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">Comparación de planes {audience === 'guest' ? 'para viajeros' : 'para anfitriones'}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sticky left-0 bg-surface p-4 text-sm font-semibold text-muted">Funcionalidad</th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className={`p-4 text-center font-serif text-base font-semibold text-navy ${p.id === currentPlanId ? 'bg-teal/10' : ''}`}>
                {p.name}
                {p.id === currentPlanId && <span className="mt-1 block font-sans text-xs font-bold text-teal-soft">Tu plan</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featuresFor(audience).map((row) => (
            <tr key={row.label} className="border-b border-line last:border-0">
              <th scope="row" className="sticky left-0 bg-surface p-4 text-sm font-medium text-ink">
                {row.label}
                {row.soon && <span className="ml-2 align-middle"><Badge>Próximamente</Badge></span>}
              </th>
              {row.values.map((v, i) => (
                <td key={plans[i].id} className={`p-4 text-center ${plans[i].id === currentPlanId ? 'bg-teal/10' : ''}`}>
                  <Cell value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
