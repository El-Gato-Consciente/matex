import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { LocalProjectStore } from '@/features/documents/LocalProjectStore'
import type { Folder, Project } from '@/features/documents/types'
import type { DriveStore } from './DriveStore'
import { DriveUnavailable } from './DriveStore'
import { SyncConflict, type RemoteIndex, type RemoteProject, type SyncApi } from './SyncApi'
import { SyncState } from './SyncState'
import { DEFAULT_PREFS, type StoragePrefs } from './storagePrefs'
import { driveFolder, syncOnce } from './syncEngine'

/**
 * Nube falsa con la MISMA semántica que la lambda `matex-projects`: versión por proyecto, lock
 * optimista (409), lápidas, carpetas versionadas y `storage` por proyecto (el contenido de los de
 * Drive no está acá). Permite simular dos equipos de la misma cuenta.
 */
class FakeCloud {
  projects = new Map<string, { meta: RemoteProject; content?: Project }>()
  folders: { folders: Folder[]; version: number } = { folders: [], version: 0 }

  api(): SyncApi {
    const commit = (project: Project, baseVersion: number, storage: 'matex' | 'drive') => {
      const current = this.projects.get(project.id)
      if ((current?.meta.version ?? 0) !== baseVersion) throw new SyncConflict()
      const meta: RemoteProject = { id: project.id, version: baseVersion + 1, updatedAt: project.updatedAt, deleted: false, name: project.name, storage }
      this.projects.set(project.id, { meta, ...(storage === 'matex' ? { content: structuredClone(project) } : {}) })
      return meta
    }
    return {
      list: async (): Promise<RemoteIndex> => ({ projects: [...this.projects.values()].map((p) => p.meta), folders: structuredClone(this.folders) }),
      pushToS3: async (project, baseVersion) => commit(project, baseVersion, 'matex'),
      commitDrive: async (project, baseVersion) => commit(project, baseVersion, 'drive'),
      pull: async (id) => structuredClone(this.projects.get(id)!.content),
      remove: async (id) => {
        const current = this.projects.get(id)
        if (current) this.projects.set(id, { meta: { id, version: current.meta.version + 1, updatedAt: 'x', deleted: true } })
      },
      putFolders: async (folders, baseVersion) => {
        if (this.folders.version !== baseVersion) throw new SyncConflict()
        this.folders = { folders: structuredClone([...folders]), version: baseVersion + 1 }
        return { version: this.folders.version }
      },
    }
  }
}

/** El Drive del usuario, compartido por sus equipos (cada uno con su permiso). */
class FakeDriveFiles {
  files = new Map<string, { project: Project; folder: string[]; trashed?: boolean }>()
  available = true

  store(): DriveStore {
    const check = () => {
      if (!this.available) throw new DriveUnavailable()
    }
    return {
      save: async (project: Project, folder: readonly string[]) => {
        check()
        this.files.set(project.id, { project: structuredClone(project), folder: [...folder] })
        return 100
      },
      load: async (id: string) => {
        check()
        const file = this.files.get(id)
        return file && !file.trashed ? structuredClone(file.project) : undefined
      },
      remove: async (id: string) => {
        check()
        const file = this.files.get(id)
        if (file) file.trashed = true
      },
    } as unknown as DriveStore
  }
}

/** Un «equipo»: su propio localStorage, store y estado de sync, contra la nube compartida. */
function device(cloud: FakeCloud, options: { user?: string; prefs?: Partial<StoragePrefs>; drive?: FakeDriveFiles | null } = {}) {
  const storage = createFakeStorage()
  const store = new LocalProjectStore(storage)
  const state = new SyncState(storage)
  const prefs = { ...DEFAULT_PREFS, ...options.prefs }
  const sync = (isBusy?: (id: string) => boolean) =>
    syncOnce({
      api: cloud.api(),
      store,
      state,
      user: options.user ?? 'ana',
      prefs,
      drive: options.drive ? options.drive.store() : null,
      ...(isBusy ? { isBusy } : {}),
    })
  return { store, state, sync }
}

/** Fuerza un `updatedAt` distinto (en el test todo pasa en el mismo milisegundo). */
function touch(store: LocalProjectStore, id: string, name: string) {
  const project = store.get(id)!
  store.put({ ...project, name, updatedAt: new Date(Date.parse(project.updatedAt) + 1000).toISOString() })
}

