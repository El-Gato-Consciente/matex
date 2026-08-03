interface CompileStatusProps {
  compiling: boolean
  /** El PDF vigente quedó desactualizado (el fuente cambió desde la última compilación). */
  stale: boolean
  /** Ya se compiló al menos una vez (hay un PDF que mostrar/descargar). */
  compiled: boolean
  onCompile: () => void
}

/**
 * Estado + acción de compilación para el **header** (una sola fuente de verdad, siempre
 * visible — también en modo foco). Combina el indicador «al día / desactualizado / sin
 * compilar» con el botón de compilar, para que descargar el PDF y compilar no se
 * contradigan. Mientras compila muestra un punto pulsante y se deshabilita.
 */
export function CompileStatus({ compiling, stale, compiled, onCompile }: CompileStatusProps) {
  if (compiling) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-3 py-1 text-xs text-(--color-ink-muted)">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Compilando…
      </span>
    )
  }
  const fresh = compiled && !stale
  return (
    <button
      type="button"
      onClick={onCompile}
      title={fresh ? 'PDF al día — recompilar' : stale ? 'El PDF está desactualizado — recompilar' : 'Compilar el PDF'}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium',
        fresh
          ? 'border border-(--color-border) text-(--color-ink-muted) hover:bg-(--color-surface-muted)'
          : 'bg-(--color-primary) text-(--color-primary-ink) hover:opacity-90',
      ].join(' ')}
    >
      {fresh ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Al día
        </>
      ) : stale ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Recompilar
        </>
      ) : (
        'Compilar'
      )}
    </button>
  )
}
