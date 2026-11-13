import { useNavigate } from 'react-router'
import { useFavorites, type Favorite } from '../lib/profile/favorites'

/** Corazón para guardar/quitar un favorito. Sin sesión, lleva a iniciar sesión. */
export function FavoriteButton({ item, className = '' }: { item: Omit<Favorite, 'key'>; className?: string }) {
  const { isFavorite, toggle, available } = useFavorites()
  const navigate = useNavigate()
  const active = isFavorite(item.kind, item.refId)

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Quitar ${item.title} de favoritos` : `Guardar ${item.title} en favoritos`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!available) navigate(`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`)
        else void toggle(item)
      }}
      className={`z-10 grid size-9 place-items-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition hover:scale-110 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-5 ${active ? 'text-coral' : 'text-ink'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.3 8.6 3.2 5 6.6 5c2 0 3.6 1.1 5.4 3.3C13.8 6.1 15.4 5 17.4 5c3.4 0 5.3 3.6 4.1 6.8C19.5 16.4 12 21 12 21Z" />
      </svg>
    </button>
  )
}
