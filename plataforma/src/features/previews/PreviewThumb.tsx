import type { Preview, PreviewPage } from './types'

/** Caja fija en la que entra la miniatura, en px. */
const BOX_WIDTH = 116
const BOX_HEIGHT = 136

interface PreviewThumbProps {
  preview: Preview
  /** Título del documento: entra en el nombre accesible del botón. */
  title: string
  /** Abrir el visor con todas las páginas capturadas. */
  onOpen: () => void
}

/**
 * Miniatura de la portada de un documento, clicable para ver el resto de las páginas.
 *
 * **La caja es de tamaño fijo y la hoja se escala adentro.** Los documentos no comparten papel
 * —A4 vertical, 16:9 de una presentación, un póster, una cheatsheet apaisada— así que estirarlos
 * todos a un `aspect-ratio` común los deformaría, y dejar que cada uno imponga su tamaño
 * desalinearía la grilla de tarjetas. Con caja fija + escalado, cada hoja conserva su proporción
 * y todas las tarjetas miden lo mismo.
 *
 * El `width`/`height` del `<img>` son los del bitmap real: el navegador reserva el espacio antes
 * de descargar la imagen, así que la grilla no salta cuando cargan (CLS).
 */
export function PreviewThumb({ preview, title, onOpen }: PreviewThumbProps) {
  const cover = preview.pages[0]
  if (!cover) return null

  const { width, height } = fit(cover)
  const hasMore = preview.pages.length > 1

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        hasMore
          ? `Ver la vista previa de ${title} (${preview.pages.length} páginas)`
          : `Ver la vista previa de ${title}`
      }
      title="Ver la vista previa"
      className="group relative flex shrink-0 items-center justify-center"
      style={{ width: BOX_WIDTH, height: BOX_HEIGHT }}
    >
      <span className="relative block" style={{ width, height }}>
        {/* Hojas de atrás: sugieren que hay más de una página, sin gastar espacio. */}
        {hasMore && (
          <span
            aria-hidden="true"
            className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-sm border border-(--color-border) bg-(--color-surface-muted)"
          />
        )}
        <img
          src={cover.src}
          width={cover.width}
          height={cover.height}
          loading="lazy"
          decoding="async"
          alt=""
          className="relative block size-full rounded-sm border border-(--color-border) bg-white object-contain shadow-md transition-colors group-hover:border-(--color-primary)"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {preview.pageCount === 1 ? 'Ampliar' : `${preview.pageCount} págs.`}
          </span>
        </span>
      </span>
    </button>
  )
}

/** Escala la hoja para que entre en la caja sin deformarse. */
function fit(page: PreviewPage): { width: number; height: number } {
  const scale = Math.min(BOX_WIDTH / page.width, BOX_HEIGHT / page.height)
  return { width: Math.round(page.width * scale), height: Math.round(page.height * scale) }
}
