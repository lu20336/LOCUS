/**
 * Barra de navegación inferior (celular y tableta, < lg). Cinco accesos con
 * icono y texto; "Explorar" y "Cuenta" abren una hoja con más opciones.
 * Con sesión: Inicio · Explorar · Mis viajes · Favoritos · Cuenta.
 * Sin sesión: Inicio · Explorar · Comparar · Planes · Ingresar.
 */
import { Compass, LogOut, Scale, ShieldCheck, Sparkles, Store, User, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth/authContext'
import { useFavorites } from '../../lib/profile/favorites'
import { usePlans } from '../../lib/plans/planContext'
import { BottomSheet } from './BottomSheet'
import { ACCOUNT_ITEMS, EXPLORE_ITEMS, HOME_ITEM, SPACE_ITEMS, type NavItem } from './navItems'

const tab = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.7rem] font-semibold transition-colors'

function TabLink({ item, badge }: { item: NavItem; badge?: ReactNode }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `${tab} ${isActive ? 'text-teal-soft' : 'text-muted'}`}>
      {({ isActive }) => (
        <>
          <span aria-hidden="true" className={`absolute top-0 h-0.5 rounded-full bg-teal transition-all duration-300 ${isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
          <span className="relative">
            <item.icon aria-hidden="true" className={`size-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
            {badge}
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function TabButton({ icon: Icon, label, onClick, active, expanded }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean; expanded?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={expanded} className={`${tab} ${active ? 'text-teal-soft' : 'text-muted'}`}>
      <Icon aria-hidden="true" className="size-6" />
      {label}
    </button>
  )
}

function SheetLink({ item }: { item: NavItem }) {
  return (
    <Link to={item.to} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal-soft">
        <item.icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold text-ink">{item.label}</span>
        {item.description && <span className="block text-sm text-muted">{item.description}</span>}
      </span>
    </Link>
  )
}

export function BottomNav() {
  const { user, profile, isAdmin, signOutUser } = useAuth()
  const { favorites } = useFavorites()
  const { planFor } = usePlans()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'explore' | 'account' | null>(null)
  useEffect(() => setSheet(null), [pathname])

  const accountItems: NavItem[] = [
    SPACE_ITEMS[2],
    ...ACCOUNT_ITEMS,
    { to: '/anfitrion', label: profile?.isHost ? 'Modo anfitrión' : 'Publica tu alojamiento', description: 'Recibe viajeros en tu alojamiento', icon: Store },
    ...(isAdmin ? [{ to: '/admin', label: 'Moderación', icon: ShieldCheck }] : []),
  ]

  const exploreActive = ['/explorar', '/experiencias', '/destinos', '/hospedajes'].some((p) => pathname.startsWith(p)) || pathname === '/planear'
  const accountActive = ['/perfil', '/reservas', '/planes', '/anfitrion', '/admin'].some((p) => pathname.startsWith(p))

  return (
    <>
      <nav aria-label="Navegación inferior" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-header backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch">
          <TabLink item={HOME_ITEM} />
          <TabButton icon={Compass} label="Explorar" onClick={() => setSheet('explore')} active={exploreActive} expanded={sheet === 'explore'} />
          {user ? (
            <>
              <TabLink item={SPACE_ITEMS[0]} />
              <TabLink
                item={SPACE_ITEMS[1]}
                badge={favorites.length > 0 ? <span className="absolute -right-2 -top-1 rounded-full bg-coral px-1 text-[0.6rem] font-bold text-on-coral">{favorites.length}</span> : null}
              />
              <TabButton icon={User} label="Cuenta" onClick={() => setSheet('account')} active={accountActive} expanded={sheet === 'account'} />
            </>
          ) : (
            <>
              <TabLink item={{ to: '/comparar', label: 'Comparar', icon: Scale }} />
              <TabLink item={{ to: '/planes', label: 'Planes', icon: Sparkles }} />
              <TabLink item={{ to: '/ingresar', label: 'Ingresar', icon: User }} />
            </>
          )}
        </div>
      </nav>

      <BottomSheet open={sheet === 'explore'} title="Explorar" onClose={() => setSheet(null)}>
        <ul className="flex flex-col">
          {EXPLORE_ITEMS.map((i) => (
            <li key={i.to}><SheetLink item={i} /></li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={sheet === 'account'} title="Tu cuenta" onClose={() => setSheet(null)}>
        {user && (
          <>
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-navy text-lg font-bold text-surface">{(profile?.displayName || user.email || '?').slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{profile?.displayName || 'Tu cuenta'}</span>
                <span className="block truncate text-xs text-muted">{user.email}</span>
              </span>
              <Link to="/planes" className="ml-auto shrink-0 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-xs font-bold text-ink">{planFor('guest').name}</Link>
            </div>
            <ul className="flex flex-col">
              {accountItems.map((i) => (
                <li key={i.to}><SheetLink item={i} /></li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    setSheet(null)
                    navigate('/')
                    await signOutUser()
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><LogOut className="size-5" /></span>
                  <span className="font-semibold text-ink">Cerrar sesión</span>
                </button>
              </li>
            </ul>
          </>
        )}
      </BottomSheet>
    </>
  )
}
