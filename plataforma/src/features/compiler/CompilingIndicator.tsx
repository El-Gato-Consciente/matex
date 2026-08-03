import { useEffect, useState } from 'react'

/**
 * Estado de “compilando” con feedback en vivo: spinner + segundos transcurridos,
 * para que una compilación larga (primera vez, instalación de paquetes) no parezca
 * colgada.
 */
export function CompilingIndicator({ label = 'Compilando…' }: { label?: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-(--color-surface-muted) px-6 text-center">
      <div className="size-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)" />
      <p className="text-sm text-(--color-ink)">
        {label}
        {seconds > 0 ? ` · ${seconds}s` : ''}
      </p>
      <p className="max-w-xs text-xs text-(--color-ink-muted)">
        La primera compilación puede tardar unos segundos mientras se preparan los paquetes de LaTeX.
      </p>
    </div>
  )
}
