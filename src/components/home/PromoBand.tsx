/**
 * Dos invitaciones comerciales (DEMOSTRATIVAS) al final de la portada: LOCUS Plus
 * para viajeros y Anfitriones Fundadores para quien quiere publicar. Los planes y
 * descuentos son de prueba (ver /planes y docs/NEGOCIO.md).
 */
import { Rocket, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { usePlans } from '../../lib/plans/planContext'

export function PromoBand() {
  const { planFor } = usePlans()
  const traveler = planFor('guest')
  return (
    <section aria-label="Planes y promociones" className="grid gap-5 md:grid-cols-2">
      <Link to="/planes" className="group relative overflow-hidden rounded-3xl bg-navy p-7 text-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <Sparkles aria-hidden="true" className="size-8 text-teal" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Para viajeros</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">{traveler.monthlyCOP === 0 ? 'Prueba LOCUS Plus 14 días gratis' : `Tu plan: ${traveler.name}`}</h3>
        <p className="mt-2 max-w-md opacity-90">Más itinerarios, recomendaciones más personalizadas y más mensajes con tu compañero de IA. Promoción de lanzamiento: 30 % menos.</p>
        <span className="mt-4 inline-flex rounded-xl bg-coral px-4 py-2 font-bold text-on-coral transition group-hover:brightness-105">Ver planes</span>
        <p className="mt-2 text-xs opacity-70">Demostración: no se cobra nada.</p>
      </Link>
      <Link to="/anfitrion" className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <Rocket aria-hidden="true" className="size-8 text-teal-soft" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Para anfitriones</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold text-navy sm:text-3xl">Publica tu alojamiento o experiencia</h3>
        <p className="mt-2 max-w-md text-muted">Recibe viajeros de toda Colombia. Los primeros anfitriones tendrán Host Pro gratis durante 3 meses.</p>
        <span className="mt-4 inline-flex rounded-xl border-2 border-teal px-4 py-2 font-bold text-ink transition group-hover:bg-teal/10">Quiero ser anfitrión</span>
      </Link>
    </section>
  )
}
