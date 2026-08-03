import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal genérico: overlay centrado, cierra con **Escape** o click en el fondo. Se renderiza en
 * un portal al `body` (fuera del árbol de quien lo abre) para evitar problemas de stacking y de
 * foco — en particular con ProseMirror, el editor visual.
 *
 * Vive en `components/` y no en `features/matex/editor/`, de donde salió: lo usan los editores
 * **document-level** de Matex (bibliografía, portada) y el visor de vistas previas, que no
 * tienen por qué depender del editor para pedir un overlay.
 */
export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-black/40 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`my-8 w-full ${width} rounded-xl border border-(--color-border) bg-(--color-surface) shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-2.5">
          <h2 className="text-sm font-semibold text-(--color-ink)">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
