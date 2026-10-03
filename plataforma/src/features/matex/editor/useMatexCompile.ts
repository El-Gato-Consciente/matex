import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import type { CompileResult } from '@/features/compiler/types'
import { filesInput } from '@/features/compiler/types'
import { safeCompile } from '@/features/compiler/safeCompile'
import { downloadPdf } from '@/lib/downloadPdf'
import type { ProjectFile } from '@/features/documents/types'
import type { ProjectStore } from '@/features/documents/ProjectStore'

/**
 * **Orquestación de compilación del editor** (QA-06, slice 1). Extraído del God component
 * `MatexWorkspace` para que la lógica —cuándo el PDF está al día, compilar+persistir, y el
 * "descargar el PDF coherente con la compilación"— viva en una unidad **testeable** con dobles
 * (compilador + store falsos), en vez de enredada entre 56 hooks. Sin esto no había forma de
 * verificar que, p. ej., una descarga nunca entregue un PDF viejo en silencio.
 */
export interface UseMatexCompileArgs {
  /** El LaTeX derivado del AST actual (lo recompila el componente desde el `ast`). */
  readonly latex: string
  /** Recursos que acompañan al `main.tex` (imágenes, `refs.bib`, `.tex` incluidos). */
  readonly compiledFiles: readonly ProjectFile[]
  readonly compiler: LatexCompiler
  readonly store: ProjectStore
  readonly projectId: string
  /** Nombre para el archivo PDF al descargar. */
  readonly docName: string
}

export interface MatexCompileState {
  readonly result: CompileResult | null
  readonly compiling: boolean
  readonly pdf: Uint8Array | null
  /** ¿Se compiló al menos una vez? (para distinguir "sin compilar" de "al día"). */
  readonly compiled: boolean
  /** El PDF quedó viejo: el LaTeX cambió desde la última compilación. */
  readonly outputStale: boolean
  /** Compila el documento y persiste el `.tex` derivado + sus recursos. */
  readonly compile: () => Promise<void>
  /** Descarga el PDF **al día**: si está fresco baja los bytes; si no, recompila y baja al terminar. */
  readonly requestPdfDownload: () => void
  /**
   * Compila y descarga **otra versión** del mismo documento (p. ej. el examen con soluciones) sin
   * tocar la vista previa ni el `.tex` guardado: es una ocasión de emisión, no un cambio del
   * documento. Si falla, el error queda en el log como cualquier compilación.
   */
  readonly downloadVariantPdf: (variantLatex: string, fileName: string) => Promise<void>
}

export function useMatexCompile({ latex, compiledFiles, compiler, store, projectId, docName }: UseMatexCompileArgs): MatexCompileState {
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compiledLatex, setCompiledLatex] = useState<string | null>(null)

  const pdf = result?.ok ? result.pdf : null
  // Viejo si ya compilamos alguna vez y el LaTeX cambió desde entonces.
  const outputStale = compiledLatex !== null && compiledLatex !== latex

  const compile = useCallback(async () => {
    setCompiling(true)
    const snapshot = latex // el LaTeX que se está compilando (base del estado «al día»)
    try {
      const res = await safeCompile(compiler, filesInput('main.tex', snapshot, compiledFiles))
      setResult(res)
      setCompiledLatex(snapshot)
      // Persistimos el `.tex` derivado **junto con** los recursos (no los pisamos).
      store.updateFiles(projectId, [{ path: 'main.tex', content: snapshot }, ...compiledFiles], 'main.tex')
    } finally {
      setCompiling(false)
    }
  }, [compiler, latex, compiledFiles, store, projectId])

  // Descargar PDF **coherente con la compilación**: nunca entrega un PDF viejo en silencio.
  const pendingPdfDownload = useRef(false)
  const requestPdfDownload = useCallback(() => {
    if (pdf && !outputStale) {
      downloadPdf(pdf, docName || 'documento')
      return
    }
    pendingPdfDownload.current = true
    if (!compiling) void compile()
  }, [pdf, outputStale, docName, compiling, compile])

  useEffect(() => {
    if (!pendingPdfDownload.current || compiling) return
    pendingPdfDownload.current = false // se resolvió (o falló: el log lo muestra)
    if (pdf && !outputStale) downloadPdf(pdf, docName || 'documento')
  }, [compiling, pdf, outputStale, docName])

  const downloadVariantPdf = useCallback(
    async (variantLatex: string, fileName: string) => {
      setCompiling(true)
      try {
        const res = await safeCompile(compiler, filesInput('main.tex', variantLatex, compiledFiles))
        if (res.ok) downloadPdf(res.pdf, fileName)
        else setResult(res)
      } finally {
        setCompiling(false)
      }
    },
    [compiler, compiledFiles],
  )

  return { result, compiling, pdf, compiled: compiledLatex !== null, outputStale, compile, requestPdfDownload, downloadVariantPdf }
}
