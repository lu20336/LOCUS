/**
 * Secciones dinámicas de la portada, alimentadas con datos reales: "Para ti"
 * (según el perfil), alojamientos y experiencias recién publicados, y accesos a
 * vuelos, anfitriones y al compañero LOCUS. Si todavía no hay datos propios,
 * NO se rellenan con tarjetas ficticias: se invita a sumarse.
 */
import { Link } from 'react-router'
import { useAuth } from '../lib/auth/authContext'
import { useI18n } from '../lib/i18n/I18nProvider'
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
  const { t } = useI18n()
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
        <Band title={t('home.forYou')} action={<Link to="/perfil" className="text-sm font-semibold underline">{t('home.changePrefs')}</Link>}>
          {hasProfile ? (
            <Recommendations answers={declared} />
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-surface p-6">
              <p className="text-ink">{profile?.onboardingSkipped ? t('home.tellUsSkipped') : t('home.tellUs')}</p>
              <div className="mt-3"><ButtonLink to="/bienvenida?editar=1" variant="secondary">{t('home.takeSurvey')}</ButtonLink></div>
            </div>
          )}
        </Band>
      )}

      <Band title={t('home.knowEach')}>
        <ul className="flex flex-wrap gap-2">
          {FEATURED_DESTINATIONS.map((d) => (
            <li key={d.id}><Link to={`/destinos/${d.id}`} className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">{d.name}</Link></li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">{t('home.knowEachDesc')}</p>
      </Band>

      <Band title={t('home.listings')} action={<Link to="/explorar" className="text-sm font-semibold underline">{t('home.seeAll')}</Link>}>
        {recentListings.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recentListings.map((l) => <li key={l.id}><ListingCard listing={l} /></li>)}</ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-surface p-6">
            <p className="font-semibold text-navy">{t('home.startingTitle')}</p>
            <p className="mt-1 text-muted">{t('home.startingDesc')}</p>
            <div className="mt-4 flex flex-wrap gap-3"><ButtonLink to="/explorar" variant="secondary">{t('home.exploreMap')}</ButtonLink><ButtonLink to="/anfitrion" variant="ghost" className="border border-line">{t('home.publishMine')}</ButtonLink></div>
          </div>
        )}
      </Band>

      {recentExperiences.length > 0 && (
        <Band title={t('home.experiencesTitle')} action={<Link to="/experiencias" className="text-sm font-semibold underline">{t('home.seeAllF')}</Link>}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recentExperiences.map((e) => <li key={e.id}><ExperienceCard experience={e} /></li>)}</ul>
        </Band>
      )}

      <section className="grid gap-5 md:grid-cols-3">
        {[
          { title: t('home.card.compare'), text: t('home.card.compareText'), to: '/comparar', cta: t('home.card.compareCta') },
          { title: t('home.card.trips'), text: t('home.card.tripsText'), to: '/mis-viajes', cta: t('home.card.tripsCta') },
          { title: t('home.card.host'), text: t('home.card.hostText'), to: '/anfitrion', cta: t('home.card.hostCta') },
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
