import { Link } from 'react-router'
import { FavoriteButton } from '../components/FavoriteButton'
import { ButtonLink, Container, EmptyState, PageHeader } from '../components/ui'
import { useFavorites, type Favorite } from '../lib/profile/favorites'

const KIND_LABEL: Record<Favorite['kind'], string> = {
  listing: 'Alojamiento',
  experience: 'Experiencia',
  destination: 'Destino',
  place: 'Lugar de referencia',
}

function href(f: Favorite): string | null {
  if (f.kind === 'listing') return `/hospedajes/${f.refId}`
  if (f.kind === 'experience') return `/experiencias/${f.refId}`
  if (f.kind === 'destination') return `/destinos/${f.refId}`
  return f.refId.includes('/') ? `https://www.openstreetmap.org/${f.refId}` : null
}

export default function FavoritesPage() {
  const { favorites } = useFavorites()
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Guardados" title="Tus favoritos">Alojamientos, experiencias y destinos que guardaste para decidir después.</PageHeader>
      {favorites.length === 0 ? (
        <EmptyState title="Todavía no guardas nada" action={<ButtonLink to="/explorar">Explorar hospedajes</ButtonLink>}>
          Toca el corazón en cualquier tarjeta para guardarla aquí.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {favorites.map((f) => {
            const link = href(f)
            const external = link?.startsWith('http')
            return (
              <li key={f.key} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">{KIND_LABEL[f.kind]}</p>
                  <p className="truncate font-semibold text-ink">
                    {link ? external ? <a href={link} target="_blank" rel="noreferrer" className="hover:underline">{f.title}</a> : <Link to={link} className="hover:underline">{f.title}</Link> : f.title}
                  </p>
                  {f.subtitle && <p className="truncate text-sm text-muted">{f.subtitle}</p>}
                </div>
                <FavoriteButton className="border border-line" item={{ kind: f.kind, refId: f.refId, title: f.title, subtitle: f.subtitle }} />
              </li>
            )
          })}
        </ul>
      )}
    </Container>
  )
}
