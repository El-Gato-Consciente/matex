import { Modal } from '@/components/Modal'
import type { Preview } from './types'

interface PreviewDialogProps {
  /** El preview a mostrar; `null` cierra el visor. */
  preview: Preview | null
  title: string
  onClose: () => void
}

/**
 * Visor de la vista previa: las páginas capturadas, grandes y en orden.
 *
 * Se apoya en el `Modal` compartido (Escape y click en el fondo cierran) y **no** intenta ser un
 * lector de PDF: no hay zoom ni paginado, porque para eso está «Ver por dentro», que abre el
 * documento con su fuente y el PDF real. Acá la pregunta es una sola —«¿es esto lo que busco?»—
 * y se responde mirando.
 */
export function PreviewDialog({ preview, title, onClose }: PreviewDialogProps) {
  const shown = preview?.pages.length ?? 0
  const total = preview?.pageCount ?? 0

  return (
    <Modal open={preview !== null} onClose={onClose} title={`Vista previa · ${title}`} width="max-w-2xl">
      {preview && (
        <div className="flex flex-col items-center gap-5">
          {shown < total && (
            <p className="text-xs text-(--color-ink-muted)">
              {shown === 1 ? 'Primera página' : `${shown} páginas representativas`} de {total}.
            </p>
          )}
          {preview.pages.map((page) => (
            <figure key={page.src} className="w-full">
              <img
                src={page.src}
                width={page.width}
                height={page.height}
                loading="lazy"
                decoding="async"
                alt={`${title} — página ${page.page}`}
                className="w-full rounded border border-(--color-border) bg-white shadow-lg"
              />
              <figcaption className="mt-1.5 text-center text-xs text-(--color-ink-muted)">
                Página {page.page}
                {total > 1 && ` de ${total}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Modal>
  )
}
