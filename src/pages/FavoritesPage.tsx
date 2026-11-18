/**
 * FAVORITOS: todo lo que el usuario guardó, con foto y precio cuando existen,
 * filtrable por tipo (hospedajes, experiencias, destinos, lugares). Las fotos y
 * precios se leen del catálogo publicado; no se duplican en la base de datos.
 */
import { Compass, Heart, Hotel, MapPin, Ticket } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { FavoriteButton } from '../components/FavoriteButton'
import { ButtonLink, CardGridSkeleton, Container, EmptyState, PageHeader } from '../components/ui'
import { fetchPublished } from '../lib/catalog/repo'
import type { Experience, Listing } from '../lib/domain/types'
import { FEATURED_DESTINATIONS } from '../lib/featuredDestinations'
import { db } from '../lib/firebase/client'
import { formatCOP } from '../lib/format'
import { useFavorites, type Favorite, type FavoriteKind } from '../lib/profile/favorites'
import { useAsync } from '../lib/useAsync'

const KIND_LABEL: Record<FavoriteKind, string> = {
  listing: 'Alojamiento',
  experience: 'Experiencia',
  destination: 'Destino',
  place: 'Lugar de referencia',
}

const FILTERS: { id: 'all' | FavoriteKind; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'listing', label: 'Hospedajes' },
  { id: 'experience', label: 'Experiencias' },
  { id: 'destination', label: 'Destinos' },
  { id: 'place', label: 'Lugares' },
]

function href(f: Favorite): string | null {
  if (f.kind === 'listing') return `/hospedajes/${f.refId}`
  if (f.kind === 'experience') return `/experiencias/${f.refId}`
  if (f.kind === 'destination') return `/destinos/${f.refId}`
  return /^(node|way|relation)\/\d+$/.test(f.refId) ? `https://www.openstreetmap.org/${f.refId}` : null
}

const ICON = { listing: Hotel, experience: Ticket, destination: Compass, place: MapPin } as const

export default function FavoritesPage() {
  const { favorites } = useFavorites()
  const [filter, setFilter] = useState<'all' | FavoriteKind>('all')
  const listings = useAsync(() => fetchPublished<Listing>(db, 'listings'), [])
  const experiences = useAsync(() => fetchPublished<Experience>(db, 'experiences'), [])

  const media = useMemo(() => {
    const map = new Map<string, { cover?: string; price?: string }>()
    for (const l of listings.data ?? []) map.set(`listing:${l.id}`, { cover: l.cover, price: `${formatCOP(l.pricePerNight)} por noche` })
    for (const e of experiences.data ?? []) map.set(`experience:${e.id}`, { cover: e.cover, price: `${formatCOP(e.pricePerPerson)} por persona` })
    for (const d of FEATURED_DESTINATIONS) map.set(`destination:${d.id}`, { cover: d.image })
    return map
  }, [listings.data, experiences.data])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: favorites.length }
    for (const f of favorites) c[f.kind] = (c[f.kind] ?? 0) + 1
    return c
  }, [favorites])
  const visible = filter === 'all' ? favorites : favorites.filter((f) => f.kind === filter)
  const loadingMedia = listings.loading || experiences.loading

  return (
    <Container className="max-w-5xl">
      <PageHeader eyebrow="Tu espacio" title="Favoritos">Hospedajes, experiencias, destinos y lugares que guardaste para decidir después.</PageHeader>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Todavía no guardas nada"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/explorar">Explorar hospedajes</ButtonLink>
              <ButtonLink to="/experiencias" variant="secondary">Ver experiencias</ButtonLink>
            </div>
          }
        >
          Toca el corazón en cualquier tarjeta y quedará aquí, listo para comparar o convertir en un viaje.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar favoritos">
            {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filter === f.id ? 'border-navy bg-navy text-surface' : 'border-line bg-surface text-ink hover:bg-surface-2'}`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 text-xs ${filter === f.id ? 'bg-surface/25' : 'bg-surface-2 text-muted'}`}>{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>

          {loadingMedia && visible.length > 0 && <div className="mb-4"><CardGridSkeleton count={Math.min(visible.length, 3)} label="Cargando tus favoritos" /></div>}
          <ul className="anim-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((f, i) => {
              const link = href(f)
              const external = link?.startsWith('http')
              const m = media.get(`${f.kind}:${f.refId}`)
              const Icon = ICON[f.kind]
              const title = link ? (
                external ? (
                  <a href={link} target="_blank" rel="noreferrer" className="after:absolute after:inset-0 after:z-[1]">{f.title}</a>
                ) : (
                  <Link to={link} className="after:absolute after:inset-0 after:z-[1]">{f.title}</Link>
                )
              ) : (
                f.title
              )
              return (
                <li key={f.key} style={{ '--i': i } as CSSProperties}>
                  <article className="card-photo group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-navy to-teal-soft">
                      {m?.cover ? (
                        <img src={m.cover} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <div aria-hidden="true" className="grid size-full place-items-center text-white/80"><Icon className="size-12" /></div>
                      )}
                      <FavoriteButton className="absolute right-3 top-3" item={{ kind: f.kind, refId: f.refId, title: f.title, subtitle: f.subtitle }} />
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{KIND_LABEL[f.kind]}</p>
                      <h3 className="mt-1 line-clamp-2 font-serif text-lg font-semibold text-navy">{title}</h3>
                      {f.subtitle && <p className="mt-0.5 truncate text-sm text-muted">{f.subtitle}</p>}
                      {m?.price && <p className="mt-2 text-sm font-semibold text-ink">{m.price}</p>}
                      {f.kind === 'destination' && (
                        <Link to={`/?destino=${f.refId}`} className="relative z-10 mt-3 inline-flex rounded-xl bg-coral px-3.5 py-2 text-sm font-bold text-on-coral transition hover:brightness-105">Planear este viaje</Link>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Container>
  )
}
