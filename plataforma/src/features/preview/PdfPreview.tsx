import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfPage } from './PdfPage'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Padding del contenedor de páginas (coincide con `p-5` = 20px por lado). */
const CONTAINER_PADDING = 40

interface PdfPreviewProps {
  pdf: Uint8Array | null
}

/**
 * Visor del PDF: renderiza **todas las páginas** apiladas, cada una ajustada al
 * ancho del panel y re-ajustándose al cambiar el tamaño (ResizeObserver).
 */
export function PdfPreview({ pdf }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<readonly PDFPageProxy[]>([])
  const [width, setWidth] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Medir el ancho disponible (y seguir los cambios de tamaño del panel).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => setWidth(container.clientWidth - CONTAINER_PADDING)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Cargar el documento y sus páginas.
  useEffect(() => {
    if (!pdf) {
      setPages([])
      setError(null)
      return
    }
    let cancelled = false
    // slice(): PDF.js puede "detachar" el buffer; copiamos para no mutar el original.
    const task = pdfjs.getDocument({ data: pdf.slice() })
    task.promise
      .then(async (doc) => {
        const loaded = await Promise.all(
          Array.from({ length: doc.numPages }, (_, index) => doc.getPage(index + 1)),
        )
        if (!cancelled) {
          setPages(loaded)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })

    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [pdf])

  const showMessage = pdf === null || error !== null

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-(--color-surface-muted)">
      {showMessage ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm">
          <span className={error ? 'text-(--color-danger)' : 'text-(--color-ink-muted)'}>
            {error ? `No se pudo mostrar el PDF: ${error}` : 'Compilá para ver el PDF acá.'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-5">
          {pages.map((page) => (
            <PdfPage key={page.pageNumber} page={page} width={width} />
          ))}
        </div>
      )}
    </div>
  )
}
