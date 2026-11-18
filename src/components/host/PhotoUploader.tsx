/**
 * Gestor de fotos del anfitrión: subir varias, reordenar, elegir la principal
 * (la primera), reemplazar y eliminar, con vista previa. Valida formato y
 * tamaño y comprime en el navegador (ver lib/images/compress.ts).
 */
import { useId, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { ImageError, preparePhoto } from '../../lib/images/compress'
import { Alert, Button } from '../ui'

export interface EditablePhoto {
  key: string
  dataUrl: string
  /** Miniatura; si falta, se regenera al guardar si la foto es la principal. */
  thumb?: string
  alt: string
}

const MAX_PHOTOS = 20

export function PhotoUploader({ photos, onChange, minRecommended = 3 }: { photos: EditablePhoto[]; onChange: (photos: EditablePhoto[]) => void; minRecommended?: number }) {
  const { t } = useI18n()
  const inputId = useId()
  const replaceRef = useRef<HTMLInputElement | null>(null)
  const replaceIndex = useRef<number>(-1)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function addFiles(files: FileList | null, replaceAt = -1) {
    if (!files || files.length === 0) return
    setBusy(true)
    const problems: string[] = []
    let next = [...photos]
    for (const file of Array.from(files)) {
      if (replaceAt < 0 && next.length >= MAX_PHOTOS) {
        problems.push(t('pu.max', { max: MAX_PHOTOS }))
        break
      }
      try {
        const prepared = await preparePhoto(file)
        const item: EditablePhoto = { key: crypto.randomUUID(), dataUrl: prepared.dataUrl, thumb: prepared.thumb, alt: '' }
        if (replaceAt >= 0) next[replaceAt] = { ...item, alt: next[replaceAt].alt }
        else next = [...next, item]
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof ImageError ? e.message : 'no se pudo procesar.'}`)
      }
    }
    onChange(next)
    setErrors(problems)
    setBusy(false)
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return
    const next = [...photos]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-teal px-5 py-3 font-semibold text-ink hover:bg-teal/10">
          {busy ? t('pu.processing') : t('pu.upload')}
        </label>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
        <span className="text-sm text-muted">{t('pu.hint', { count: photos.length, max: MAX_PHOTOS })}</span>
      </div>
      <input ref={replaceRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-hidden="true" tabIndex={-1} onChange={(e) => { void addFiles(e.target.files, replaceIndex.current); e.target.value = '' }} />

      {errors.length > 0 && <div className="mt-3 flex flex-col gap-1">{errors.map((m) => <Alert key={m}>{m}</Alert>)}</div>}
      {photos.length < minRecommended && <p className="mt-2 text-sm text-muted">{t('pu.recommend', { min: minRecommended })}</p>}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.key} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="relative">
                <img src={p.dataUrl} alt={p.alt || t('lp.viewPhoto', { n: i + 1 })} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-surface">{t('pu.main')}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1 p-2">
                <button type="button" aria-label={t('pu.moveBefore', { n: i + 1 })} disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">←</button>
                <button type="button" aria-label={t('pu.moveAfter', { n: i + 1 })} disabled={i === photos.length - 1} onClick={() => move(i, i + 1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40">→</button>
                {i !== 0 && <button type="button" onClick={() => move(i, 0)} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold">{t('pu.makeMain')}</button>}
                <button type="button" onClick={() => { replaceIndex.current = i; replaceRef.current?.click() }} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold">{t('pu.replace')}</button>
                <button type="button" aria-label={t('pu.delete', { n: i + 1 })} onClick={() => onChange(photos.filter((_, j) => j !== i))} className="ml-auto grid size-8 place-items-center rounded-lg border border-danger/40 text-danger">✕</button>
              </div>
              <label className="block px-2 pb-2 text-xs text-muted">
                {t('pu.altText')}
                <input value={p.alt} maxLength={200} onChange={(e) => onChange(photos.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink" />
              </label>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && <Button variant="ghost" className="mt-3 border border-line" onClick={() => onChange([])}>{t('pu.removeAll')}</Button>}
    </div>
  )
}
