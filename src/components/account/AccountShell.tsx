/**
 * Espacio del viajero (escritorio): barra lateral con perfil, el compañero de IA
 * y los accesos a lo personal (Mis viajes, Favoritos, Reservas, Perfil, Planes),
 * más "Descubre" con destinos para inspirarse. En el celular la barra lateral no
 * se muestra: la navegación inferior cumple esa función.
 */
import { Sparkles, Store } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../lib/auth/authContext'
import { openAgent } from '../../lib/agent/openAgent'
import { FEATURED_DESTINATIONS } from '../../lib/featuredDestinations'
import { usePlans } from '../../lib/plans/planContext'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useFavorites } from '../../lib/profile/favorites'
import { initials } from '../Header'
import { ACCOUNT_ITEMS, SPACE_ITEMS } from '../nav/navItems'
import { EmbeddedContext } from '../ui'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-teal/15 text-ink' : 'text-ink hover:bg-surface-2'}`

function Sidebar() {
  const { t } = useI18n()
  const { user, profile } = useAuth()
  const { planFor } = usePlans()
  const { favorites } = useFavorites()
  const name = profile?.displayName || user?.displayName || ''
  const saved = new Set(favorites.filter((f) => f.kind === 'destination').map((f) => f.refId))
  const ideas = FEATURED_DESTINATIONS.filter((d) => !saved.has(d.id)).slice(0, 3)

  return (
    <aside aria-label={t('nav.yourSpace')} className="hidden lg:block">
      <div className="sticky top-24 flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-navy text-lg font-bold text-surface">{initials(name, user?.email)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{name || user?.email}</p>
            <NavLink to="/planes" className="text-xs font-bold text-teal-soft hover:underline">{planFor('guest').name}</NavLink>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t('nav.companion')}</p>
          <p className="mt-2 font-serif text-lg font-semibold text-navy">{t('nav.askQuestion')}</p>
          <button
            type="button"
            onClick={() => openAgent()}
            className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold text-on-coral shadow-sm transition hover:brightness-105"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {t('nav.askNow')}
          </button>
        </div>

        <nav aria-label={t('nav.mySpace')} className="flex flex-col gap-1">
          {SPACE_ITEMS.map((n) => (
            <NavLink key={n.to} to={n.to} className={itemClass}>
              <n.icon aria-hidden="true" className="size-5 text-teal-soft" />
              {t(n.labelKey)}
              {n.to === '/favoritos' && favorites.length > 0 && <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{favorites.length}</span>}
            </NavLink>
          ))}
          <div className="my-2 border-t border-line" />
          {ACCOUNT_ITEMS.map((n) => (
            <NavLink key={n.to} to={n.to} className={itemClass}>
              <n.icon aria-hidden="true" className="size-5 text-teal-soft" />
              {t(n.labelKey)}
            </NavLink>
          ))}
          <NavLink to="/anfitrion" className={itemClass}>
            <Store aria-hidden="true" className="size-5 text-teal-soft" />
            {profile?.isHost ? t('nav.hostMode') : t('nav.offerStay')}
          </NavLink>
        </nav>

        {ideas.length > 0 && (
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">{t('nav.discover')}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {ideas.map((d) => (
                <li key={d.id}>
                  <NavLink to={`/destinos/${d.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
                    <img src={d.image} alt="" loading="lazy" className="size-9 rounded-lg object-cover" />
                    {d.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  )
}

export function AccountShell() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:py-8">
      <Sidebar />
      <div className="min-w-0">
        <EmbeddedContext.Provider value>
          <Outlet />
        </EmbeddedContext.Provider>
      </div>
    </div>
  )
}
