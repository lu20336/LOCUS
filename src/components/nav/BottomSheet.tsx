import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Hoja que sube desde abajo (menús del celular). Usa <dialog> nativo: foco
 * atrapado, Escape y clic en el fondo para cerrar, y lectores de pantalla la
 * anuncian como diálogo.
 */
export function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
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
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="anim-sheet fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 [&:not([open])]:hidden"
    >
      <div className="safe-bottom p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full border border-line text-ink hover:bg-surface-2">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
