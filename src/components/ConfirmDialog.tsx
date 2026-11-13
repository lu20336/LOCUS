import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './ui'

/**
 * Diálogo de confirmación basado en <dialog> nativo (foco atrapado, Escape
 * para cerrar). Se usa antes de cualquier acción sensible: reservar, cancelar…
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(32rem,92vw)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-2xl font-semibold text-navy">{title}</h2>
        <div className="mt-3 text-sm">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" className="border border-line" onClick={onCancel} disabled={busy}>Volver</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
