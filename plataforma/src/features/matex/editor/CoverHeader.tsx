import { useLayoutEffect, useRef } from 'react'
import type { DocMeta } from '../core/ast'

interface CoverHeaderProps {
  meta: DocMeta
  onPatch: (patch: Partial<DocMeta>) => void
  /** Abre el editor completo de la portada (autores con afiliación, resumen, fecha…). */
  onEditCover: () => void
}

/**
 * **La portada, en el lienzo.** Antes el título y los autores solo se veían en el PDF y el
 * documento arrancaba directo en la primera sección. El título se edita acá mismo; el resto
 * (autores, institución, fecha, resumen) se muestra como va a salir y abre la ventana Portada.
 */
export function CoverHeader({ meta, onPatch, onEditCover }: CoverHeaderProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const authors = meta.authors?.map((author) => author.name).filter(Boolean) ?? (meta.author ? [meta.author] : [])
  const byline = [authors.join(' · '), meta.institution].filter(Boolean).join(' — ')

  // El título puede ocupar varias líneas: el textarea crece con el contenido. Se recalcula
  // también cuando cambia el ancho (los paneles se acomodan después del primer render, y con
  // el ancho inicial el título se partía en muchos renglones y dejaba un hueco).
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    const fit = () => {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [meta.title])

  return (
    <header className="matex-cover group relative">
      <button
        type="button"
        onClick={onEditCover}
        className="absolute top-0 right-0 rounded-md px-2 py-1 text-xs text-(--color-ink-muted) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--color-surface-muted) hover:text-(--color-ink) focus:opacity-100"
      >
        Editar portada
      </button>

      <textarea
        ref={titleRef}
        value={meta.title ?? ''}
        onChange={(event) => onPatch({ title: event.target.value || undefined })}
        // Enter no agrega renglones: pasa al cuerpo, como en cualquier editor de documentos.
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          ;(event.currentTarget.closest('.matex-sheet')?.querySelector('.ProseMirror') as HTMLElement | null)?.focus()
        }}
        rows={1}
        placeholder="Título del documento"
        aria-label="Título del documento"
        className="matex-cover-title"
      />

      <button type="button" onClick={onEditCover} className="matex-cover-byline">
        {byline || <span className="matex-cover-empty">+ Agregar autores e institución</span>}
        {meta.date && <span className="matex-cover-date">{meta.date}</span>}
      </button>

      {meta.abstract && (
        <button type="button" onClick={onEditCover} className="matex-cover-abstract">
          <span className="matex-cover-abstract-label">Resumen</span>
          {meta.abstract}
        </button>
      )}
    </header>
  )
}
