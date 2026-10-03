import type { ProjectStore } from '@/features/documents/ProjectStore'
import type { Folder, Project } from '@/features/documents/types'
import { DriveUnavailable, type DriveStore } from './DriveStore'
import { SyncConflict, type RemoteProject, type SyncApi } from './SyncApi'
import type { SyncState } from './SyncState'
import { pathSegments, type ContentStorage, type StoragePrefs } from './storagePrefs'

/**
 * **Una pasada de sincronización**: reconcilia los proyectos de este navegador con los de la
 * cuenta. Lo local sigue siendo la fuente de la app (se trabaja igual sin conexión); esto solo
 * lleva y trae.
 *
 * Por proyecto, comparando la copia local con lo que `SyncState` recuerda de la última vez:
 *
 *   | local                    | remoto                  | qué se hace                          |
 *   |--------------------------|-------------------------|--------------------------------------|
 *   | cambió                   | igual que la última vez | se sube                              |
 *   | igual                    | avanzó (otro equipo)    | se baja                              |
 *   | cambió                   | avanzó                  | conflicto: se guarda la copia local  |
 *   |                          |                         | aparte y se baja la remota           |
 *   | no existe, se conocía    | existe                  | se borró acá → se borra allá         |
 *   | no existe, no se conocía | existe                  | es de otro equipo → se baja          |
 *   | existe                   | lápida                  | se borró allá → se borra acá (salvo  |
 *   |                          |                         | que tenga cambios: entonces se sube) |
 *   | existe                   | no está                 | es nuevo → se sube                   |
 *
 * **Dónde vive cada proyecto** (nuestro S3 o el Drive del usuario) lo recuerda `SyncState`; los
 * nuevos van a donde diga la preferencia. Una **mudanza** pedida es una subida más, al otro lado;
 * queda anotada hasta completarse, así que si se corta, la próxima pasada sigue.
 *
 * Si Drive no está disponible (permiso vencido o revocado), solo se postergan los proyectos que
 * viven ahí: el resto se sincroniza igual y el informe lo avisa (`driveUnavailable`).
 *
 * **Nunca se pierde trabajo**: ante la duda, se conserva la copia local como proyecto aparte.
 */

export interface SyncDeps {
  readonly api: SyncApi
  readonly store: ProjectStore
  readonly state: SyncState
  /** `sub` de la cuenta (Google). */
  readonly user: string
  readonly prefs: StoragePrefs
  /** Contenido en Google Drive; `null` si el usuario no conectó Drive. */
  readonly drive: DriveStore | null
  /** Proyecto abierto en el editor: no se le pisa el contenido mientras se edita. */
  readonly isBusy?: (projectId: string) => boolean
}

export interface SyncReport {
  pushed: number
  pulled: number
  removedHere: number
  removedThere: number
  conflicts: number
  moved: number
  /** Hubo proyectos de Drive que no se pudieron sincronizar: hay que reconectar Drive. */
  driveUnavailable: boolean
  /** Proyectos de Drive cuyo archivo ya no está en el Drive y no había copia acá para reponerlo. */
  missingInDrive: string[]
}

