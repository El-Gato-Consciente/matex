import { useState, type ReactNode } from 'react'
import type { Sync } from './useSync'
import { pathProblem, type ContentStorage, type StoragePrefs } from './storagePrefs'

const LABEL: Record<ContentStorage, string> = { matex: 'Matex', drive: 'tu Google Drive' }

/**
 * **Dónde se guardan los proyectos**: Matex (nuestro S3) o el Google Drive del usuario, y en qué
 * carpeta. Cambiar el destino no mueve nada solo: si hay proyectos del otro lado, se pregunta qué
 * hacer con ellos (mudarlos o dejarlos donde están). Tener proyectos de los dos lados es normal.
 */
export function StorageSettings({ sync, onDone }: { sync: Sync; onDone: () => void }) {
  const [draft, setDraft] = useState<StoragePrefs>(sync.prefs)
  const [askMove, setAskMove] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const s3Problem = pathProblem(draft.s3Path)
  const driveProblem = pathProblem(draft.drivePath)
  const needsDrive = draft.defaultStorage === 'drive' && sync.driveStatus !== 'connected'
  const changedDestination = draft.defaultStorage !== sync.prefs.defaultStorage
  const from: ContentStorage = draft.defaultStorage === 'drive' ? 'matex' : 'drive'
  const onOtherSide = sync.counts[from]

  async function connectDrive() {
    setConnecting(true)
    try {
      await sync.connectDrive()
    } finally {
      setConnecting(false)
    }
  }

  function save(move: boolean) {
    sync.setPrefs(draft, move ? from : undefined)
    onDone()
  }

  if (askMove) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-(--color-ink)">
          A partir de ahora, los proyectos nuevos van a <strong>{LABEL[draft.defaultStorage]}</strong>. Tenés{' '}
          <strong>
            {onOtherSide} {onOtherSide === 1 ? 'proyecto' : 'proyectos'}
          </strong>{' '}
          en {LABEL[from]}. ¿Qué hacemos con {onOtherSide === 1 ? 'él' : 'ellos'}?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice title={`${onOtherSide === 1 ? 'Moverlo' : 'Moverlos'} a ${LABEL[draft.defaultStorage]}`} onClick={() => save(true)} primary>
            {onOtherSide === 1 ? 'Se muda' : 'Se mudan de a uno,'} en segundo plano. Si cerrás la pestaña, sigue la próxima vez.
          </Choice>
          <Choice title={onOtherSide === 1 ? 'Dejarlo donde está' : 'Dejarlos donde están'} onClick={() => save(false)}>
            {onOtherSide === 1 ? 'Sigue' : 'Siguen'} en {LABEL[from]}. Podés mover cualquiera después desde su menú ⋯.
          </Choice>
        </div>
        <button type="button" onClick={() => setAskMove(false)} className="self-start text-xs text-(--color-ink-muted) hover:underline">
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-(--color-ink-muted) uppercase">Los proyectos nuevos se guardan en</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <Option
            selected={draft.defaultStorage === 'matex'}
            onClick={() => setDraft({ ...draft, defaultStorage: 'matex' })}
            icon={<CloudGlyph />}
            title="Matex"
          >
            Rápido y sin configurar nada. Hasta 20 MB por proyecto.
          </Option>
          <Option
            selected={draft.defaultStorage === 'drive'}
            onClick={() => setDraft({ ...draft, defaultStorage: 'drive' })}
            icon={<DriveGlyph />}
            title="Tu Google Drive"
          >
            Como archivos <code>.mtex</code> en tu Drive: los ves, los compartís y los respaldás vos.
          </Option>
        </div>
      </div>

      <DriveRow sync={sync} connecting={connecting} onConnect={() => void connectDrive()} highlight={needsDrive} />

      <div className="grid gap-3 sm:grid-cols-2">
        <PathField
          label="Carpeta en Matex"
          value={draft.s3Path}
          problem={s3Problem}
          onChange={(s3Path) => setDraft({ ...draft, s3Path })}
          hint="Dentro de tu espacio. Los proyectos ya guardados no se mueven."
        />
        <PathField
          label="Carpeta en Drive"
          value={draft.drivePath}
          problem={driveProblem}
          onChange={(drivePath) => setDraft({ ...draft, drivePath })}
          hint="Desde la raíz de tu Drive. Adentro se repiten tus carpetas de Matex."
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-(--color-border) pt-4">
        <button type="button" onClick={onDone} className="rounded-md px-3 py-1.5 text-(--color-ink-muted) hover:text-(--color-ink)">
          Cancelar
        </button>
        <button
          type="button"
          disabled={Boolean(s3Problem || driveProblem || needsDrive)}
          title={needsDrive ? 'Primero conectá tu Google Drive' : undefined}
          onClick={() => (changedDestination && onOtherSide > 0 ? setAskMove(true) : save(false))}
          className="rounded-md bg-(--color-primary) px-4 py-1.5 font-medium text-(--color-primary-ink) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

function DriveRow({ sync, connecting, onConnect, highlight }: { sync: Sync; connecting: boolean; onConnect: () => void; highlight: boolean }) {
  const text =
    sync.driveStatus === 'connected'
      ? 'Google Drive conectado. Matex solo ve los archivos que crea él.'
      : sync.driveStatus === 'expired'
        ? 'El permiso de Drive venció (dura una hora). Reconectalo para seguir guardando ahí.'
        : 'Para guardar en Drive, Matex necesita permiso para crear y editar sus propios archivos (no ve el resto de tu Drive).'
  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
        highlight ? 'border-amber-400/60 bg-amber-400/5' : 'border-(--color-border)',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2 text-xs text-(--color-ink-muted)">
        <DriveGlyph />
        {text}
      </span>
      {sync.driveStatus === 'connected' ? (
        <button type="button" onClick={() => void sync.disconnectDrive()} className="text-xs text-(--color-ink-muted) hover:text-(--color-danger)">
          Desconectar
        </button>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="rounded-md border border-(--color-border) px-3 py-1 text-xs font-medium text-(--color-ink) hover:border-(--color-primary) disabled:opacity-50"
        >
          {connecting ? 'Esperando a Google…' : sync.driveStatus === 'expired' ? 'Reconectar Drive' : 'Conectar Google Drive'}
        </button>
      )}
    </div>
  )
}

