import type { MatexDoc } from '@/features/matex/core'
import type { ProjectStore } from './ProjectStore'
import type { Folder, NewProjectInput, Project, ProjectFile } from './types'

const STORAGE_KEY = 'matex.projects.v2'
const LEGACY_KEY = 'matex.projects.v1'
const MAIN_FILE = 'main.tex'

interface Persisted {
  projects: Project[]
  folders: Folder[]
}

/**
 * Adaptador de `ProjectStore` sobre `localStorage` (serialización versionada v2:
 * `{ projects, folders }`). Migra automáticamente el formato v1 (array de
 * proyectos, sin carpetas) la primera vez.
 */
export class LocalProjectStore implements ProjectStore {
  private readonly storage: Storage
  private readonly projects: Map<string, Project>
  private readonly folders: Map<string, Folder>

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
    const loaded = LocalProjectStore.load(storage)
    this.projects = loaded.projects
    this.folders = loaded.folders
  }

  // ── Proyectos ──────────────────────────────────────────────────────────
  list(): Project[] {
    return [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  get(id: string): Project | undefined {
    return this.projects.get(id)
  }

  create(input: NewProjectInput): Project {
    const now = new Date().toISOString()
    const mainFile = input.mainFile ?? MAIN_FILE
    const files =
      input.files && input.files.length > 0
        ? [...input.files]
        : [{ path: mainFile, content: input.mainContent ?? '' }]
    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim() || 'Documento sin título',
      kind: input.kind ?? 'latex',
      files,
      mainFile,
      ast: input.ast,
      folderId: input.folderId ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.projects.set(project.id, project)
    this.persist()
    return project
  }

  updateAst(id: string, ast: MatexDoc): void {
    const project = this.projects.get(id)
    if (!project) return
    this.projects.set(id, { ...project, ast, updatedAt: new Date().toISOString() })
    this.persist()
  }

  updateFiles(id: string, files: readonly ProjectFile[], mainFile: string): void {
    const project = this.projects.get(id)
    if (!project) return
    this.projects.set(id, {
      ...project,
      files: [...files],
      mainFile,
      updatedAt: new Date().toISOString(),
    })
    this.persist()
  }

  rename(id: string, name: string): void {
    const project = this.projects.get(id)
    if (!project) return
    this.projects.set(id, {
      ...project,
      name: name.trim() || project.name,
      updatedAt: new Date().toISOString(),
    })
    this.persist()
  }

  remove(id: string): void {
    if (this.projects.delete(id)) this.persist()
  }

  put(project: unknown): boolean {
    if (!isProject(project)) return false
    const normalized = normalizeProject(project)
    this.projects.set(normalized.id, normalized)
    this.persist()
    return true
  }

  moveProject(id: string, folderId: string | null): void {
    const project = this.projects.get(id)
    if (!project) return
    this.projects.set(id, { ...project, folderId, updatedAt: new Date().toISOString() })
    this.persist()
  }

  // ── Carpetas ───────────────────────────────────────────────────────────
  listFolders(): Folder[] {
    return [...this.folders.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  createFolder(name: string, parentId: string | null): Folder {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Carpeta',
      parentId: parentId ?? null,
      createdAt: new Date().toISOString(),
    }
    this.folders.set(folder.id, folder)
    this.persist()
    return folder
  }

  renameFolder(id: string, name: string): void {
    const folder = this.folders.get(id)
    if (!folder) return
    this.folders.set(id, { ...folder, name: name.trim() || folder.name })
    this.persist()
  }

  removeFolder(id: string): void {
    const folder = this.folders.get(id)
    if (!folder) return
    const target = folder.parentId
    // No se borra contenido: subcarpetas y proyectos suben a la carpeta padre.
    for (const sub of this.folders.values()) {
      if (sub.parentId === id) this.folders.set(sub.id, { ...sub, parentId: target })
    }
    for (const project of this.projects.values()) {
      if (project.folderId === id) this.projects.set(project.id, { ...project, folderId: target })
    }
    this.folders.delete(id)
    this.persist()
  }

  moveFolder(id: string, parentId: string | null): void {
    if (id === parentId) return
    const folder = this.folders.get(id)
    if (!folder) return
    // Evita ciclos: no se puede mover una carpeta dentro de su propio subárbol.
    if (parentId && this.isInSubtree(parentId, id)) return
    this.folders.set(id, { ...folder, parentId: parentId ?? null })
    this.persist()
  }

  /** ¿`candidateId` está dentro del subárbol con raíz `ancestorId` (incluida)? */
  replaceFolders(folders: readonly unknown[]): void {
    this.folders.clear()
    for (const folder of folders) if (isFolder(folder)) this.folders.set(folder.id, folder)
    this.persist()
  }

  private isInSubtree(candidateId: string, ancestorId: string): boolean {
    let current: Folder | undefined = this.folders.get(candidateId)
    while (current) {
      if (current.id === ancestorId) return true
      current = current.parentId ? this.folders.get(current.parentId) : undefined
    }
    return false
  }

  private persist(): void {
    const data: Persisted = {
      projects: [...this.projects.values()],
      folders: [...this.folders.values()],
    }
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  private static load(storage: Storage): { projects: Map<string, Project>; folders: Map<string, Folder> } {
    const rawV2 = storage.getItem(STORAGE_KEY)
    if (rawV2) {
      try {
        const parsed = JSON.parse(rawV2) as Partial<Persisted>
        const projects = new Map(
          (Array.isArray(parsed.projects) ? parsed.projects : [])
            .filter(isProject)
            .map((project) => [project.id, normalizeProject(project)] as const),
        )
        const folders = new Map(
          (Array.isArray(parsed.folders) ? parsed.folders : [])
            .filter(isFolder)
            .map((folder) => [folder.id, folder] as const),
        )
        return { projects, folders }
      } catch {
        return { projects: new Map(), folders: new Map() }
      }
    }

    // Migración v1 → v2: el formato viejo era un array de proyectos sin carpetas.
    const rawV1 = storage.getItem(LEGACY_KEY)
    if (rawV1) {
      try {
        const parsed = JSON.parse(rawV1) as unknown
        if (Array.isArray(parsed)) {
          const projects = new Map(
            parsed.filter(isProject).map((project) => [project.id, normalizeProject(project)] as const),
          )
          const data: Persisted = { projects: [...projects.values()], folders: [] }
          storage.setItem(STORAGE_KEY, JSON.stringify(data))
          return { projects, folders: new Map() }
        }
      } catch {
        return { projects: new Map(), folders: new Map() }
      }
    }

    return { projects: new Map(), folders: new Map() }
  }
}

/** Garantiza `folderId` y `kind` (los proyectos viejos no los tenían). */
function normalizeProject(project: Project): Project {
  const raw = project as Project & { folderId?: unknown; kind?: unknown }
  return {
    ...project,
    kind: raw.kind === 'matex' ? 'matex' : 'latex',
    folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
  }
}

function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    Array.isArray(record.files) &&
    typeof record.mainFile === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  )
}

function isFolder(value: unknown): value is Folder {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    (record.parentId === null || typeof record.parentId === 'string') &&
    typeof record.createdAt === 'string'
  )
}
