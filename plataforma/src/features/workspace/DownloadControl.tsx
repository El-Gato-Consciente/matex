import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Download } from '@/components/icons'
import { downloadPdf } from '@/lib/downloadPdf'

export interface DownloadItem {
  label: string
  onClick: () => void
}

interface DownloadControlProps {
  pdf: Uint8Array | null
  downloadName: string
  /** Descargas adicionales (p. ej. el proyecto en .zip). */
  extra?: readonly DownloadItem[] | undefined
  /**
   * Acción custom para "PDF" (p. ej. recompilar-y-descargar si está desactualizado).
   * Si se pasa, se usa en vez de descargar los bytes actuales.
   */
  onPdf?: (() => void) | undefined
  /** Nota chica junto al item PDF (p. ej. «recompila y descarga»). */
  pdfNote?: string | undefined
  /** Habilita "PDF" aunque no haya bytes todavía (porque `onPdf` puede compilarlos). */
  pdfEnabled?: boolean | undefined
}

/**
 * Control de descargas de la toolbar. Si solo está el PDF, es un botón simple;
 * si hay más opciones (p. ej. `.zip`), se agrupan en un menú **Descargar ▾**,
 * para no llenar la toolbar de botones sueltos.
 */
export function DownloadControl({ pdf, downloadName, extra = [], onPdf, pdfNote, pdfEnabled }: DownloadControlProps) {
  const downloadPdfNow = onPdf ?? (() => pdf && downloadPdf(pdf, downloadName))
  const pdfDisabled = !(pdfEnabled ?? pdf)

  if (extra.length === 0) {
    return (
      <button
        type="button"
        onClick={downloadPdfNow}
        disabled={pdfDisabled}
        aria-label="Descargar PDF"
        title="Descargar PDF"
        className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1 text-xs hover:bg-(--color-surface-muted) disabled:opacity-40"
      >
        <Download width={14} height={14} /> PDF
      </button>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1 text-xs outline-none hover:bg-(--color-surface-muted) data-[state=open]:bg-(--color-surface-muted)">
        <Download width={14} height={14} /> Descargar
        <ChevronDown width={13} height={13} className="text-(--color-ink-muted)" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
        >
          <DropdownMenu.Item
            disabled={pdfDisabled}
            onSelect={downloadPdfNow}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-(--color-ink) outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-(--color-surface-muted)"
          >
            PDF
            {pdfNote && <span className="text-xs text-(--color-ink-muted)">{pdfNote}</span>}
          </DropdownMenu.Item>
          {extra.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.onClick}
              className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-(--color-ink) outline-none data-[highlighted]:bg-(--color-surface-muted)"
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