function Option({ selected, onClick, icon, title, children }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-(--color-primary) bg-(--color-primary)/10' : 'border-(--color-border) hover:border-(--color-ink-muted)',
      ].join(' ')}
    >
      <span className="flex items-center gap-2 font-medium text-(--color-ink)">
        {icon}
        {title}
      </span>
      <span className="text-xs leading-relaxed text-(--color-ink-muted)">{children}</span>
    </button>
  )
}

function Choice({ title, onClick, primary = false, children }: { title: string; onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
        primary ? 'border-(--color-primary) bg-(--color-primary)/10 hover:bg-(--color-primary)/15' : 'border-(--color-border) hover:border-(--color-ink-muted)',
      ].join(' ')}
    >
      <span className="font-medium text-(--color-ink)">{title}</span>
      <span className="text-xs leading-relaxed text-(--color-ink-muted)">{children}</span>
    </button>
  )
}

function PathField({ label, value, problem, onChange, hint }: { label: string; value: string; problem: string | null; onChange: (value: string) => void; hint: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-(--color-ink-muted)">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={[
          'rounded-md border bg-(--color-surface) px-2.5 py-1.5 font-mono text-[13px] text-(--color-ink) outline-none',
          problem ? 'border-(--color-danger)' : 'border-(--color-border) focus:border-(--color-primary)',
        ].join(' ')}
      />
      <span className={problem ? 'text-(--color-danger)' : ''}>{problem ?? hint}</span>
    </label>
  )
}

export function CloudGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  )
}

/** Triángulo de Drive simplificado (genérico, no el logo de Google). */
export function DriveGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3h8l6 10-4 7H6l-4-7 6-10Z" />
      <path d="M8 3l6 10h8M2 13h12l-4 7" />
    </svg>
  )
}
