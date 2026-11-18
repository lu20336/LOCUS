import { Check, Globe } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n/I18nProvider'
import { LOCALES, LOCALE_META } from '../lib/i18n/locales'
import { useDismiss } from './nav/useDismiss'

/**
 * Selector de idioma: botón con la bandera y el código del idioma activo; el menú
 * lista los cinco idiomas con su nombre propio. El cambio es inmediato y no recarga la página.
 * `inline` muestra los idiomas como una lista dentro de otro menú (hoja del celular).
 */
export function LanguageSelector({ inline = false }: { inline?: boolean }) {
  const { locale, t, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open && !inline, close)

  const choose = (next: (typeof LOCALES)[number]) => {
    setOpen(false)
    if (next === locale) return
    setLocale(next)
    setAnnounce(LOCALE_META[next].nativeName)
  }

  const options = LOCALES.map((l) => (
    <li key={l} role="none">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={l === locale}
        lang={l}
        onClick={() => choose(l)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-surface-2 ${l === locale ? 'bg-teal/10 text-ink' : 'text-ink'}`}
      >
        <span aria-hidden="true" className="text-lg leading-none">{LOCALE_META[l].flag}</span>
        <span className="flex-1">{LOCALE_META[l].nativeName}</span>
        {l === locale && <Check aria-hidden="true" className="size-4 text-teal-soft" />}
      </button>
    </li>
  ))

  if (inline) {
    return (
      <div>
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{t('lang.label')}</p>
        <ul role="menu" aria-label={t('lang.choose')} className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">{options}</ul>
        <span role="status" className="sr-only">{announce && t('lang.changed', { name: announce })}</span>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t('lang.choose')} (${t('lang.current', { name: LOCALE_META[locale].nativeName })})`}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Globe aria-hidden="true" className="size-4 text-teal-soft" />
        <span aria-hidden="true" className="uppercase">{locale}</span>
      </button>
      {open && (
        <ul role="menu" aria-label={t('lang.choose')} className="anim-menu absolute right-0 top-12 z-40 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
          {options}
        </ul>
      )}
      <span role="status" className="sr-only">{announce && t('lang.changed', { name: announce })}</span>
    </div>
  )
}
