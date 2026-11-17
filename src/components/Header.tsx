import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth/authContext'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/explorar', label: 'Hospedajes' },
  { to: '/experiencias', label: 'Experiencias' },
  { to: '/vuelos', label: 'Vuelos' },
  { to: '/itinerarios', label: 'Itinerarios' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-2 ${isActive ? 'text-teal-soft' : 'text-ink'}`

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || '?').trim()
  return source.slice(0, 1).toUpperCase()
}

function UserMenu() {
  const { user, profile, isAdmin, signOutUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) {
    return (
      <Link
        to="/ingresar"
        className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        Ingresar
      </Link>
    )
  }

  const item = 'block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-2'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de tu cuenta"
        className="grid size-10 place-items-center rounded-full bg-navy text-sm font-bold text-surface"
      >
        {initials(profile?.displayName || user.displayName, user.email)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <Link role="menuitem" className={item} to="/reservas">Mis reservas</Link>
          <Link role="menuitem" className={item} to="/favoritos">Favoritos</Link>
          <Link role="menuitem" className={item} to="/itinerarios">Mis itinerarios</Link>
          <Link role="menuitem" className={item} to="/perfil">Mi perfil y preferencias</Link>
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" className={item} to="/anfitrion">
            {profile?.isHost ? 'Modo anfitrión' : 'Publica tu alojamiento'}
          </Link>
          {isAdmin && <Link role="menuitem" className={item} to="/admin">Moderación</Link>}
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={async () => {
              await signOutUser()
              navigate('/')
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-header backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="font-serif text-2xl font-semibold text-navy" aria-label="Locus, ir al inicio">
          Locus<span className="text-teal" aria-hidden="true">.</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkClass}>{n.label}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label="Abrir menú"
            className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={mobileOpen ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Principal (móvil)" className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className={({ isActive }) => `block rounded-lg px-3 py-3 font-semibold ${isActive ? 'text-teal-soft' : 'text-ink'}`}>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
