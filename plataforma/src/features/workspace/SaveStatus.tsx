import { describeSave, type CloudSave, type SaveTone } from './saveDescription'

interface SaveStatusProps {
  /** ¿El último cambio ya quedó guardado en este navegador? */
  readonly localSaved: boolean
  /** Estado de la nube; `undefined` = sin sesión iniciada. */
  readonly cloud?: CloudSave | undefined
}

const DOT: Readonly<Record<SaveTone, string>> = {
  busy: 'animate-pulse bg-amber-400',
  local: 'bg-sky-400',
  cloud: 'bg-emerald-500',
  warn: 'bg-red-400',
}

/**
 * **Dónde está guardado el documento, ahora.** El guardado es automático (en este navegador a
 * los 0,6 s; en la nube cada 30 s, al cambiar de pestaña y al cerrar): esto solo lo hace visible,
 * para que nadie tenga que preguntarse si puede cerrar la pestaña.
 */
export function SaveStatus({ localSaved, cloud }: SaveStatusProps) {
  const { tone, label, short, detail } = describeSave(localSaved, cloud)
  return (
    <span
      role="status"
      title={`${label}. ${detail}`}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-(--color-ink-muted)"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {/* Completo si hay lugar; corto desde 1400 px; más chico, solo el punto. */}
      <span className="hidden 2xl:inline">{label}</span>
      <span aria-hidden="true" className="hidden min-[1400px]:inline 2xl:hidden">{short}</span>
      <span className="sr-only 2xl:hidden">{label}</span>
    </span>
  )
}