export async function syncOnce(deps: SyncDeps): Promise<SyncReport> {
  const { api, store, state, user, prefs, drive } = deps
  const isBusy = deps.isBusy ?? (() => false)
  const report: SyncReport = {
    pushed: 0,
    pulled: 0,
    removedHere: 0,
    removedThere: 0,
    conflicts: 0,
    moved: 0,
    driveUnavailable: false,
    missingInDrive: [],
  }

  const remote = await api.list()
  const remoteById = new Map(remote.projects.map((project) => [project.id, project]))
  // Los proyectos de OTRA cuenta que quedaron en este navegador no se tocan.
  const locals = store.list().filter((project) => {
    const owner = state.owner(project.id)
    return owner === undefined || owner === user
  })
  const localById = new Map(locals.map((project) => [project.id, project]))

  const isDirty = (project: Project): boolean => state.get(user, project.id)?.syncedUpdatedAt !== project.updatedAt
  const storageOf = (id: string, entry?: RemoteProject): ContentStorage | undefined =>
    state.get(user, id)?.storage ?? entry?.storage

  /** Corre una operación; si Drive no está disponible, la posterga en vez de cortar la pasada. */
  const attempt = async (operation: () => Promise<void>): Promise<void> => {
    try {
      await operation()
    } catch (error) {
      if (error instanceof DriveUnavailable) report.driveUnavailable = true
      else if (error instanceof SyncConflict) report.conflicts += 1 // la próxima pasada lo resuelve
      else throw error
    }
  }

  const needDrive = (): DriveStore => {
    if (!drive) throw new DriveUnavailable()
    return drive
  }

  const push = (project: Project, baseVersion: number, entry?: RemoteProject) =>
    attempt(async () => {
      const from = storageOf(project.id, entry)
      const to = state.pendingMove(user, project.id) ?? from ?? prefs.defaultStorage
      const saved =
        to === 'drive'
          ? await api.commitDrive(project, baseVersion, await needDrive().save(project, driveFolder(prefs, store.listFolders(), project)))
          : await api.pushToS3(project, baseVersion, prefs.s3Path)
      state.set(user, project.id, { version: saved.version, syncedUpdatedAt: project.updatedAt, storage: to })
      if (state.pendingMove(user, project.id)) {
        state.clearMove(user, project.id)
        report.moved += 1
      }
      // Se mudó de Drive a S3: el archivo de Drive va a la papelera (S3 lo limpia la lambda).
      if (from === 'drive' && to === 'matex' && drive) await drive.remove(project.id).catch(() => {})
      report.pushed += 1
    })

  const pull = (entry: RemoteProject, local?: Project) =>
    attempt(async () => {
      const storage = entry.storage ?? 'matex'
      const content = storage === 'drive' ? await needDrive().load(entry.id) : await api.pull(entry.id)
      if (content === undefined) {
        // Borraron el archivo directo en Drive. Si hay copia acá, se repone; si no, se avisa.
        if (local && storage === 'drive') await push(local, entry.version, entry)
        else report.missingInDrive.push(entry.id)
        return
      }
      if (!store.put(content)) return
      const saved = store.get(entry.id)
      if (saved) state.set(user, entry.id, { version: entry.version, syncedUpdatedAt: saved.updatedAt, storage })
      report.pulled += 1
    })

  // ── Lo que hay en la nube ──
  for (const entry of remote.projects) {
    const local = localById.get(entry.id)
    const known = state.get(user, entry.id)

    if (entry.deleted) {
      if (!local) {
        if (known) state.delete(user, entry.id)
      } else if (isDirty(local)) {
        await push(local, entry.version, entry) // se borró allá pero acá tiene cambios: vuelve
      } else if (!isBusy(entry.id)) {
        store.remove(entry.id)
        state.delete(user, entry.id)
        report.removedHere += 1
      }
      continue
    }

    if (!local) {
      if (known) {
        await attempt(async () => {
          // Se borró en este navegador: allá también (el archivo de Drive, a la papelera).
          if (known.storage === 'drive') await needDrive().remove(entry.id)
          await api.remove(entry.id)
          state.delete(user, entry.id)
          report.removedThere += 1
        })
      } else if (state.owner(entry.id) === undefined) {
        await pull(entry) // viene de otro equipo
      }
      continue
    }

    if (known && entry.version === known.version) {
      if (isDirty(local) || state.pendingMove(user, entry.id)) await push(local, entry.version, entry)
      continue
    }

    // La nube avanzó (o nunca se sincronizó en este navegador con este id).
    if (isBusy(entry.id)) continue
    if (isDirty(local)) {
      // Conflicto: la copia local queda como proyecto aparte; el original trae lo de la nube.
      store.create({
        name: `${local.name} (copia en conflicto)`,
        kind: local.kind,
        files: local.files,
        mainFile: local.mainFile,
        folderId: local.folderId,
        ...(local.ast ? { ast: local.ast } : {}),
      })
      report.conflicts += 1
    }
    await pull(entry, local)
  }

  // ── Lo que solo está acá: nuevo, se sube (a donde diga la preferencia) ──
  for (const local of locals) {
    if (!remoteById.has(local.id)) await push(local, 0)
  }

  await syncFolders(deps, remote.folders)
  return report
}

/**
 * Carpeta de Drive de un proyecto: la elegida por el usuario + el árbol de carpetas de Matex
 * (`Matex/Facultad/Análisis`), para que en Drive se vea igual que en la app.
 */
export function driveFolder(prefs: StoragePrefs, folders: readonly Folder[], project: Pick<Project, 'folderId'>): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const chain: string[] = []
  let current = project.folderId ? byId.get(project.folderId) : undefined
  while (current && chain.length < 32) {
    chain.unshift(current.name.replace(/\//g, '-'))
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return [...pathSegments(prefs.drivePath), ...chain]
}

/**
 * Carpetas: el árbol entero es un solo ítem con su versión. Si solo cambió de un lado, gana ese
 * lado; si cambiaron los dos, se unen (por id; los nombres de la nube ganan).
 */
async function syncFolders(deps: SyncDeps, remote: { folders: readonly unknown[]; version: number }): Promise<void> {
  const { api, store, state, user } = deps
  const local = store.listFolders()
  const localHash = folderHash(local)
  const known = state.folders(user)
  const changedHere = localHash !== known.hash

  try {
    if (remote.version === known.version) {
      if (!changedHere) return
      if (remote.version === 0 && local.length === 0) {
        state.setFolders(user, 0, localHash) // nada que subir todavía
        return
      }
      const saved = await api.putFolders(local, remote.version)
      state.setFolders(user, saved.version, localHash)
      return
    }

    // La nube avanzó.
    if (!changedHere) {
      store.replaceFolders(remote.folders)
      state.setFolders(user, remote.version, folderHash(store.listFolders()))
      return
    }
    const merged = new Map(local.map((folder) => [folder.id, folder] as const))
    store.replaceFolders(remote.folders)
    for (const folder of store.listFolders()) merged.set(folder.id, folder)
    store.replaceFolders([...merged.values()])
    const saved = await api.putFolders(store.listFolders(), remote.version)
    state.setFolders(user, saved.version, folderHash(store.listFolders()))
  } catch (error) {
    if (!(error instanceof SyncConflict)) throw error // conflicto: lo resuelve la próxima pasada
  }
}

function folderHash(folders: readonly Folder[]): string {
  return JSON.stringify(
    [...folders]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, name, parentId, createdAt }) => [id, name, parentId, createdAt]),
  )
}
