import { ChevronDown, LogOut, ShieldCheck, Store } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth/authContext'
import { usePlans } from '../lib/plans/planContext'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useFavorites } from '../lib/profile/favorites'
import { LanguageSelector } from './LanguageSelector'
import { ACCOUNT_ITEMS, EXPLORE_ITEMS, SPACE_ITEMS } from './nav/navItems'
import { useDismiss } from './nav/useDismiss'
import { ThemeToggle } from './ThemeToggle'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-2 ${isActive ? 'text-teal-soft after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-teal' : 'text-ink'}`

export function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || '?').trim()
  return source.slice(0, 1).toUpperCase()
}

/** "Explorar ▾": descubrir hospedajes, experiencias, comparador y planificador. */
function ExploreMenu() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const { pathname } = useLocation()
  const close = useCallback(() => setOpen(false), [])
  useEffect(close, [pathname, close])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        {t('nav.explore')}
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="anim-menu absolute left-0 top-12 z-30 w-80 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          {EXPLORE_ITEMS.map((item) => (
            <Link key={item.to} role="menuitem" to={item.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal-soft">
                <item.icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{t(item.labelKey)}</span>
                <span className="block text-xs text-muted">{item.descKey && t(item.descKey)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Menú de la cuenta: atajos a lo personal, perfil, planes y modo anfitrión. */
function AccountMenu() {
  const { t } = useI18n()
  const { user, profile, isAdmin, signOutUser } = useAuth()
  const { planFor } = usePlans()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  useEffect(close, [pathname, close])
  useDismiss(ref, open, close)

  if (!user) {
    return (
      <Link to="/ingresar" className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-surface transition hover:brightness-110">
        {t('nav.signIn')}
      </Link>
    )
  }

  const name = profile?.displayName || user.displayName || ''
  const plan = planFor('guest')
  const item = 'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('nav.accountMenu')}
        className="grid size-10 place-items-center rounded-full bg-navy text-sm font-bold text-surface ring-2 ring-transparent transition hover:ring-teal/50"
      >
        {initials(name, user.email)}
      </button>
      {open && (
        <div role="menu" className="anim-menu absolute right-0 top-12 z-30 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-ink">{name || t('nav.yourAccount')}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <Link to="/planes" role="menuitem" className="mt-2 inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-xs font-bold text-ink">
              {plan.name}
            </Link>
          </div>
          <div className="my-1 border-t border-line" />
          {[...SPACE_ITEMS, ...ACCOUNT_ITEMS].map((n) => (
            <Link key={n.to} role="menuitem" to={n.to} className={item}>
              <n.icon aria-hidden="true" className="size-4 text-teal-soft" />
              {t(n.labelKey)}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" className={item} to="/anfitrion">
            <Store aria-hidden="true" className="size-4 text-teal-soft" />
            {profile?.isHost ? t('nav.hostMode') : t('nav.publishStay')}
          </Link>
          {isAdmin && (
            <Link role="menuitem" className={item} to="/admin">
              <ShieldCheck aria-hidden="true" className="size-4 text-teal-soft" />
              {t('nav.moderation')}
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            type="button"
            className={`${item} w-full text-left`}
            onClick={async () => {
              navigate('/')
              await signOutUser()
            }}
          >
            <LogOut aria-hidden="true" className="size-4 text-muted" />
            {t('nav.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { t } = useI18n()
  const { user, profile } = useAuth()
  const { favorites } = useFavorites()

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-header backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-serif text-2xl font-semibold text-navy" aria-label={t('nav.logoLabel')}>
            Locus<span className="text-teal" aria-hidden="true">.</span>
          </Link>

          <nav aria-label={t('nav.main')} className="hidden items-center gap-1 lg:flex">
            <ExploreMenu />
            <NavLink to="/comparar" className={linkClass}>{t('nav.compare')}</NavLink>
            {user ? (
              <>
                <span aria-hidden="true" className="mx-2 h-5 w-px bg-line" />
                {SPACE_ITEMS.map((n) => (
                  <NavLink key={n.to} to={n.to} className={linkClass}>
                    {t(n.labelKey)}
                    {n.to === '/favoritos' && favorites.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 text-[0.65rem] font-bold text-on-coral">{favorites.length}</span>
                    )}
                  </NavLink>
                ))}
              </>
            ) : (
              <NavLink to="/planes" className={linkClass}>{t('nav.plans')}</NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/anfitrion" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 lg:block">
            {profile?.isHost ? t('nav.hostMode') : t('nav.offer')}
          </Link>
          <LanguageSelector />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
