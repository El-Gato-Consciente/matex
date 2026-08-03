import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { LocalProjectStore } from './LocalProjectStore'

describe('LocalProjectStore · proyectos', () => {
  it('crea un proyecto de un solo archivo', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const project = store.create({ name: 'Doc', mainContent: 'X' })
    expect(project.files).toEqual([{ path: 'main.tex', content: 'X' }])
    expect(project.mainFile).toBe('main.tex')
    expect(project.folderId).toBeNull()
  })

  it('crea un proyecto multi-archivo', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const project = store.create({
      name: 'P',
      files: [
        { path: 'main.tex', content: 'M' },
        { path: 'a.tex', content: 'A' },
      ],
      mainFile: 'main.tex',
    })
    expect(project.files).toHaveLength(2)
  })

  it('updateFiles reemplaza el conjunto y el principal', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const project = store.create({ name: 'P', mainContent: 'X' })
    store.updateFiles(project.id, [{ path: 'doc.tex', content: 'Y' }], 'doc.tex')
    const got = store.get(project.id)
    expect(got?.mainFile).toBe('doc.tex')
    expect(got?.files).toEqual([{ path: 'doc.tex', content: 'Y' }])
  })

  it('rename, moveProject y remove', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const project = store.create({ name: 'A', mainContent: 'X' })
    store.rename(project.id, 'B')
    expect(store.get(project.id)?.name).toBe('B')
    store.moveProject(project.id, 'f1')
    expect(store.get(project.id)?.folderId).toBe('f1')
    store.remove(project.id)
    expect(store.get(project.id)).toBeUndefined()
  })

  it('persiste entre instancias (v2)', () => {
    const storage = createFakeStorage()
    const id = new LocalProjectStore(storage).create({ name: 'A', mainContent: 'X' }).id
    expect(new LocalProjectStore(storage).get(id)?.name).toBe('A')
  })

  it('migra el formato v1 (array de proyectos) a v2', () => {
    const legacy = [
      {
        id: 'p1',
        name: 'Viejo',
        files: [{ path: 'main.tex', content: 'X' }],
        mainFile: 'main.tex',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ]
    const storage = createFakeStorage({ 'matex.projects.v1': JSON.stringify(legacy) })
    const store = new LocalProjectStore(storage)
    const project = store.get('p1')
    expect(project?.name).toBe('Viejo')
    expect(project?.folderId).toBeNull()
    expect(storage.getItem('matex.projects.v2')).not.toBeNull()
  })
})

describe('LocalProjectStore · carpetas', () => {
  it('crea, renombra y lista carpetas', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const folder = store.createFolder('Tareas', null)
    expect(store.listFolders().map((f) => f.name)).toContain('Tareas')
    store.renameFolder(folder.id, 'TPs')
    expect(store.listFolders()[0]?.name).toBe('TPs')
  })

  it('removeFolder sube su contenido a la carpeta padre (no lo borra)', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const parent = store.createFolder('P', null)
    const child = store.createFolder('C', parent.id)
    const project = store.create({ name: 'D', mainContent: 'X', folderId: child.id })
    store.removeFolder(child.id)
    expect(store.get(project.id)?.folderId).toBe(parent.id)
    expect(store.listFolders().find((f) => f.id === child.id)).toBeUndefined()
  })

  it('moveFolder evita ciclos (no se mete dentro de su descendiente)', () => {
    const store = new LocalProjectStore(createFakeStorage())
    const a = store.createFolder('A', null)
    const b = store.createFolder('B', a.id)
    store.moveFolder(a.id, b.id)
    expect(store.listFolders().find((f) => f.id === a.id)?.parentId).toBeNull()
  })
})
