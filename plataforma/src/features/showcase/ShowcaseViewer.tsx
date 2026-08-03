import { useCallback, useEffect, useRef, useState } from 'react'
import { type ImperativePanelHandle } from 'react-resizable-panels'
import { ChevronLeft, Copy, Plus } from '@/components/icons'
import { safeCompile } from '@/features/compiler/safeCompile'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import { filesInput, type CompileResult } from '@/features/compiler/types'
import { FileList } from '@/features/workspace/FileList'
import { Workspace } from '@/features/workspace/Workspace'
import { getCachedCompile, setCachedCompile } from './exemplarCache'
import type { Exemplar } from './types'

interface ShowcaseViewerProps {
  exemplar: Exemplar
  compiler: LatexCompiler
  onBack: () => void
  /** Crea un proyecto **LaTeX** a partir del ejemplar (copiar para editar). */
  onUseAsBase: (exemplar: Exemplar) => void
  /** Abre la **versión Matex** (editor visual) del ejemplar, si la tiene (ME-23). */
  onOpenMatex: (exemplar: Exemplar) => void
}

/** Visor de un ejemplar (multi-archivo): fuente comentada (solo lectura) + PDF. */
export function ShowcaseViewer({ exemplar, compiler, onBack, onUseAsBase, onOpenMatex }: ShowcaseViewerProps) {
  const isNarrow = useMediaQuery('(max-width: 860px)')
  const direction = isNarrow ? 'vertical' : 'horizontal'

  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiling, setCompiling] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activePath, setActivePath] = useState(exemplar.mainFile)
  const filesPanelRef = useRef<ImperativePanelHandle>(null)
  const [collapsed, setCollapsed] = useState(false)
  // Fuente ya enviada a compilar: evita la doble compilación de StrictMode (dev).
  const compiledKeyRef = useRef<string | null>(null)

  function toggleFiles() {
    const panel = filesPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  const fileList = [{ path: exemplar.mainFile, content: exemplar.source }, ...exemplar.files]
  const activeContent = fileList.find((file) => file.path === activePath)?.content ?? exemplar.source

  const compile = useCallback(async () => {
    compiledKeyRef.current = exemplar.id
    setCompiling(true)
    try {
      const res = await safeCompile(compiler, filesInput(exemplar.mainFile, exemplar.source, exemplar.files))
      setCachedCompile(exemplar.id, res)
      setResult(res)
    } finally {
      setCompiling(false)
    }
  }, [compiler, exemplar])

  // Al abrir: si ya está en caché (compilado antes en esta sesión), instantáneo.
  // El visor se remonta por ejemplar (key), así que el resultado siempre es de este.
  useEffect(() => {
    if (compiledKeyRef.current === exemplar.id) return
    compiledKeyRef.current = exemplar.id

    const cached = getCachedCompile(exemplar.id)
    if (cached) {
      setResult(cached)
      setCompiling(false)
      return
    }

    setResult(null)
    setCompiling(true)
    safeCompile(compiler, filesInput(exemplar.mainFile, exemplar.source, exemplar.files)).then((res) => {
      setCachedCompile(exemplar.id, res)
      setResult(res)
      setCompiling(false)
    })
  }, [exemplar, compiler])

  async function copySource() {
    await navigator.clipboard.writeText(activeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Workspace
      direction={direction}
      autoSaveId={`matex-showcase-${direction}`}
      toolbarStart={
        <>
          <button
            type="button"
            onClick={onBack}
            title="Volver a la galería"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft width={14} height={14} /> Galería
          </button>
          <span className="text-(--color-ink-muted) opacity-40">/</span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-(--color-ink)">{exemplar.title}</span>
            <span className="truncate text-xs text-(--color-ink-muted)">{exemplar.docType}</span>
          </div>
        </>
      }
      toolbarExtra={
        <>
          <button
            type="button"
            onClick={copySource}
            className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1 text-xs hover:bg-(--color-surface-muted)"
          >
            <Copy width={14} height={14} /> {copied ? 'Copiado' : 'Copiar archivo'}
          </button>
          <button
            type="button"
            onClick={() => onUseAsBase(exemplar)}
            className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1 text-xs hover:bg-(--color-surface-muted)"
          >
            <Plus width={14} height={14} /> Usar como base
          </button>
          {exemplar.matex && (
            <button
              type="button"
              onClick={() => onOpenMatex(exemplar)}
              title="Editar la versión Matex (editor visual) de este ejemplar"
              className="inline-flex items-center gap-1.5 rounded-md border border-(--color-primary) bg-(--color-primary) px-3 py-1 text-xs text-(--color-primary-ink) hover:opacity-90"
            >
              Abrir en Matex
            </button>
          )}
        </>
      }
      leftPanel={
        exemplar.files.length > 0 ? (
          <FileList
            files={fileList}
            activePath={activePath}
            mainFile={exemplar.mainFile}
            onSelect={setActivePath}
            onCollapse={toggleFiles}
          />
        ) : undefined
      }
      leftPanelRef={filesPanelRef}
      leftCollapsed={collapsed}
      onToggleLeft={toggleFiles}
      onLeftCollapse={() => setCollapsed(true)}
      onLeftExpand={() => setCollapsed(false)}
      filePaths={[exemplar.mainFile, ...exemplar.files.map((file) => file.path)]}
      onOpenPath={setActivePath}
      source={activeContent}
      readOnly
      result={result}
      compiling={compiling}
      onCompile={compile}
      downloadName={exemplar.id}
      compilingLabel="Compilando el ejemplar"
    />
  )
}
