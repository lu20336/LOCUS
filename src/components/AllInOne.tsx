/**
 * Propuesta de valor de la portada: "todo tu viaje en un solo lugar".
 * Cuatro accesos al comparador (ya con el tipo elegido) y el recorrido
 * Planea → Compara → Reserva, que explica en 10 segundos qué es LOCUS.
 */
import { Compass, Hotel, Plane, Scale, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

const TILES: { to: string; icon: LucideIcon; title: string; text: string }[] = [
  { to: '/comparar?tipo=alojamiento', icon: Hotel, title: 'Hospedaje', text: 'Booking, Airbnb, Expedia, Vrbo y más, junto a los anfitriones de LOCUS.' },
  { to: '/comparar?tipo=vuelos', icon: Plane, title: 'Vuelos', text: 'Google Vuelos, Skyscanner, KAYAK y las aerolíneas, con tu ruta lista.' },
  { to: '/comparar?tipo=experiencias', icon: Ticket, title: 'Experiencias', text: 'Tours y actividades de varios marketplaces en un solo lugar.' },
  { to: '/comparar?tipo=transporte', icon: ShieldCheck, title: 'Transporte y seguro', text: 'Buses, alquiler de carro y seguro de viaje.' },
]

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Compass, title: '1 · Planea', text: 'Cuéntanos a dónde vas y qué te gusta. Armamos tu itinerario día a día con lugares reales.' },
  { icon: Scale, title: '2 · Compara', text: 'Ves en un solo lugar dónde reservar, con tu búsqueda ya puesta y una libreta para decidir con números.' },
  { icon: Plane, title: '3 · Reserva y viaja', text: 'Reservas directo en LOCUS o en la plataforma que elijas. Sin pestañas perdidas ni datos repetidos.' },
]

export function AllInOne() {
  return (
    <section aria-labelledby="allinone-title">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-soft">Un solo lugar para viajar</p>
        <h2 id="allinone-title" className="mt-2 text-3xl font-semibold text-navy sm:text-5xl">
          Deja de abrir 20 pestañas para planear un viaje
        </h2>
        <p className="mt-3 text-lg text-muted">
          LOCUS junta lo que ofrecen los anfitriones locales y las plataformas más grandes para que planees, compares y reserves sin saltar de sitio en sitio.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <li key={t.title}>
            <Link
              to={t.to}
              className="group flex h-full flex-col gap-2 rounded-3xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal/60 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-teal/15 text-teal-soft">
                <t.icon aria-hidden="true" className="size-6" />
              </span>
              <span className="font-serif text-xl font-semibold text-navy">{t.title}</span>
              <span className="text-sm text-muted">{t.text}</span>
              <span className="mt-auto pt-2 text-sm font-bold text-teal-soft group-hover:underline">Comparar →</span>
            </Link>
          </li>
        ))}
      </ul>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-4 rounded-3xl bg-surface-2 p-5">
            <s.icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-teal-soft" />
            <div>
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