const quiet = { pushed: 0, pulled: 0, removedHere: 0, removedThere: 0, conflicts: 0, moved: 0, driveUnavailable: false, missingInDrive: [] }

describe('syncOnce', () => {
  let cloud: FakeCloud
  beforeEach(() => {
    cloud = new FakeCloud()
  })

  it('sube lo local nuevo y lo trae en otro equipo', async () => {
    const a = device(cloud)
    const project = a.store.create({ name: 'Apunte', mainContent: 'x' })
    expect((await a.sync()).pushed).toBe(1)

    const b = device(cloud)
    expect((await b.sync()).pulled).toBe(1)
    expect(b.store.get(project.id)?.name).toBe('Apunte')
  })

  it('una segunda pasada sin cambios no hace nada', async () => {
    const a = device(cloud)
    a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    expect(await a.sync()).toEqual(quiet)
  })

  it('un cambio en un equipo llega al otro', async () => {
    const a = device(cloud)
    const { id } = a.store.create({ name: 'v1', mainContent: 'x' })
    await a.sync()
    const b = device(cloud)
    await b.sync()

    touch(a.store, id, 'v2')
    await a.sync()
    expect((await b.sync()).pulled).toBe(1)
    expect(b.store.get(id)?.name).toBe('v2')
  })

  it('si los dos cambian lo mismo, no se pierde nada: queda una copia en conflicto', async () => {
    const a = device(cloud)
    const { id } = a.store.create({ name: 'base', mainContent: 'x' })
    await a.sync()
    const b = device(cloud)
    await b.sync()

    touch(a.store, id, 'desde A')
    await a.sync()
    touch(b.store, id, 'desde B')
    const report = await b.sync()

    expect(report.conflicts).toBe(1)
    expect(b.store.get(id)?.name).toBe('desde A') // el original trae lo de la nube…
    expect(b.store.list().some((p) => p.name === 'desde B (copia en conflicto)')).toBe(true) // …y lo local sigue
  })

  it('borrar en un equipo borra en el otro', async () => {
    const a = device(cloud)
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    const b = device(cloud)
    await b.sync()

    a.store.remove(id)
    expect((await a.sync()).removedThere).toBe(1)
    expect((await b.sync()).removedHere).toBe(1)
    expect(b.store.get(id)).toBeUndefined()
  })

  it('no le pisa el contenido al proyecto que está abierto en el editor', async () => {
    const a = device(cloud)
    const { id } = a.store.create({ name: 'v1', mainContent: 'x' })
    await a.sync()
    const b = device(cloud)
    await b.sync()
    touch(a.store, id, 'v2')
    await a.sync()

    await b.sync((projectId) => projectId === id)
    expect(b.store.get(id)?.name).toBe('v1')
    await b.sync()
    expect(b.store.get(id)?.name).toBe('v2') // al cerrarlo, se pone al día
  })

  it('en una computadora compartida no sube los proyectos de otra cuenta', async () => {
    const storage = createFakeStorage()
    const store = new LocalProjectStore(storage)
    const state = new SyncState(storage)
    store.create({ name: 'De Ana', mainContent: 'x' })
    await syncOnce({ api: cloud.api(), store, state, user: 'ana', prefs: DEFAULT_PREFS, drive: null })

    const otherCloud = new FakeCloud()
    const report = await syncOnce({ api: otherCloud.api(), store, state, user: 'beto', prefs: DEFAULT_PREFS, drive: null })
    expect(report.pushed).toBe(0)
    expect(otherCloud.projects.size).toBe(0)
  })

  it('sincroniza las carpetas y une los cambios de los dos lados', async () => {
    const a = device(cloud)
    a.store.createFolder('Análisis', null)
    await a.sync()
    const b = device(cloud)
    await b.sync()
    expect(b.store.listFolders().map((f) => f.name)).toEqual(['Análisis'])

    a.store.createFolder('Álgebra', null)
    await a.sync()
    b.store.createFolder('Física', null)
    await b.sync()
    expect(b.store.listFolders().map((f) => f.name).sort()).toEqual(['Análisis', 'Física', 'Álgebra'].sort())
    await a.sync()
    expect(a.store.listFolders()).toHaveLength(3)
  })
})

