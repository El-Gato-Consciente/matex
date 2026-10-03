import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Download, Plus } from '@/components/icons'
import { downloadBlob } from '@/lib/files'
import { relativeTime } from '@/lib/relativeTime'
import { compileToHtml } from '@/features/matex/core'
import { buildDataUrls } from '@/features/matex/editor/assets'
import { ShareNotFound, type ShareApi, type SharedDocument } from './ShareApi'
import { readSharedMtex, type SharedMatex } from './sharedContent'

const PdfPreview = lazy(() =>
  import('@/features/preview/PdfPreview').then((module) => ({ default: module.PdfPreview })),
)

type Loaded =
  | { readonly kind: 'mtex'; readonly meta: SharedDocument; readonly blob: Blob; readonly document: SharedMatex }
  | { readonly kind: 'pdf'; readonly meta: SharedDocument; readonly blob: Blob; readonly bytes: Uint8Array }

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly loaded: Loaded }

interface SharedViewProps {
  readonly shareId: string
  readonly api: ShareApi
  /** Crea una copia del documento en los proyectos de quien lo abre y la abre en el editor. */
  readonly onImport: (name: string, document: SharedMatex) => void
  readonly onGoProjects: () => void
}

/**
 * **Lo que ve quien abre un link compartido** (sin cuenta). Qué puede hacer depende del tipo de
 * link que eligió el autor:
 *  - `.mtex`: ver el documento, descargarlo e importarlo a sus proyectos.
 *  - PDF: verlo y descargarlo. No hay «importar»: el autor no compartió la fuente.
 *
 * El documento es **contenido ajeno**: se valida antes de mostrarlo y se dibuja en un `iframe`
 * aislado (sin acceso al origen de la app: ni a su almacenamiento ni a la sesión).
 */
export function SharedView({ shareId, api, onImport, onGoProjects }: SharedViewProps) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const meta = await api.open(shareId)
        const blob = await api.download(meta)
        const loaded: Loaded =
          meta.kind === 'pdf'
            ? { kind: 'pdf', meta, blob, bytes: new Uint8Array(await blob.arrayBuffer()) }
            : { kind: 'mtex', meta, blob, document: readSharedMtex(JSON.parse(await blob.text())) }
        if (!cancelled) setState({ status: 'ready', loaded })
      } catch (error) {
        if (cancelled) return
        if (error instanceof ShareNotFound) setState({ status: 'not-found' })
        else setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, shareId])

  if (state.status === 'loading') return <Notice title="Abriendo el documento compartido…" />
  if (state.status === 'not-found') {
    return (
      <Notice
        title="Este link no está disponible"
        detail="Puede que quien lo compartió lo haya revocado, o que la dirección esté incompleta."
        action={{ label: 'Ir a Mis Proyectos', onClick: onGoProjects }}
      />
    )
  }
  if (state.status === 'error') {
    return (
      <Notice
        title="No se pudo abrir el documento"
        detail={state.message}
        action={{ label: 'Ir a Mis Proyectos', onClick: onGoProjects }}
      />
    )
  }

  const { loaded } = state
  const fileName = `${safeFileName(loaded.meta.name)}.${loaded.kind === 'pdf' ? 'pdf' : 'mtex'}`
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--color-border) bg-(--color-surface) px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-(--color-ink)">{loaded.meta.name}</h1>
          <p className="text-xs text-(--color-ink-muted)">
            {loaded.kind === 'pdf' ? 'PDF compartido' : 'Documento Matex compartido'} · actualizado {relativeTime(loaded.meta.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadBlob(loaded.blob, fileName)}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1.5 text-xs text-(--color-ink) hover:bg-(--color-surface-muted)"
        >
          <Download width={14} height={14} /> Descargar {loaded.kind === 'pdf' ? 'PDF' : '.mtex'}
        </button>
        {loaded.kind === 'mtex' && (
          <button
            type="button"
            onClick={() => onImport(loaded.meta.name, loaded.document)}
            title="Crea una copia en tus proyectos para editarla. No cambia el documento original."
            className="inline-flex items-center gap-1.5 rounded-md bg-(--color-primary) px-3 py-1.5 text-xs font-medium text-(--color-primary-ink) hover:opacity-90"
          >
            <Plus width={14} height={14} /> Importar a mis proyectos
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {loaded.kind === 'pdf' ? (
          <Suspense fallback={<Notice title="Cargando el visor…" />}>
            <PdfPreview pdf={loaded.bytes} />
          </Suspense>
        ) : (
          <SharedMatexFrame document={loaded.document} title={loaded.meta.name} />
        )}
      </div>
    </div>
  )
}

/** El documento como página web (el mismo backend HTML del editor), en un `iframe` aislado. */
function SharedMatexFrame({ document, title }: { document: SharedMatex; title: string }) {
  const html = useMemo(
    () => compileToHtml(document.ast, { images: buildDataUrls(document.files), theme: 'dark' }),
    [document],
  )
  // `allow-scripts` SIN `allow-same-origin`: los gráficos interactivos corren, pero en un origen
  // opaco — un documento ajeno no puede leer el almacenamiento ni la sesión de la app.
  return <iframe title={title} srcDoc={html} sandbox="allow-scripts" className="h-full w-full border-0 bg-white" />
}

function Notice({ title, detail, action }: { title: string; detail?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-(--color-surface) p-8 text-center">
      <p className="text-sm font-medium text-(--color-ink)">{title}</p>
      {detail && <p className="max-w-md text-xs text-(--color-ink-muted)">{detail}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded-md border border-(--color-border) px-3 py-1.5 text-xs text-(--color-ink) hover:bg-(--color-surface-muted)"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/** Nombre de archivo sin caracteres que los sistemas de archivos rechazan. */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'documento'
}
