import { useEffect, useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { autocompletion } from '@codemirror/autocomplete'
import { StreamLanguage, codeFolding, foldGutter } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { createLatexCompletionSource } from './latexCompletions'
import { latexFolding } from './latexFolding'
import { mathPreview } from './mathPreview'
import { matexEditorTheme } from './matexTheme'

/** Diagnóstico agnóstico del compilador (línea 1-based + mensaje). */
export interface EditorDiagnostic {
  severity: 'error' | 'warning'
  message: string
  line?: number | undefined
}

interface LatexEditorProps {
  value: string
  onChange: (value: string) => void
  /** Solo lectura: para mostrar fuente que no se edita (p. ej. la Galería). */
  readOnly?: boolean
  /** Expone la vista de CodeMirror (p. ej. para saltar a una línea de error). */
  onView?: (view: EditorView) => void
  /** Errores del compilador, subrayados en su línea (con mensaje al pasar el mouse). */
  diagnostics?: readonly EditorDiagnostic[] | undefined
  /** Archivos del proyecto: para autocompletar rutas y para Ctrl/Cmd+Click. */
  filePaths?: readonly string[] | undefined
  /** Abrir un archivo del proyecto (Ctrl/Cmd+Click sobre su ruta en \input/etc.). */
  onOpenPath?: ((path: string) => void) | undefined
}

const PATH_RE = /\\(?:input|include|includegraphics|subfile|addbibresource)(?:\[[^\]]*\])?\{([^}]*)\}/g

/** Resuelve la ruta escrita a un archivo existente (tolera omitir `.tex`). */
function resolvePath(raw: string, filePaths: readonly string[]): string | null {
  const p = raw.trim()
  if (!p) return null
  if (filePaths.includes(p)) return p
  if (filePaths.includes(`${p}.tex`)) return `${p}.tex`
  return filePaths.find((f) => f === p || f.startsWith(`${p}.`)) ?? null
}

/** ¿La columna `col` de `lineText` cae sobre una ruta de archivo? Devuelve el archivo. */
function pathAt(lineText: string, col: number, filePaths: readonly string[]): string | null {
  PATH_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PATH_RE.exec(lineText))) {
    const start = m.index + m[0].indexOf('{') + 1
    const end = start + m[1]!.length
    if (col >= start && col <= end) return resolvePath(m[1]!, filePaths)
  }
  return null
}

function toCmDiagnostic(view: EditorView, d: EditorDiagnostic): Diagnostic[] {
  if (d.line == null) return []
  const lineNo = Math.min(Math.max(Math.trunc(d.line), 1), view.state.doc.lines)
  const line = view.state.doc.line(lineNo)
  return [{ from: line.from, to: line.to, severity: d.severity, message: d.message }]
}

/**
 * Editor de código LaTeX (CodeMirror 6) con tema dark a medida y varias ayudas:
 * autocompletado (comandos, entornos con `\end`, `\ref`/`\cite`, **paquetes** y
 * **rutas del proyecto**), auto-cerrado de `$`, **plegado** de secciones y
 * `\begin…\end`, **diagnósticos del compilador inline**, y **Ctrl/Cmd+Click** para
 * abrir el archivo de una ruta. Aislado tras esta interfaz mínima.
 */
export function LatexEditor({
  value,
  onChange,
  readOnly = false,
  onView,
  diagnostics,
  filePaths,
  onOpenPath,
}: LatexEditorProps) {
  const viewRef = useRef<EditorView | null>(null)
  // Refs para que las extensiones (estables) lean datos que cambian por render.
  const filePathsRef = useRef<readonly string[]>(filePaths ?? [])
  const onOpenPathRef = useRef<LatexEditorProps['onOpenPath']>(onOpenPath)
  filePathsRef.current = filePaths ?? []
  onOpenPathRef.current = onOpenPath

  const extensions = useMemo(() => {
    const language = StreamLanguage.define(stex)
    return [
      language,
      // Auto-cerrar `$` (además de {}[]() que ya cierra basicSetup).
      language.data.of({ closeBrackets: { brackets: ['(', '[', '{', '$'] } }),
      EditorView.lineWrapping,
      autocompletion({
        override: [createLatexCompletionSource({ getFilePaths: () => filePathsRef.current })],
        activateOnTyping: true,
      }),
      codeFolding(),
      foldGutter(),
      latexFolding,
      lintGutter(),
      mathPreview,
      EditorView.domEventHandlers({
        mousedown(event, view) {
          if (!(event.metaKey || event.ctrlKey)) return false
          const open = onOpenPathRef.current
          if (!open) return false
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos == null) return false
          const line = view.state.doc.lineAt(pos)
          const target = pathAt(line.text, pos - line.from, filePathsRef.current)
          if (!target) return false
          event.preventDefault()
          open(target)
          return true
        },
      }),
      ...matexEditorTheme,
    ]
  }, [])

  // Los diagnósticos vienen del compilador (externos): se aplican imperativamente.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cm = (diagnostics ?? []).flatMap((d) => toCmDiagnostic(view, d))
    view.dispatch(setDiagnostics(view.state, cm))
  }, [diagnostics])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={(view) => {
        viewRef.current = view
        onView?.(view)
      }}
      extensions={extensions}
      theme="none"
      height="100%"
      readOnly={readOnly}
      editable={!readOnly}
      className="h-full text-[13px]"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: !readOnly,
        foldGutter: false,
        autocompletion: false,
      }}
    />
  )
}