describe('syncOnce · Google Drive', () => {
  let cloud: FakeCloud
  let drive: FakeDriveFiles
  beforeEach(() => {
    cloud = new FakeCloud()
    drive = new FakeDriveFiles()
  })

  it('con Drive por defecto, lo nuevo va a Drive y el índice solo anota la versión', async () => {
    const a = device(cloud, { prefs: { defaultStorage: 'drive' }, drive })
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    expect(drive.files.get(id)?.project.name).toBe('Apunte')
    expect(cloud.projects.get(id)?.meta.storage).toBe('drive')
    expect(cloud.projects.get(id)?.content).toBeUndefined() // nada en nuestro S3
  })

  it('otro equipo lo trae desde Drive', async () => {
    const a = device(cloud, { prefs: { defaultStorage: 'drive' }, drive })
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    const b = device(cloud, { drive }) // su preferencia es S3, pero el proyecto vive en Drive
    expect((await b.sync()).pulled).toBe(1)
    expect(b.store.get(id)?.name).toBe('Apunte')
  })

  it('mudar de S3 a Drive, y de vuelta', async () => {
    const a = device(cloud, { drive })
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    expect(cloud.projects.get(id)?.meta.storage).toBe('matex')

    a.state.requestMove('ana', id, 'drive')
    expect((await a.sync()).moved).toBe(1)
    expect(cloud.projects.get(id)?.meta.storage).toBe('drive')
    expect(drive.files.get(id)?.trashed).toBeUndefined()

    a.state.requestMove('ana', id, 'matex')
    await a.sync()
    expect(cloud.projects.get(id)?.meta.storage).toBe('matex')
    expect(drive.files.get(id)?.trashed).toBe(true) // el de Drive, a la papelera
  })

  it('una mudanza cortada sigue en la próxima pasada', async () => {
    const a = device(cloud, { drive })
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    a.state.requestMove('ana', id, 'drive')
    drive.available = false
    const cut = await a.sync()
    expect(cut.driveUnavailable).toBe(true)
    expect(a.state.pendingMoves('ana')).toBe(1)

    drive.available = true
    expect((await a.sync()).moved).toBe(1)
    expect(a.state.pendingMoves('ana')).toBe(0)
  })

  it('sin Drive disponible, lo de Drive espera pero lo demás se sincroniza igual', async () => {
    const a = device(cloud, { prefs: { defaultStorage: 'drive' }, drive: null })
    a.store.create({ name: 'Para Drive', mainContent: 'x' })
    const report = await a.sync()
    expect(report.driveUnavailable).toBe(true)
    expect(report.pushed).toBe(0)

    const b = device(cloud) // otro equipo, S3: no se ve afectado
    b.store.create({ name: 'En S3', mainContent: 'y' })
    expect((await b.sync()).pushed).toBe(1)
  })

  it('si borraron el archivo directo en Drive, se repone desde la copia local', async () => {
    const a = device(cloud, { prefs: { defaultStorage: 'drive' }, drive })
    const { id } = a.store.create({ name: 'Apunte', mainContent: 'x' })
    await a.sync()
    const b = device(cloud, { drive })
    await b.sync()

    drive.files.get(id)!.trashed = true // lo borraron desde Drive
    touch(a.store, id, 'v2') // y A sigue trabajando
    await a.sync()
    expect(drive.files.get(id)?.trashed).toBeUndefined() // repuesto con la versión de A
    await b.sync()
    expect(b.store.get(id)?.name).toBe('v2')
  })

  it('en Drive replica el árbol de carpetas de Matex debajo de la carpeta elegida', () => {
    const folders: Folder[] = [
      { id: 'f1', name: 'Facultad', parentId: null, createdAt: 'x' },
      { id: 'f2', name: 'Análisis/2', parentId: 'f1', createdAt: 'x' },
    ]
    expect(driveFolder({ ...DEFAULT_PREFS, drivePath: 'Mis cosas/Matex' }, folders, { folderId: 'f2' })).toEqual([
      'Mis cosas',
      'Matex',
      'Facultad',
      'Análisis-2',
    ])
  })
})
