import type { Project } from '@/features/documents/types'
import { fromProjectFile, projectFileName, toProjectFile } from './projectFile'

/**
 * **Contenido de proyectos en el Google Drive del usuario.** El navegador habla directo con la
 * API de Drive con su propio permiso (`drive.file`: solo ve lo que crea Matex, no el resto del
 * Drive). Nada de esto pasa por nuestros servidores ni queda en nuestras tablas.
 *
 * Cada proyecto es un `.mtex` adentro de la carpeta elegida, replicando el árbol de carpetas de
 * Matex (`Matex/Facultad/Análisis/Apunte.mtex`), así se puede navegar desde Drive. Al archivo se
 * lo encuentra por una marca propia (`appProperties.matexProjectId`), no por nombre ni por id:
 * si el usuario lo mueve o lo renombra en Drive, se sigue encontrando.
 */

/** No hay permiso de Drive utilizable sin interacción: hay que reconectar (con un clic). */
export class DriveUnavailable extends Error {
  constructor() {
    super('drive-unavailable')
    this.name = 'DriveUnavailable'
  }
}

export interface DriveAuth {
  /** Token vigente de Drive sin mostrar nada; `null` si hace falta que el usuario reconecte. */
  token(): string | null
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'
const MARK = 'matexProjectId'

interface DriveFile {
  id: string
  name?: string
  parents?: string[]
}

export class DriveStore {
  private readonly auth: DriveAuth
  private readonly fetchImpl: typeof fetch
  /** Ruta de carpetas → id, para no buscar la misma carpeta en cada guardado. */
  private readonly folderIds = new Map<string, string>()

  constructor(auth: DriveAuth, fetchImpl?: typeof fetch) {
    this.auth = auth
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  /** Guarda (crea o actualiza) el proyecto en `folderPath`. Devuelve el tamaño en bytes. */
  async save(project: Project, folderPath: readonly string[]): Promise<number> {
    const parent = await this.ensureFolder(folderPath)
    const content = JSON.stringify(toProjectFile(project))
    const existing = await this.find(project.id)
    const metadata: Record<string, unknown> = { name: projectFileName(project), mimeType: 'application/json' }

    if (existing) {
      // Si cambió de carpeta (en Matex), se mueve también en Drive.
      const params = new URLSearchParams({ uploadType: 'multipart', fields: 'id,parents' })
      const current = existing.parents ?? []
      if (!current.includes(parent)) {
        params.set('addParents', parent)
        if (current.length) params.set('removeParents', current.join(','))
      }
      await this.request(`${UPLOAD}/files/${existing.id}?${params}`, { method: 'PATCH', ...multipart(metadata, content) })
    } else {
      metadata.parents = [parent]
      metadata.appProperties = { [MARK]: project.id }
      await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', ...multipart(metadata, content) })
    }
    return new Blob([content]).size
  }

  /** El proyecto guardado en Drive, o `undefined` si el archivo ya no está (borrado en Drive). */
  async load(projectId: string): Promise<unknown> {
    const file = await this.find(projectId)
    if (!file) return undefined
    const response = await this.request(`${API}/files/${file.id}?alt=media`)
    return fromProjectFile(await response.json())
  }

  /** Lo manda a la **papelera** de Drive (no lo borra): se puede recuperar desde Drive. */
  async remove(projectId: string): Promise<void> {
    const file = await this.find(projectId)
    if (!file) return
    await this.request(`${API}/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }

  private async find(projectId: string): Promise<DriveFile | undefined> {
    const q = `appProperties has { key='${MARK}' and value='${escapeQuery(projectId)}' } and trashed = false`
    const response = await this.request(`${API}/files?${new URLSearchParams({ q, fields: 'files(id,name,parents)', spaces: 'drive' })}`)
    const { files } = (await response.json()) as { files: DriveFile[] }
    return files[0]
  }

  /** Id de la carpeta `path` (desde la raíz del Drive), creando los niveles que falten. */
  private async ensureFolder(path: readonly string[]): Promise<string> {
    let parent = 'root'
    for (let depth = 1; depth <= path.length; depth++) {
      const key = path.slice(0, depth).join('/')
      const cached = this.folderIds.get(key)
      if (cached) {
        parent = cached
        continue
      }
      const name = path[depth - 1]!
      const q = `mimeType = '${FOLDER}' and name = '${escapeQuery(name)}' and '${parent}' in parents and trashed = false`
      const found = (await (await this.request(`${API}/files?${new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' })}`)).json()) as {
        files: DriveFile[]
      }
      const id =
        found.files[0]?.id ??
        ((await (
          await this.request(`${API}/files?fields=id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
          })
        ).json()) as DriveFile).id
      this.folderIds.set(key, id)
      parent = id
    }
    return parent
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = this.auth.token()
    if (!token) throw new DriveUnavailable()
    const response = await this.fetchImpl(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
    // 401: el permiso venció o lo revocaron; 403 por permisos también pide reconectar.
    if (response.status === 401 || response.status === 403) throw new DriveUnavailable()
    if (!response.ok) throw new Error(`Google Drive respondió HTTP ${response.status}`)
    return response
  }
}

/** Cuerpo `multipart/related` de la API de subida de Drive: metadatos + contenido. */
function multipart(metadata: Record<string, unknown>, content: string): { headers: Record<string, string>; body: string } {
  const boundary = `matex-${crypto.randomUUID()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return { headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }
}

/** Escapa comillas y barras para las consultas `q` de Drive. */
function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
