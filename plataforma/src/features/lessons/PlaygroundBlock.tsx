import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { safeCompile } from '@/features/compiler/safeCompile'
import type { CompileDiagnostic } from '@/features/compiler/types'
import { LatexEditor, type EditorDiagnostic } from '@/features/editor/LatexEditor'
import { useLessonHost } from './LessonHost'
import { PLAYGROUND_BODY_OFFSET, playgroundInput } from './playground'

// pdf.js es pesado: se carga recién cuando hace falta, como en el Workspace.
const PdfPreview = lazy(() =>
  import('@/features/preview/PdfPreview').then((module) => ({ default: module.PdfPreview })),
)

/** Espera tras la última tecla antes de compilar (el backend tarda ~1–5 s). */
const COMPILE_DEBOUNCE_MS = 900

type Status = 'compiling' | 'ok' | 'error'

interface PlaygroundBlockProps {
  caption?: string | undefined
  body: string
}

/**
 * Bloque `playground`: el alumno edita el cuerpo y el PDF se recompila solo. Se
 * conserva el último PDF bueno mientras compila o si hay errores, para que la
 * vista no parpadee; los errores se marcan en la línea del cuerpo que los causó.
 */
export function PlaygroundBlock({ caption, body: initialBody }: PlaygroundBlockProps) {
  const { compiler } = useLessonHost()
  const [body, setBody] = useState(initialBody)
  const [pdf, setPdf] = useState<Uint8Array | null>(null)
  const [status, setStatus] = useState<Status>('compiling')
  const [diagnostics, setDiagnostics] = useState<readonly EditorDiagnostic[]>([])
  // Solo cuenta la respuesta de la última compilación pedida (descarta las viejas).
  const latestRequest = useRef(0)

  useEffect(() => {
    const request = ++latestRequest.current
    setStatus('compiling')
    const timer = window.setTimeout(async () => {
      const result = await safeCompile(compiler, playgroundInput(body))
      if (request !== latestRequest.current) return
      if (result.ok) {
        setPdf(result.pdf)
        setDiagnostics([])
        setStatus('ok')
      } else {
        setDiagnostics(toBodyDiagnostics(result.diagnostics, result.log))
        setStatus('error')
      }
    }, COMPILE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [body, compiler])

  const firstError = diagnostics.find((d) => d.severity === 'error')

  return (
    <figure className="overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface)">
      <figcaption className="flex items-start gap-3 border-b border-(--color-border) bg-(--color-surface-muted) px-3 py-2">
        <span className="mt-0.5 rounded bg-(--color-primary) px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-(--color-primary-ink) uppercase">
          Probalo
        </span>
        <div className="min-w-0 flex-1 text-sm text-(--color-ink-muted)">
          {caption ? <Markdown>{caption}</Markdown> : 'Editá el código: el PDF se actualiza solo.'}
        </div>
        {body !== initialBody && (
          <button
            type="button"
            onClick={() => setBody(initialBody)}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-(--color-ink-muted) hover:bg-(--color-surface) hover:text-(--color-ink)"
          >
            Restaurar
          </button>
        )}
      </figcaption>

      <div className="grid sm:grid-cols-2">
        <div className="h-60 min-w-0 border-b border-(--color-border) sm:border-r sm:border-b-0">
          <LatexEditor value={body} onChange={setBody} diagnostics={diagnostics} />
        </div>
        <div className="relative h-60 min-w-0">
          <Suspense fallback={null}>
            <PdfPreview pdf={pdf} />
          </Suspense>
          <StatusPill status={status} />
        </div>
      </div>

      {status === 'error' && (
        <p className="border-t border-(--color-border) px-3 py-2 text-xs text-(--color-danger)">
          {firstError
            ? `${firstError.line ? `Línea ${firstError.line}: ` : ''}${firstError.message}`
            : 'No compiló.'}{' '}
          <span className="text-(--color-ink-muted)">Mientras tanto ves la última versión que anduvo.</span>
        </p>
      )}
    </figure>
  )
}

function StatusPill({ status }: { status: Status }) {
  if (status === 'ok') return null
  const compiling = status === 'compiling'
  return (
    <span
      className={[
        'absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-medium shadow',
        compiling
          ? 'bg-(--color-surface) text-(--color-ink-muted)'
          : 'bg-(--color-danger) text-(--color-surface-muted)',
      ].join(' ')}
    >
      {compiling ? 'Compilando…' : 'Con errores'}
    </span>
  )
}

/** Lleva las líneas del documento completo a las del cuerpo (lo que ve el alumno). */
function toBodyDiagnostics(diagnostics: readonly CompileDiagnostic[], log: string): EditorDiagnostic[] {
  if (diagnostics.length === 0) return [{ severity: 'error', message: firstLine(log) }]
  return diagnostics.map((d) => {
    const line = d.line === undefined ? undefined : d.line - PLAYGROUND_BODY_OFFSET
    return { severity: d.severity, message: d.message, line: line !== undefined && line > 0 ? line : undefined }
  })
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? 'No compiló.'
}
