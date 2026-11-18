import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useFavorites, type Favorite } from '../lib/profile/favorites'
import { useToast } from './Toast'

/** Corazón para guardar/quitar un favorito. Sin sesión, lleva a iniciar sesión. Rebota y avisa al guardar. */
export function FavoriteButton({ item, className = '' }: { item: Omit<Favorite, 'key'>; className?: string }) {
  const { isFavorite, toggle, available } = useFavorites()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useI18n()
  const active = isFavorite(item.kind, item.refId)
  const [pop, setPop] = useState(0)

  async function onClick() {
    if (!available) {
      navigate(`/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    try {
      await toggle(item)
      if (!active) {
        setPop((n) => n + 1)
        toast(t('fav.toast.saved'), { action: { label: t('fav.toast.view'), to: '/favoritos' } })
      }
    } catch {
      toast(t('fav.toast.error'), { tone: 'error' })
    }
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t('fav.remove', { title: item.title }) : t('fav.add', { title: item.title })}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void onClick()
      }}
      className={`z-10 grid size-9 place-items-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition hover:scale-110 active:scale-95 ${className}`}
    >
      <svg
        key={pop}
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-5 ${active ? 'text-coral' : 'text-ink'} ${pop > 0 && active ? 'anim-pop' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.3 8.6 3.2 5 6.6 5c2 0 3.6 1.1 5.4 3.3C13.8 6.1 15.4 5 17.4 5c3.4 0 5.3 3.6 4.1 6.8C19.5 16.4 12 21 12 21Z" />
      </svg>
    </button>
  )
}
