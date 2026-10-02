import { useRef, useState } from 'react'
import { WIKI_ANIMATIONS, type WikiAnimationId } from './animations'
import { useInView } from './useInView'

interface AnimationFrameProps {
  id: WikiAnimationId
  caption?: string | undefined
}

/**
 * Marco de una ilustración animada: la **pausa fuera de pantalla** (no gasta CPU
 * ni se "pierde" la animación mientras no se ve) y ofrece **Repetir** (remonta el
 * componente, así todo arranca de cero). Con «reducir movimiento», el CSS muestra
 * el estado final quieto.
 */
export function AnimationFrame({ id, caption }: AnimationFrameProps) {
  const ref = useRef<HTMLElement>(null)
  const playing = useInView(ref, { threshold: 0.35 })
  const [run, setRun] = useState(0)
  const Animation = WIKI_ANIMATIONS[id]

  return (
    <figure ref={ref} className="wiki-anim-frame">
      <div className="wiki-anim" data-playing={playing ? '' : undefined}>
        <Animation key={run} playing={playing} />
      </div>
      <figcaption className="flex items-start justify-between gap-3 border-t border-(--color-border) px-4 py-2.5">
        <span className="text-sm text-(--color-ink-muted)">{caption}</span>
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          className="shrink-0 rounded px-2 py-0.5 text-xs text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
        >
          ↻ Repetir
        </button>
      </figcaption>
    </figure>
  )
}
