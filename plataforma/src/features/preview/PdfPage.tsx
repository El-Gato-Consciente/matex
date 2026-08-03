import { useEffect, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

/** Ancho máximo de la hoja para que no se agigante en paneles anchos. */
const MAX_PAGE_WIDTH = 900

interface PdfPageProps {
  page: PDFPageProxy
  /** Ancho disponible en px (content box del contenedor). */
  width: number
}

/** Renderiza una página del PDF ajustada al ancho, como una hoja. */
export function PdfPage({ page, width }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    renderTaskRef.current?.cancel()

    const ratio = window.devicePixelRatio || 1
    const base = page.getViewport({ scale: 1 })
    const target = Math.min(width, MAX_PAGE_WIDTH)
    const cssScale = target / base.width
    const viewport = page.getViewport({ scale: cssScale * ratio })

    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = `${base.width * cssScale}px`
    canvas.style.height = `${base.height * cssScale}px`

    const task = page.render({ canvasContext: context, viewport, canvas })
    renderTaskRef.current = task
    task.promise
      .then(() => setError(null))
      .catch((cause: unknown) => {
        // Cancelar (por resize/desmontaje) no es un error real.
        if (!isCancellation(cause)) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })

    return () => {
      renderTaskRef.current?.cancel()
    }
  }, [page, width])

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="block rounded-sm shadow-2xl ring-1 ring-black/40" />
      {error && (
        <div className="mt-1 text-center text-xs text-(--color-danger)">
          No se pudo mostrar la página: {error}
        </div>
      )}
    </div>
  )
}

function isCancellation(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'RenderingCancelledException'
}
