import { useEffect, useRef, useState, type ReactNode } from 'react'
import { relativeTime } from '@/lib/relativeTime'
import type { Sync } from '@/features/sync/useSync'
import { CloudGlyph, DriveGlyph, StorageSettings } from '@/features/sync/StorageSettings'
import { Modal } from '@/components/Modal'
import { useAccount } from './account'

/**
 * Cuenta en el header. Sin sesión: «Sincronizar», que explica para qué sirve y muestra el botón
 * oficial de Google (iniciar sesión es opcional: sin cuenta todo sigue en este navegador). Con
 * sesión: la foto con el estado de la sincronización, y las acciones.
 */
export function AccountMenu({ sync }: { sync: Sync }) {
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [storageOpen, setStorageOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic afuera o con Esc. (Popover propio y no un menú de Radix: el botón de
  // Google vive en un iframe y el menú se cerraría al recibir el foco del iframe.)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (account.status === 'disabled') return null

  const user = account.user
  const signedIn = account.status === 'signed-in' && user

  return (
    <div ref={rootRef} className="relative shrink-0">
      {signedIn ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Cuenta de ${user.name || user.email}`}
          aria-expanded={open}
          className="relative grid size-8 place-items-center rounded-full ring-1 ring-(--color-border) hover:ring-(--color-primary)"
        >
          <Avatar user={user} />
          <StatusDot status={sync.status} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) px-2.5 py-1 text-xs text-(--color-ink-muted) hover:border-(--color-primary) hover:text-(--color-ink)"
        >
          <CloudIcon />
          {account.status === 'expired' ? 'Reconectar' : 'Sincronizar'}
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-sm shadow-2xl">
          {signedIn ? (
            <SignedInPanel
              sync={sync}
              onDone={() => setOpen(false)}
              onOpenStorage={() => {
                setOpen(false)
                setStorageOpen(true)
              }}
            />
          ) : (
            <SignInPanel expired={account.status === 'expired'} />
          )}
        </div>
      )}

      <Modal open={storageOpen} onClose={() => setStorageOpen(false)} title="Dónde se guardan tus proyectos" width="max-w-2xl">
        <StorageSettings sync={sync} onDone={() => setStorageOpen(false)} />
      </Modal>
    </div>
  )
}

function SignInPanel({ expired }: { expired: boolean }) {
  const account = useAccount()
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (buttonRef.current) account.renderSignInButton(buttonRef.current)
  }, [account])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-semibold text-(--color-ink)">{expired ? 'Tu sesión venció' : 'Tus proyectos, en todos tus equipos'}</p>
        <p className="mt-1 text-xs leading-relaxed text-(--color-ink-muted)">
          {expired
            ? 'Volvé a entrar para seguir sincronizando. Mientras tanto, todo se sigue guardando en este navegador.'
            : 'Entrá con Google para guardar tus proyectos en la nube y abrirlos desde cualquier lado. Es opcional: sin cuenta, todo sigue funcionando en este navegador.'}
        </p>
      </div>
      <div ref={buttonRef} className="min-h-10" />
      <p className="text-[11px] text-(--color-ink-muted)">La misma cuenta sirve para todos los sitios de El Gato Consciente.</p>
    </div>
  )
}

function SignedInPanel({ sync, onDone, onOpenStorage }: { sync: Sync; onDone: () => void; onOpenStorage: () => void }) {
  const account = useAccount()
  const user = account.user!
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-(--color-border)">
          <Avatar user={user} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-(--color-ink)">{user.name || 'Tu cuenta'}</p>
          <p className="truncate text-xs text-(--color-ink-muted)">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-(--color-surface-muted) px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-(--color-ink-muted)">
          <span className="relative size-2 shrink-0">
            <StatusDot status={sync.status} inline />
          </span>
          <span className="truncate">{statusText(sync)}</span>
        </span>
        <button
          type="button"
          onClick={sync.syncNow}
          disabled={sync.status === 'syncing'}
          className="shrink-0 rounded px-1.5 py-0.5 text-(--color-primary) hover:underline disabled:opacity-50"
        >
          Sincronizar ahora
        </button>
      </div>

      {/* Dónde se guardan los nuevos (Matex o Drive), y avisos de Drive y mudanzas. */}
      <button
        type="button"
        onClick={onOpenStorage}
        className="flex items-center justify-between gap-2 rounded-lg border border-(--color-border) px-3 py-2 text-left text-xs hover:border-(--color-primary)"
      >
        <span className="flex min-w-0 items-center gap-2 text-(--color-ink-muted)">
          {sync.prefs.defaultStorage === 'drive' ? <DriveGlyph /> : <CloudGlyph />}
          <span className="truncate">
            Guardar en <strong className="text-(--color-ink)">{sync.prefs.defaultStorage === 'drive' ? 'Google Drive' : 'Matex'}</strong>
            {' · '}
            <span className="font-mono">{sync.prefs.defaultStorage === 'drive' ? sync.prefs.drivePath : sync.prefs.s3Path}</span>
          </span>
        </span>
        <span className="shrink-0 text-(--color-primary)">Cambiar</span>
      </button>
      {sync.driveStatus === 'expired' && (sync.counts.drive > 0 || sync.prefs.defaultStorage === 'drive') && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/50 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
          <span>El permiso de Drive venció: los cambios de esos proyectos esperan.</span>
          <button type="button" onClick={() => void sync.connectDrive()} className="shrink-0 font-medium underline">
            Reconectar
          </button>
        </div>
      )}
      {sync.pendingMoves > 0 && (
        <p className="text-xs text-(--color-ink-muted)">
          Moviendo proyectos… {sync.pendingMoves === 1 ? 'falta 1' : `faltan ${sync.pendingMoves}`}.
        </p>
      )}

      <div className="flex flex-col border-t border-(--color-border) pt-2">
        <MenuButton
          onClick={() => {
            account.signOut()
            onDone()
          }}
        >
          Cerrar sesión
        </MenuButton>
        <MenuButton
          danger
          onClick={() => {
            sync.signOutAndClear()
            onDone()
          }}
        >
          Cerrar sesión y quitar mis proyectos de este navegador
        </MenuButton>
      </div>
    </div>
  )
}

function statusText(sync: Sync): string {
  if (sync.status === 'syncing') return 'Sincronizando…'
  if (sync.status === 'error') return `No se pudo sincronizar${sync.error ? `: ${sync.error}` : ''}`
  if (sync.lastSyncedAt) return `Sincronizado ${relativeTime(sync.lastSyncedAt.toISOString())}`
  return 'Todavía sin sincronizar'
}

function MenuButton({ onClick, danger = false, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-2 py-1.5 text-left text-xs hover:bg-(--color-surface-muted)',
        danger ? 'text-(--color-danger)' : 'text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Avatar({ user }: { user: { name: string; email: string; picture: string } }) {
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()
  return user.picture ? (
    // `no-referrer`: las fotos de Google a veces fallan si viajan con el referer del sitio.
    <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center rounded-full bg-(--color-primary) text-xs font-semibold text-(--color-primary-ink)">
      {initial}
    </span>
  )
}

function StatusDot({ status, inline = false }: { status: Sync['status']; inline?: boolean }) {
  const color =
    status === 'syncing' ? 'bg-sky-400 animate-pulse' : status === 'error' ? 'bg-(--color-danger)' : status === 'synced' ? 'bg-(--color-success)' : 'bg-(--color-ink-muted)'
  return (
    <span
      aria-hidden="true"
      className={[
        'block size-2 rounded-full',
        color,
        inline ? '' : 'absolute -right-0.5 -bottom-0.5 ring-2 ring-(--color-surface)',
      ].join(' ')}
    />
  )
}

function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  )
}
