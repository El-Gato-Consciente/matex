/**
 * **PUERTO para compartir por link** (lambda `matex-shares` + nuestro S3).
 *
 * Un link es una **foto fija**: guarda una copia del documento tal como estaba al compartir. Lo
 * que el autor siga editando no cambia lo que ve quien tiene el link; para eso se **actualiza**
 * (mismo link, copia nueva). No vence: dura hasta que el autor lo revoca.
 *
 * El tipo decide qué puede hacer quien lo abre:
 *  - `mtex`: ver, descargar e importar a su cuenta.
 *  - `pdf`:  ver y descargar.
 */
export type ShareKind = 'mtex' | 'pdf'

/** Un link, visto por su autor. */
export interface Share {
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly kind: ShareKind
  readonly size: number
  readonly createdAt: string
  readonly updatedAt: string
  /** `false` = creado pero sin contenido todavía (el link no abre). */
  readonly published: boolean
}

/** Un link, visto por quien lo abre: sin ningún dato del autor. */
export interface SharedDocument {
  readonly id: string
  readonly name: string
  readonly kind: ShareKind
  readonly size: number
  readonly updatedAt: string
  /** URL firmada, de corta vida, para bajar el contenido. */
  readonly url: string
}

/** Hay que iniciar sesión (o volver a iniciarla) para compartir. */
export class ShareUnauthorized extends Error {
  constructor() {
    super('unauthorized')
    this.name = 'ShareUnauthorized'
  }
}

/** El link no existe: nunca existió, se revocó o está mal copiado. */
export class ShareNotFound extends Error {
  constructor() {
    super('not-found')
    this.name = 'ShareNotFound'
  }
}

export interface ShareApi {
  /** Los links del usuario (con sesión). */
  list(): Promise<readonly Share[]>
  /** Crea el link y publica su primera copia. */
  create(input: { projectId: string; name: string; kind: ShareKind; content: Blob }): Promise<Share>
  /** Reemplaza la copia publicada (mismo link). */
  update(share: Pick<Share, 'id' | 'kind'>, input: { name: string; content: Blob }): Promise<Share>
  revoke(id: string): Promise<void>
  /** Abre un link (sin sesión). */
  open(id: string): Promise<SharedDocument>
  /** Baja el contenido de un link abierto. */
  download(document: SharedDocument): Promise<Blob>
}

const CONTENT_TYPE: Readonly<Record<ShareKind, string>> = { mtex: 'application/json', pdf: 'application/pdf' }

/** Dirección pública de un link (la que se copia y se manda). */
export function shareLink(id: string, origin: string = window.location.origin): string {
  return `${origin}/compartido/${encodeURIComponent(id)}`
}

interface HttpShareApiOptions {
  /** Base de la API: `https://el-gato-consciente.com/api`. */
  readonly baseUrl: string
  /** Token de Google vigente, o `null` si no hay sesión. */
  readonly getToken: () => string | null
  readonly fetchImpl?: typeof fetch
}

/** Adaptador HTTP del puerto. El contenido viaja directo navegador↔S3 con URLs firmadas. */
export class HttpShareApi implements ShareApi {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly fetchImpl: typeof fetch

  constructor(options: HttpShareApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.getToken = options.getToken
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async list(): Promise<readonly Share[]> {
    return (await this.call<{ shares: Share[] }>('GET', '/matex/shares')).shares
  }

  async create(input: { projectId: string; name: string; kind: ShareKind; content: Blob }): Promise<Share> {
    const share = await this.call<Share>('POST', '/matex/shares', {
      projectId: input.projectId,
      name: input.name,
      kind: input.kind,
    })
    try {
      return await this.publish(share, input.name, input.content)
    } catch (error) {
      // Sin contenido el link no sirve: que no quede uno a medio crear en la lista del autor.
      await this.revoke(share.id).catch(() => undefined)
      throw error
    }
  }

  update(share: Pick<Share, 'id' | 'kind'>, input: { name: string; content: Blob }): Promise<Share> {
    return this.publish(share, input.name, input.content)
  }

  async revoke(id: string): Promise<void> {
    await this.call('DELETE', `/matex/shares/${encodeURIComponent(id)}`)
  }

  async open(id: string): Promise<SharedDocument> {
    const response = await this.fetchImpl(`${this.baseUrl}/matex/shared/${encodeURIComponent(id)}`)
    if (response.status === 404) throw new ShareNotFound()
    if (!response.ok) throw new Error(`La API respondió HTTP ${response.status}`)
    return (await response.json()) as SharedDocument
  }

  async download(document: SharedDocument): Promise<Blob> {
    const response = await this.fetchImpl(document.url)
    if (!response.ok) throw new Error(`No se pudo bajar el documento (HTTP ${response.status})`)
    return response.blob()
  }

  private async publish(share: Pick<Share, 'id' | 'kind'>, name: string, content: Blob): Promise<Share> {
    const id = encodeURIComponent(share.id)
    const upload = await this.call<{ revision: string; url: string; fields: Record<string, string> }>(
      'POST',
      `/matex/shares/${id}/upload-url`,
    )
    // POST firmado a S3: los campos firmados van primero y el archivo al final (lo exige S3).
    const form = new FormData()
    for (const [field, value] of Object.entries(upload.fields)) form.append(field, value)
    form.append('file', new Blob([content], { type: CONTENT_TYPE[share.kind] }))
    const response = await this.fetchImpl(upload.url, { method: 'POST', body: form })
    if (!response.ok) throw new Error(`S3 rechazó la subida (HTTP ${response.status})`)
    return this.call<Share>('PUT', `/matex/shares/${id}`, { revision: upload.revision, name })
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken()
    if (!token) throw new ShareUnauthorized()
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (response.status === 401) throw new ShareUnauthorized()
    if (response.status === 404) throw new ShareNotFound()
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(detail?.error === 'too-many-shares' ? 'Llegaste al máximo de links compartidos. Revocá alguno para crear otro.' : `La API respondió HTTP ${response.status}`)
    }
    return (response.status === 204 ? undefined : await response.json()) as T
  }
}
