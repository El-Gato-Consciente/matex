import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from '@/features/account/account'
import { DriveAccess, type DriveStatus } from '@/features/account/driveAccess'
import type { ProjectStore } from '@/features/documents/ProjectStore'
import { DriveStore } from './DriveStore'
import { HttpSyncApi, SyncUnauthorized } from './SyncApi'
import { SyncState } from './SyncState'
import { DEFAULT_PREFS, loadPrefs, savePrefs, type ContentStorage, type StoragePrefs } from './storagePrefs'
import { syncOnce } from './syncEngine'

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'

export interface Sync {
  readonly status: SyncStatus
  readonly lastSyncedAt: Date | null
  readonly error: string | null
  /** Dónde se guardan los proyectos nuevos y en qué carpetas. */
  readonly prefs: StoragePrefs
  readonly driveStatus: DriveStatus
  /** Mudanzas pedidas que todavía no se completaron. */
  readonly pendingMoves: number
  /** Proyectos de la cuenta en cada lado (para el diálogo de «¿qué hacemos con los que ya están?»). */
  readonly counts: Readonly<Record<ContentStorage, number>>
  syncNow(): void
  /** Guarda la preferencia; con `moveFrom`, además muda los proyectos que estaban de ese lado. */
  setPrefs(prefs: StoragePrefs, moveFrom?: ContentStorage): void
  /** Dónde vive un proyecto (`undefined` si todavía no se sincronizó). */
  storageOf(projectId: string): ContentStorage | undefined
  /** ¿La copia de la nube es la misma que la guardada en este navegador? */
  isSynced(projectId: string): boolean
  /** ¿Tiene una mudanza pendiente? */
  isMoving(projectId: string): boolean
  moveProject(projectId: string, to: ContentStorage): void
  /** Pide o renueva el permiso de Drive. **Llamar desde un clic** (abre la ventana de Google). */
  connectDrive(): Promise<boolean>
  disconnectDrive(): Promise<void>
  /** Cierra sesión y saca de este navegador los proyectos de la cuenta (computadora compartida). */
  signOutAndClear(): void
}

/** Cada cuánto se sincroniza solo mientras hay sesión. */
const INTERVAL_MS = 30_000

interface UseSyncOptions {
  readonly account: Account
  readonly store: ProjectStore
  readonly apiBaseUrl: string | undefined
  readonly googleClientId: string | undefined
  /** Proyecto abierto en el editor: no se le pisa el contenido mientras se edita. */
  readonly isBusy: (projectId: string) => boolean
  /** La sincronización cambió proyectos o carpetas locales: la UI tiene que releerlos. */
  readonly onChange: () => void
}

/**
 * Corre `syncOnce` mientras hay sesión: al iniciarla, cada 30 s, al volver a la pestaña y al
 * dejarla. Sin sesión no hace nada (la app sigue 100 % local). Nunca corren dos pasadas a la vez.
 * También expone la preferencia de guardado (Matex o Drive), el permiso de Drive y las mudanzas.
 */
export function useSync({ account, store, apiBaseUrl, googleClientId, isBusy, onChange }: UseSyncOptions): Sync {
  const state = useMemo(() => new SyncState(), [])
  const api = useMemo(
    () => (apiBaseUrl ? new HttpSyncApi({ baseUrl: apiBaseUrl, getToken: account.getToken }) : null),
    [apiBaseUrl, account.getToken],
  )
  const user = account.status === 'signed-in' ? account.user?.sub : undefined
  const email = account.user?.email ?? ''
  const driveAccess = useMemo(
    () => (user && googleClientId ? new DriveAccess(googleClientId, { sub: user, email }) : null),
    [user, email, googleClientId],
  )
  const drive = useMemo(() => (driveAccess ? new DriveStore(driveAccess) : null), [driveAccess])

  const [status, setStatus] = useState<SyncStatus>('off')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefsState] = useState<StoragePrefs>(DEFAULT_PREFS)
  // Contador que se toca cuando cambia algo de `SyncState` que la UI muestra (mudanzas, dónde vive).
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision((value) => value + 1)
  const running = useRef(false)
  const latest = useRef({ isBusy, onChange, account, prefs })
  latest.current = { isBusy, onChange, account, prefs }

  useEffect(() => {
    setPrefsState(user ? loadPrefs(user) : DEFAULT_PREFS)
  }, [user])

  const run = useCallback(async () => {
    if (!api || !user || running.current) return
    running.current = true
    setStatus('syncing')
    try {
      const report = await syncOnce({
        api,
        store,
        state,
        user,
        prefs: latest.current.prefs,
        drive,
        isBusy: (id) => latest.current.isBusy(id),
      })
      if (report.pulled || report.removedHere || report.conflicts) latest.current.onChange()
      setStatus('synced')
      setLastSyncedAt(new Date())
      setError(null)
    } catch (cause) {
      if (cause instanceof SyncUnauthorized) {
        latest.current.account.markExpired()
        setStatus('off')
      } else {
        setStatus('error')
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      running.current = false
      bump()
    }
  }, [api, user, store, state, drive])

  useEffect(() => {
    if (!user) {
      setStatus('off')
      return
    }
    void run()
    const timer = window.setInterval(() => void run(), INTERVAL_MS)
    const onFocus = () => void run()
    const onHide = () => {
      if (document.visibilityState === 'hidden') void run()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [user, run])

  const projectIds = useCallback(() => (user ? state.ownedBy(user) : []), [state, user])

  const counts = useMemo(() => {
    const out: Record<ContentStorage, number> = { matex: 0, drive: 0 }
    if (!user) return out
    for (const id of projectIds()) {
      const storage = state.get(user, id)?.storage
      if (storage) out[storage] += 1
    }
    return out
    // `revision` hace que se recalcule cuando cambia el estado de sincronización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, state, projectIds, revision])

  const signOutAndClear = useCallback(() => {
    const sub = latest.current.account.user?.sub
    if (sub) {
      for (const projectId of state.ownedBy(sub)) store.remove(projectId)
      state.forget(sub)
      latest.current.onChange()
    }
    latest.current.account.signOut()
  }, [state, store])

  return {
    status,
    lastSyncedAt,
    error,
    prefs,
    driveStatus: driveAccess?.status() ?? 'disconnected',
    pendingMoves: user ? state.pendingMoves(user) : 0,
    counts,
    syncNow: () => void run(),
    setPrefs: (next, moveFrom) => {
      if (!user) return
      savePrefs(user, next)
      setPrefsState(loadPrefs(user))
      latest.current.prefs = loadPrefs(user)
      if (moveFrom) {
        for (const id of projectIds()) {
          if (state.get(user, id)?.storage === moveFrom) state.requestMove(user, id, next.defaultStorage)
        }
      }
      bump()
      void run()
    },
    storageOf: (projectId) => (user ? state.get(user, projectId)?.storage : undefined),
    isSynced: (projectId) => {
      const entry = user ? state.get(user, projectId) : undefined
      return entry !== undefined && entry.syncedUpdatedAt === store.get(projectId)?.updatedAt
    },
    isMoving: (projectId) => (user ? state.pendingMove(user, projectId) !== undefined : false),
    moveProject: (projectId, to) => {
      if (!user) return
      state.requestMove(user, projectId, to)
      bump()
      void run()
    },
    connectDrive: async () => {
      const ok = (await driveAccess?.connect()) ?? false
      bump()
      if (ok) void run()
      return ok
    },
    disconnectDrive: async () => {
      await driveAccess?.disconnect()
      bump()
    },
    signOutAndClear,
  }
}
