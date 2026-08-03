import { lazy, Suspense, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Panel, PanelGroup, type ImperativePanelHandle } from 'react-resizable-panels'
import { type EditorView } from '@codemirror/view'
import { PanelLeft } from '@/components/icons'
import { ResizeHandle } from '@/components/ResizeHandle'
import { CompileLogBar } from '@/features/compiler/CompileLogBar'
import { CompilingIndicator } from '@/features/compiler/CompilingIndicator'
import type { CompileResult } from '@/features/compiler/types'
import { LatexEditor } from '@/features/editor/LatexEditor'
import { scrollToLine } from '@/features/editor/scrollToLine'
import { DownloadControl, type DownloadItem } from './DownloadControl'
import { HeaderSlotContent } from './HeaderSlot'

// PDF.js (~1 MB) se carga solo cuando se muestra un workspace (code-splitting),
// y un único lugar lo hace para toda la app.
const PdfPreview = lazy(() =>
  import('@/features/preview/PdfPreview').then((module) => ({ default: module.PdfPreview })),
)

interface WorkspaceProps {
  direction: 'horizontal' | 'vertical'
  /** Clave para recordar los tamaños de los paneles (uno por contexto). */
  autoSaveId: string

  /** Lado izquierdo de la barra superior (back, nombre/título…). */
  toolbarStart?: ReactNode
  /** Acciones extra antes de Descargar/Compilar (Copiar, Usar como base…). */
  toolbarExtra?: ReactNode

  /** Panel izquierdo opcional, colapsable (la tarea/explicación en el Curso). */
  leftPanel?: ReactNode
  leftPanelRef?: RefObject<ImperativePanelHandle | null>
  /** Al cambiar (entrar a un ejemplo/práctica/proyecto), el panel se reabre solo. */
  expandKey?: string | number
  leftCollapsed?: boolean
  onToggleLeft?: () => void
  onLeftCollapse?: () => void
  onLeftExpand?: () => void

  source: string
  onSourceChange?: (value: string) => void
  readOnly?: boolean
  /** Archivos del proyecto: autocompletar rutas + abrir con Ctrl/Cmd+Click. */
  filePaths?: readonly string[]
  onOpenPath?: (path: string) => void

  result: CompileResult | null
  compiling: boolean
  onCompile: () => void
  /** Nombre base para el PDF descargado. */
  downloadName: string
  extraDownloads?: readonly DownloadItem[]
  /** Texto del estado “compilando” en el visor. */
  compilingLabel?: string
}

/**
 * **Workspace unificado**: barra superior + (panel izquierdo opcional |) editor |
 * vista PDF, con feedback de compilación y barra de error. Lo usan el Curso
 * (Ejemplo/Practicar), la Galería y Mis Proyectos, para que se vean y se
 * comporten igual y no haya tres layouts duplicados.
 */
export function Workspace({
  direction,
  autoSaveId,
  toolbarStart,
  toolbarExtra,
  leftPanel,
  leftPanelRef,
  expandKey,
  leftCollapsed,
  onToggleLeft,
  onLeftCollapse,
  onLeftExpand,
  source,
  onSourceChange,
  readOnly = false,
  filePaths,
  onOpenPath,
  result,
  compiling,
  onCompile,
  downloadName,
  extraDownloads,
  compilingLabel = 'Compilando',
}: WorkspaceProps) {
  const pdf = result?.ok ? result.pdf : null
  const editorViewRef = useRef<EditorView | null>(null)

  // Al entrar a un contexto nuevo (ejemplo/práctica/proyecto), el panel arranca
  // abierto; colapsarlo queda como acción puntual del usuario.
  useEffect(() => {
    const panel = leftPanelRef?.current
    if (panel && panel.isCollapsed()) panel.expand()
  }, [expandKey, leftPanelRef])

  return (
    <div className="flex h-full flex-col">
      {/* La toolbar del workspace vive en el ÚNICO header de la app (sin 2ª barra). */}
      <HeaderSlotContent>
        <div className="flex min-w-0 flex-1 items-center gap-2">{toolbarStart}</div>
        <div className="flex shrink-0 items-center gap-2">
          {toolbarExtra}
          <DownloadControl pdf={pdf} downloadName={downloadName} extra={extraDownloads} />
          <button
            type="button"
            onClick={onCompile}
            disabled={compiling}
            className="rounded-md bg-(--color-primary) px-3 py-1 text-xs font-medium text-(--color-primary-ink) hover:opacity-90 disabled:opacity-50"
          >
            {compiling ? 'Compilando…' : 'Compilar'}
          </button>
        </div>
      </HeaderSlotContent>

      <div className="flex min-h-0 flex-1">
        {/* Riel sutil para reabrir el panel colapsado: al costado, sin pisar el editor. */}
        {leftPanel && leftCollapsed && onToggleLeft && (
          <button
            type="button"
            onClick={onToggleLeft}
            aria-label="Mostrar panel"
            title="Mostrar panel"
            className="flex w-7 shrink-0 justify-center border-r border-(--color-border) bg-(--color-surface) pt-3 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <PanelLeft />
          </button>
        )}
        <PanelGroup key={direction} direction={direction} autoSaveId={autoSaveId} className="h-full min-w-0 flex-1">
        {leftPanel && (
          <>
            <Panel
              ref={leftPanelRef}
              collapsible
              collapsedSize={0}
              defaultSize={30}
              minSize={18}
              onCollapse={onLeftCollapse}
              onExpand={onLeftExpand}
              className="bg-(--color-surface)"
            >
              {leftPanel}
            </Panel>
            <ResizeHandle direction={direction} />
          </>
        )}

        <Panel minSize={25} className="min-h-0 overflow-hidden bg-(--color-surface)">
          <LatexEditor
            value={source}
            onChange={onSourceChange ?? (() => {})}
            readOnly={readOnly}
            filePaths={filePaths}
            onOpenPath={onOpenPath}
            diagnostics={!readOnly && result && !result.ok ? result.diagnostics : undefined}
            onView={(view) => {
              editorViewRef.current = view
            }}
          />
        </Panel>
        <ResizeHandle direction={direction} />

        <Panel minSize={25} className="min-h-0">
          {compiling && !pdf ? (
            <CompilingIndicator label={compilingLabel} />
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-(--color-surface-muted) text-sm text-(--color-ink-muted)">
                  Cargando visor…
                </div>
              }
            >
              <PdfPreview pdf={pdf} />
            </Suspense>
          )}
        </Panel>
        </PanelGroup>
      </div>

      <CompileLogBar
        result={result}
        onJumpToLine={(line) => {
          if (editorViewRef.current) scrollToLine(editorViewRef.current, line)
        }}
      />
    </div>
  )
}
