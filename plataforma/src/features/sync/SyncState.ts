/**
 * **Lo que este navegador sabe de la nube**, por cuenta: qué versión remota corresponde a cada
 * proyecto local y cuándo se sincronizó por última vez. Con eso el motor distingue «lo cambié
 * acá» de «lo cambiaron en otro equipo», sin tocar el modelo de proyecto.
 *
 * También registra **de qué cuenta es cada proyecto**: en una computadora compartida, si entra
 * otra persona, los proyectos de la primera no se suben a la cuenta de la segunda. Los que
 * nunca se sincronizaron no tienen dueño: los adopta la primera cuenta que inicia sesión.
 */

import type { ContentStorage } from './storagePrefs'

export interface ProjectSyncEntry {
  /** Versión remota que corresponde a la copia local. */
  readonly version: number
  /** `updatedAt` local al momento de sincronizar: si cambió, hay cambios sin subir. */
  readonly syncedUpdatedAt: string
  /** Dónde vive su contenido en la nube. */
  readonly storage: ContentStorage
}

interface UserState {
  projects: Record<string, ProjectSyncEntry>
  folders: { version: number; hash: string }
  /**
   * Mudanzas pedidas y todavía no hechas (proyecto → destino). Quedan anotadas hasta que se
   * completan: si se cierra la pestaña a mitad de camino, la próxima pasada sigue.
   */
  moves?: Record<string, ContentStorage>
}

interface Persisted {
  owners: Record<string, string>
  users: Record<string, UserState>
}

const STORAGE_KEY = 'matex.sync.v1'

export class SyncState {
  private readonly storage: Storage
  private data: Persisted

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
    this.data = SyncState.load(storage)
  }

  get(user: string, projectId: string): ProjectSyncEntry | undefined {
    return this.data.users[user]?.projects[projectId]
  }

  set(user: string, projectId: string, entry: ProjectSyncEntry): void {
    this.user(user).projects[projectId] = entry
    this.data.owners[projectId] = user
    this.persist()
  }

  delete(user: string, projectId: string): void {
    delete this.user(user).projects[projectId]
    delete this.data.owners[projectId]
    this.persist()
  }

  /** Pide mudar el contenido del proyecto a `to` (se hace en la próxima pasada). */
  requestMove(user: string, projectId: string, to: ContentStorage): void {
    const state = this.user(user)
    state.moves ??= {}
    if (state.projects[projectId]?.storage === to) delete state.moves[projectId]
    else state.moves[projectId] = to
    this.persist()
  }

  pendingMove(user: string, projectId: string): ContentStorage | undefined {
    return this.data.users[user]?.moves?.[projectId]
  }

  /** Mudanzas que faltan (para mostrar el progreso). */
  pendingMoves(user: string): number {
    return Object.keys(this.data.users[user]?.moves ?? {}).length
  }

  clearMove(user: string, projectId: string): void {
    const moves = this.data.users[user]?.moves
    if (moves && projectId in moves) {
      delete moves[projectId]
      this.persist()
    }
  }

  /** Cuenta dueña del proyecto, o `undefined` si nunca se sincronizó. */
  owner(projectId: string): string | undefined {
    return this.data.owners[projectId]
  }

  folders(user: string): { version: number; hash: string } {
    return this.data.users[user]?.folders ?? { version: 0, hash: '' }
  }

  setFolders(user: string, version: number, hash: string): void {
    this.user(user).folders = { version, hash }
    this.persist()
  }

  /** Proyectos de la cuenta (para «cerrar sesión y quitarlos de este navegador»). */
  ownedBy(user: string): string[] {
    return Object.entries(this.data.owners)
      .filter(([, owner]) => owner === user)
      .map(([projectId]) => projectId)
  }

  /** Olvida todo lo de la cuenta (después de quitar sus proyectos del navegador). */
  forget(user: string): void {
    for (const projectId of this.ownedBy(user)) delete this.data.owners[projectId]
    delete this.data.users[user]
    this.persist()
  }

  private user(user: string): UserState {
    this.data.users[user] ??= { projects: {}, folders: { version: 0, hash: '' } }
    return this.data.users[user]
  }

  private persist(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data))
  }

  private static load(storage: Storage): Persisted {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '') as Partial<Persisted>
      return {
        owners: typeof parsed.owners === 'object' && parsed.owners ? parsed.owners : {},
        users: typeof parsed.users === 'object' && parsed.users ? parsed.users : {},
      }
    } catch {
      return { owners: {}, users: {} }
    }
  }
}
