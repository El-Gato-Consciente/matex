import type { Folder, Project } from '@/features/documents/types'
import { fromProjectFile, toProjectFile } from './projectFile'
import type { ContentStorage } from './storagePrefs'

/**
 * **PUERTO de la nube** para sincronizar proyectos (lambda `matex-projects` + nuestro S3). Lleva el
 * índice (versiones, lápidas, carpetas) y el contenido de los proyectos que viven en «Matex». El
 * de los que viven en Google Drive lo maneja `DriveStore`; acá solo se registra su versión.
 * El motor de sincronización solo conoce esta interfaz: en los tests es un fake en memoria.
 */

/** Un proyecto según el índice remoto. Los borrados vienen como lápida (`deleted`). */
export interface RemoteProject {
  readonly id: string
  readonly version: number
  readonly updatedAt: string
  readonly deleted: boolean
  /** Dónde vive su contenido (ausente en las lápidas). */
  readonly storage?: ContentStorage
  readonly name?: string
  readonly kind?: 'latex' | 'matex'
  readonly folderId?: string | null
  readonly size?: number
}

export interface RemoteIndex {
  readonly projects: readonly RemoteProject[]
  readonly folders: { readonly folders: readonly unknown[]; readonly version: number }
}

/** Otro equipo guardó antes: la versión que conocíamos ya no es la vigente. */
export class SyncConflict extends Error {
  constructor() {
    super('conflict')
    this.name = 'SyncConflict'
  }
}

/** La sesión venció (o nunca hubo): hay que volver a iniciar sesión. */
export class SyncUnauthorized extends Error {
  constructor() {
    super('unauthorized')
    this.name = 'SyncUnauthorized'
  }
}

export interface SyncApi {
  list(): Promise<RemoteIndex>
  /** Sube el proyecto a nuestro S3 (en `path`) como revisión nueva y la confirma sobre `baseVersion`. */
  pushToS3(project: Project, baseVersion: number, path: string): Promise<RemoteProject>
  /** Registra que el proyecto vive en Drive (ya guardado ahí) y confirma la versión. */
  commitDrive(project: Project, baseVersion: number, size: number): Promise<RemoteProject>
  /** Baja de nuestro S3 el contenido vigente (el proyecto; se valida al guardarlo). */
  pull(id: string): Promise<unknown>
  remove(id: string): Promise<void>
  putFolders(folders: readonly Folder[], baseVersion: number): Promise<{ version: number }>
}

interface HttpSyncApiOptions {
  /** Base de la API (la misma del compilador): `https://el-gato-consciente.com/api`. */
  readonly baseUrl: string
  /** Token de Google vigente, o `null` si la sesión venció. */
  readonly getToken: () => string | null
  readonly fetchImpl?: typeof fetch
}

/** Adaptador HTTP del puerto. El contenido viaja directo navegador↔S3 con URLs firmadas. */
export class HttpSyncApi implements SyncApi {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly fetchImpl: typeof fetch

  constructor(options: HttpSyncApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.getToken = options.getToken
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  list(): Promise<RemoteIndex> {
    return this.call<RemoteIndex>('GET', '/matex/projects')
  }

  async pushToS3(project: Project, baseVersion: number, path: string): Promise<RemoteProject> {
    const id = encodeURIComponent(project.id)
    const upload = await this.call<{ revision: string; path: string; url: string; fields: Record<string, string> }>(
      'POST',
      `/matex/projects/${id}/upload-url`,
      { path },
    )
    // POST firmado a S3: los campos firmados van primero y el archivo al final (lo exige S3).
    const form = new FormData()
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value)
    form.append('file', new Blob([JSON.stringify(toProjectFile(project))], { type: 'application/json' }))
    const response = await this.fetchImpl(upload.url, { method: 'POST', body: form })
    if (!response.ok) throw new Error(`S3 rechazó la subida (HTTP ${response.status})`)

    return this.call<RemoteProject>('PUT', `/matex/projects/${id}`, {
      storage: 'matex',
      revision: upload.revision,
      path: upload.path,
      ...this.metadata(project, baseVersion),
    })
  }

  commitDrive(project: Project, baseVersion: number, size: number): Promise<RemoteProject> {
    return this.call<RemoteProject>('PUT', `/matex/projects/${encodeURIComponent(project.id)}`, {
      storage: 'drive',
      size,
      ...this.metadata(project, baseVersion),
    })
  }

  async pull(id: string): Promise<unknown> {
    const { url } = await this.call<{ url: string }>('GET', `/matex/projects/${encodeURIComponent(id)}/download-url`)
    const response = await this.fetchImpl(url)
    if (!response.ok) throw new Error(`No se pudo bajar el proyecto (HTTP ${response.status})`)
    return fromProjectFile(await response.json())
  }

  async remove(id: string): Promise<void> {
    await this.call('DELETE', `/matex/projects/${encodeURIComponent(id)}`)
  }

  putFolders(folders: readonly Folder[], baseVersion: number): Promise<{ version: number }> {
    return this.call('PUT', '/matex/folders', { folders, baseVersion })
  }

  private metadata(project: Project, baseVersion: number) {
    return { baseVersion, name: project.name, kind: project.kind, folderId: project.folderId }
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken()
    if (!token) throw new SyncUnauthorized()
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (response.status === 401) throw new SyncUnauthorized()
    if (response.status === 409) throw new SyncConflict()
    if (!response.ok) throw new Error(`La API respondió HTTP ${response.status}`)
    return (response.status === 204 ? undefined : await response.json()) as T
  }
}
