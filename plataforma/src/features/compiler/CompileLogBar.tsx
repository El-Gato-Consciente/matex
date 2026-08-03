import type { CompileDiagnostic, CompileResult } from './types'

interface CompileLogBarProps {
  result: CompileResult | null
  /** Salta el editor a una línea (de un diagnóstico clicable). */
  onJumpToLine?: (line: number) => void
}

/**
 * Barra de estado de compilación: en éxito no muestra nada (el PDF confirma). En
 * fallo, lista los **diagnósticos** (errores/avisos); los que traen línea son
 * **clicables** y llevan el cursor ahí. Sin diagnósticos parseados (p. ej. backend
 * caído), muestra el mensaje crudo.
 */
export function CompileLogBar({ result, onJumpToLine }: CompileLogBarProps) {
  if (!result || result.ok) return null
  const { diagnostics, log } = result

  if (diagnostics.length === 0) {
    return (
      <div className="max-h-32 shrink-0 overflow-auto border-t border-(--color-border) bg-(--color-surface-muted) px-4 py-2 text-xs text-(--color-danger)">
        {log || 'No se pudo compilar.'}
      </div>
    )
  }

  return (
    <ul className="max-h-36 shrink-0 divide-y divide-(--color-border) overflow-auto border-t border-(--color-border) bg-(--color-surface-muted)">
      {diagnostics.map((diagnostic, index) => (
        <li key={index}>
          <DiagnosticRow diagnostic={diagnostic} onJumpToLine={onJumpToLine} />
        </li>
      ))}
    </ul>
  )
}

function DiagnosticRow({
  diagnostic,
  onJumpToLine,
}: {
  diagnostic: CompileDiagnostic
  onJumpToLine?: ((line: number) => void) | undefined
}) {
  const { line, severity, message } = diagnostic
  const tone = severity === 'error' ? 'text-(--color-danger)' : 'text-(--color-ink-muted)'
  const badge = (
    <span
      className={[
        'shrink-0 rounded border border-(--color-border) px-1.5 font-mono text-[11px]',
        line !== undefined ? 'text-(--color-danger)' : 'text-(--color-ink-muted)',
      ].join(' ')}
    >
      {line !== undefined ? `l.${line}` : severity === 'error' ? 'error' : 'aviso'}
    </span>
  )

  if (line === undefined) {
    return (
      <div className="flex items-start gap-2 px-4 py-1.5 text-xs">
        {badge}
        <span className={tone}>{message}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onJumpToLine?.(line)}
      title={`Ir a la línea ${line}`}
      className="flex w-full items-start gap-2 px-4 py-1.5 text-left text-xs hover:bg-(--color-surface)"
    >
      {badge}
      <span className={tone}>{message}</span>
    </button>
  )
}
