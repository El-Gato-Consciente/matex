import { describe, expect, it } from 'vitest'
import type { Project } from '@/features/documents/types'
import { DriveStore, DriveUnavailable } from './DriveStore'

/** Drive falso: lo justo de la API v3 que usa `DriveStore` (consultas `q`, multipart, papelera). */
class FakeDrive {
  files = new Map<string, { name: string; mimeType: string; parents: string[]; appProperties?: Record<string, string>; content?: string; trashed?: boolean }>()
  private next = 1
  requests: string[] = []

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    this.requests.push(`${method} ${url.pathname}`)
    if (!(init?.headers as Record<string, string>)?.Authorization) return new Response('', { status: 401 })

    const id = url.pathname.split('/files/')[1]
    if (method === 'GET' && url.pathname.endsWith('/files')) return json({ files: this.query(url.searchParams.get('q')!) })
    if (method === 'GET' && id) return new Response(this.files.get(id)!.content!)
    if (method === 'POST' && url.pathname === '/drive/v3/files') {
      const meta = JSON.parse(String(init!.body))
      return json({ id: this.add({ ...meta, parents: meta.parents ?? ['root'] }) })
    }
    if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const { meta, content } = parseMultipart(init!)
      return json({ id: this.add({ ...(meta as { name: string; mimeType: string; parents: string[] }), content }) })
    }
    if (method === 'PATCH' && url.pathname.startsWith('/upload/')) {
      const file = this.files.get(id!)!
      const { meta, content } = parseMultipart(init!)
      Object.assign(file, { name: meta.name, content })
      const add = url.searchParams.get('addParents')
      if (add) file.parents = [add]
      return json({ id })
    }
    if (method === 'PATCH') {
      Object.assign(this.files.get(id!)!, JSON.parse(String(init!.body)))
      return json({ id })
    }
    throw new Error(`FakeDrive: ${method} ${url}`)
  }

  private add(file: FakeDrive['files'] extends Map<string, infer F> ? F : never): string {
    const id = `f${this.next++}`
    this.files.set(id, file)
    return id
  }

  private query(q: string) {
    const out: { id: string; parents: string[] }[] = []
    for (const [id, file] of this.files) {
      if (file.trashed) continue
      const mark = /value='([^']+)'/.exec(q)
      if (q.startsWith('appProperties') && file.appProperties?.matexProjectId === mark?.[1]) out.push({ id, parents: file.parents })
      const folder = /name = '((?:\\'|[^'])+)' and '([^']+)' in parents/.exec(q)
      if (folder && file.mimeType.endsWith('folder') && file.name === folder[1]!.replace(/\\'/g, "'") && file.parents.includes(folder[2]!))
        out.push({ id, parents: file.parents })
    }
    return out
  }

  /** Ruta de carpetas de un archivo, por nombre (para afirmar dónde quedó). */
  pathOf(id: string): string {
    const names: string[] = []
    let parent = this.files.get(id)!.parents[0]!
    while (parent !== 'root') {
      const folder = this.files.get(parent)!
      names.unshift(folder.name)
      parent = folder.parents[0]!
    }
    return [...names, this.files.get(id)!.name].join('/')
  }
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
}

function parseMultipart(init: RequestInit): { meta: Record<string, unknown>; content: string } {
  const parts = String(init.body).split(/--matex-[^\r\n]+/).map((part) => part.split('\r\n\r\n')[1]?.replace(/\r\n$/, ''))
  return { meta: JSON.parse(parts[1]!), content: parts[2]! }
}

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p-1',
  name: 'Apunte: límites',
  kind: 'matex',
  files: [{ path: 'main.tex', content: 'x' }],
  mainFile: 'main.tex',
  folderId: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
})

describe('DriveStore', () => {
  const setup = () => {
    const drive = new FakeDrive()
    const store = new DriveStore({ token: () => 'tok' }, drive.fetch)
    return { drive, store }
  }

  it('crea la carpeta elegida y guarda el proyecto como .mtex adentro', async () => {
    const { drive, store } = setup()
    await store.save(project(), ['Matex', 'Facultad'])
    const [id] = [...drive.files].find(([, f]) => f.name.endsWith('.mtex'))!
    // «:» no se admite en nombres de archivo: se reemplaza.
    expect(drive.pathOf(id)).toBe('Matex/Facultad/Apunte límites.mtex')
  })

  it('lo que guarda, lo vuelve a leer', async () => {
    const { store } = setup()
    await store.save(project(), ['Matex'])
    expect(await store.load('p-1')).toEqual(project())
  })

  it('guardar de nuevo actualiza el mismo archivo (y lo mueve si cambió de carpeta)', async () => {
    const { drive, store } = setup()
    await store.save(project(), ['Matex'])
    await store.save(project({ name: 'Apunte v2' }), ['Matex', 'Otra'])
    const mtex = [...drive.files].filter(([, f]) => f.name.endsWith('.mtex'))
    expect(mtex).toHaveLength(1)
    expect(drive.pathOf(mtex[0]![0])).toBe('Matex/Otra/Apunte v2.mtex')
  })

  it('reusa las carpetas que ya existen (y entiende nombres con comillas)', async () => {
    const { drive, store } = setup()
    await store.save(project(), ['Matex', "D'Alembert"])
    await new DriveStore({ token: () => 'tok' }, drive.fetch).save(project({ id: 'p-2' }), ['Matex', "D'Alembert"])
    expect([...drive.files.values()].filter((f) => f.mimeType.endsWith('folder'))).toHaveLength(2)
  })

  it('borrar lo manda a la papelera (se puede recuperar desde Drive)', async () => {
    const { drive, store } = setup()
    await store.save(project(), ['Matex'])
    await store.remove('p-1')
    expect([...drive.files.values()].find((f) => f.name.endsWith('.mtex'))?.trashed).toBe(true)
    expect(await store.load('p-1')).toBeUndefined()
  })

  it('sin permiso de Drive, avisa que hay que reconectar', async () => {
    const drive = new FakeDrive()
    const store = new DriveStore({ token: () => null }, drive.fetch)
    await expect(store.save(project(), ['Matex'])).rejects.toBeInstanceOf(DriveUnavailable)
  })
})
