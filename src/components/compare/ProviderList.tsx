/**
 * Lista de plataformas para comparar. Cada tarjeta dice para qué es buena esa
 * plataforma, cuánto de la búsqueda llega ya puesto y abre su sitio en otra
 * pestaña. Los enlaces con afiliado de LOCUS llevan rel="sponsored" y un aviso.
 */
import { ExternalLink } from 'lucide-react'
import { PREFILL_LABEL, type CompareLink } from '../../lib/compare/providers'
import { Badge } from '../ui'

export function ProviderList({ links, cta = 'Ver en' }: { links: readonly CompareLink[]; cta?: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => (
        <li
          key={l.provider.id}
          className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-teal/60 hover:shadow-md"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-serif text-lg font-semibold text-navy">{l.provider.name}</p>
              {l.provider.tags.slice(0, 2).map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            <p className="mt-1 text-sm text-muted">{l.provider.pitch}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-semibold ${l.prefill === 'none' ? 'text-muted' : 'text-teal-soft'}`}>
              {l.prefill !== 'none' && <span aria-hidden="true">✓ </span>}
              {PREFILL_LABEL[l.prefill]}
            </span>
            <a
              href={l.url}
              target="_blank"
              rel={`noopener noreferrer${l.sponsored ? ' sponsored' : ''}`}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-teal px-3.5 py-2 text-sm font-bold text-ink transition hover:bg-teal/10"
            >
              {cta} {l.provider.name}
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">(se abre en otra pestaña{l.sponsored ? '; enlace de afiliado' : ''})</span>
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
