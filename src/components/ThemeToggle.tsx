import { useState } from 'react'

type Theme = 'light' | 'dark'

/** Misma clave que usa la landing, para que el tema elegido se comparta. */
const STORAGE_KEY = 'locus-theme'

const currentTheme = (): Theme =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'

/**
 * Botón para alternar modo claro/oscuro. El tema inicial lo aplica un script en
 * index.html (antes de pintar, para evitar parpadeos); aquí solo lo cambiamos
 * y lo guardamos en localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Navegación privada o almacenamiento bloqueado: el tema funciona igual, solo no se recuerda.
    }
    setTheme(next)
  }

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-surface-2"
    >
      {isDark ? (
        // Sol
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Luna
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
