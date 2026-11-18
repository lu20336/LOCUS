/**
 * Secciones dinámicas de la portada, alimentadas con datos reales: "Para ti"
 * (según el perfil), alojamientos y experiencias recién publicados, y accesos a
 * vuelos, anfitriones y al compañero LOCUS. Si todavía no hay datos propios,
 * NO se rellenan con tarjetas ficticias: se invita a sumarse.
 */
import { Link } from 'react-router'
import { useAuth } from '../lib/auth/authContext'
import { fetchPublished } from '../lib/catalog/repo'
import type { Experience, Listing } from '../lib/domain/types'
import { FEATURED_DESTINATIONS } from '../lib/featuredDestinations'
import { db } from '../lib/firebase/client'
import { loadProfile } from '../lib/profile/profileService'
import { isAnswered } from '../lib/profile/survey'
import { useAsync } from '../lib/useAsync'
import { ExperienceCard, ListingCard } from './ListingCard'
import { Recommendations } from './Recommendations'
import { ButtonLink } from './ui'

function Band({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-3xl font-semibold text-navy sm:text-4xl">{title}</h2>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function HomeDiscovery() {
  const { user, profile } = useAuth()
  const listings = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const experiences = useAsync(() => fetchPublished<Experience>(db, 'experiences'), [])
  const traveler = useAsync(() => (user ? loadProfile(db, user.uid) : Promise.resolve(null)), [user?.uid])

  const recentListings = [...(listings.data ?? [])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 3)
  const recentExperiences = [...(experiences.data ?? [])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 3)
  const declared = traveler.data?.declared ?? {}
  const hasProfile = Object.values(declared).some(isAnswered)

  return (
    <>
      {user && (
        <Band title="Para ti" action={<Link to="/perfil" className="text-sm font-semibold underline">Cambiar mis preferencias</Link>}>
          {hasProfile ? (
            <Recommendations answers={declared} />
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-surface p-6">
              <p className="text-ink">{profile?.onboardingSkipped ? 'Aún no nos cuentas cómo te gusta viajar.' : 'Cuéntanos cómo te gusta viajar y te sugerimos destinos.'}</p>
              <div className="mt-3"><ButtonLink to="/bienvenida?editar=1" variant="secondary">Responder la encuesta (2 min)</ButtonLink></div>
            </div>
          )}
        </Band>
      )}

      <Band title="Conoce cada destino">
        <ul className="flex flex-wrap gap-2">
          {FEATURED_DESTINATIONS.map((d) => (
            <li key={d.id}><Link to={`/destinos/${d.id}`} className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">{d.name}</Link></li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">Cada ficha reúne clima, mapa, lugares para visitar, experiencias y alojamientos cercanos.</p>
      </Band>

      <Band title="Hospedajes en LOCUS" action={<Link to="/explorar" className="text-sm font-semibold underline">Ver todos</Link>}>
        {recentListings.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recentListings.map((l) => <li key={l.id}><ListingCard listing={l} /></li>)}</ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-surface p-6">
            <p className="font-semibold text-navy">LOCUS está empezando y sus anfitriones se están sumando.</p>
            <p className="mt-1 text-muted">Mientras tanto puedes explorar alojamientos de referencia en el mapa, o ser de los primeros en publicar el tuyo.</p>
            <div className="mt-4 flex flex-wrap gap-3"><ButtonLink to="/explorar" variant="secondary">Explorar en el mapa</ButtonLink><ButtonLink to="/anfitrion" variant="ghost" className="border border-line">Publicar mi alojamiento</ButtonLink></div>
          </div>
        )}
      </Band>

      {recentExperiences.length > 0 && (
        <Band title="Experiencias para vivir" action={<Link to="/experiencias" className="text-sm font-semibold underline">Ver todas</Link>}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recentExperiences.map((e) => <li key={e.id}><ExperienceCard experience={e} /></li>)}</ul>
        </Band>
      )}

      <section className="grid gap-5 md:grid-cols-3">
        {[
          { title: 'Comparador', text: 'Hoteles, vuelos y tours de varias plataformas, con tu búsqueda ya lista.', to: '/comparar', cta: 'Comparar ahora' },
          { title: 'Itinerarios', text: 'Un plan día a día con lugares reales y la ruta más corta.', to: '/itinerarios', cta: 'Ver itinerarios' },
          { title: 'Hospeda con LOCUS', text: 'Publica tu casa, finca o experiencia y recibe viajeros de toda Colombia.', to: '/anfitrion', cta: 'Quiero ser anfitrión' },
        ].map((c) => (
          <div key={c.title} className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="font-serif text-2xl font-semibold text-navy">{c.title}</h3>
            <p className="mt-1 text-muted">{c.text}</p>
            <div className="mt-4"><ButtonLink to={c.to} variant="secondary">{c.cta}</ButtonLink></div>
          </div>
        ))}
      </section>
    </>
  )
}
