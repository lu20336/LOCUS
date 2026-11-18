/**
 * Esfera animada que representa al asistente. Su aspecto cambia con el estado
 * (esperando, escuchando, pensando, hablando, silenciado, error) y late con el
 * nivel de audio. Es un botón: tocarla activa el micrófono, silencia o interrumpe.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted' | 'error' | 'unsupported'

export function VoiceOrb({
  state,
  levelRef,
  label,
  onClick,
  size = '12rem',
}: {
  state: OrbState
  levelRef: MutableRefObject<number>
  /** Texto accesible: qué hace tocar la esfera ahora. */
  label: string
  onClick: () => void
  size?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Nivel de audio → variable CSS, sin pasar por React (60 fps sin re-renderizar).
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let smooth = 0
    const tick = () => {
      smooth += (levelRef.current - smooth) * 0.25
      el.style.setProperty('--lvl', smooth.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [levelRef])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full focus-visible:outline-offset-8"
      disabled={state === 'unsupported'}
    >
      <div ref={ref} className="orb" data-state={state} style={{ ['--orb-size' as string]: size }}>
        <span aria-hidden="true" className="orb-glow" />
        <span aria-hidden="true" className="orb-ring" />
        <span aria-hidden="true" className="orb-ring" />
        <span aria-hidden="true" className="orb-ring" />
        <span aria-hidden="true" className="orb-core">
          <span className="orb-swirl" />
          <span className="orb-bars">
            <i /><i /><i /><i /><i />
          </span>
        </span>
      </div>
    </button>
  )
}
