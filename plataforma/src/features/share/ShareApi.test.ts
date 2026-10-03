import { describe, expect, it } from 'vitest'
import { HttpShareApi, shareLink, ShareNotFound, ShareUnauthorized, type Share } from './ShareApi'

const SHARE: Share = {
  id: 'abcdefghijklmnopqrstuv',
  projectId: 'p1',
  name: 'Apunte',
  kind: 'mtex',
  size: 0,
  createdAt: '2026-10-03T00:00:00Z',
  updatedAt: '2026-10-03T00:00:00Z',
  published: false,
}

interface Call {
  readonly method: string
  readonly url: string
  readonly auth: string | null
  readonly body: unknown
}

/** `fetch` falso: responde según `routes` (método + final de la URL) y anota cada llamada. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    calls.push({ method, url, auth: headers.get('Authorization'), body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body })
    const key = Object.keys(routes).find((route) => {
      const [routeMethod, suffix] = route.split(' ')
      return routeMethod === method && url.endsWith(suffix!)
    })
    if (!key) throw new Error(`llamada no esperada: ${method} ${url}`)
    return routes[key]!()
  }) as typeof fetch
  return { fetchImpl, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const api = (fetchImpl: typeof fetch, token: string | null = 'tok') =>
  new HttpShareApi({ baseUrl: 'https://api.test/api/', getToken: () => token, fetchImpl })

describe('HttpShareApi', () => {
  it('crear = crear el link, subir la copia a S3 y publicarla', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'POST /matex/shares': () => json(SHARE, 201),
      'POST /upload-url': () => json({ revision: 'r'.repeat(32), url: 'https://s3.test/', fields: { key: 'shares/x/r.json', 'Content-Type': 'application/json' } }),
      'POST https://s3.test/': () => new Response(null, { status: 204 }),
      [`PUT /matex/shares/${SHARE.id}`]: () => json({ ...SHARE, published: true, size: 12 }),
    })
    const created = await api(fetchImpl).create({ projectId: 'p1', name: 'Apunte', kind: 'mtex', content: new Blob(['{"a":1}']) })

    expect(created.published).toBe(true)
    expect(calls.map((call) => `${call.method} ${call.url.replace('https://api.test/api', '')}`)).toEqual([
      'POST /matex/shares',
      `POST /matex/shares/${SHARE.id}/upload-url`,
      'POST https://s3.test/',
      `PUT /matex/shares/${SHARE.id}`,
    ])
    expect(calls[0]!.body).toEqual({ projectId: 'p1', name: 'Apunte', kind: 'mtex' })
    expect(calls[0]!.auth).toBe('Bearer tok')
    // A S3 no va el token de la cuenta: la URL ya está firmada.
    expect(calls[2]!.auth).toBeNull()
    const form = calls[2]!.body as FormData
    expect([...form.keys()]).toEqual(['key', 'Content-Type', 'file']) // el archivo, al final
    expect(calls[3]!.body).toEqual({ revision: 'r'.repeat(32), name: 'Apunte' })
  })

  it('si la subida falla, no deja un link a medio crear', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'POST /matex/shares': () => json(SHARE, 201),
      'POST /upload-url': () => json({ revision: 'r'.repeat(32), url: 'https://s3.test/', fields: {} }),
      'POST https://s3.test/': () => new Response(null, { status: 403 }),
      [`DELETE /matex/shares/${SHARE.id}`]: () => new Response(null, { status: 204 }),
    })
    await expect(api(fetchImpl).create({ projectId: 'p1', name: 'Apunte', kind: 'mtex', content: new Blob(['x']) })).rejects.toThrow('S3 rechazó')
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE' })
  })

  it('actualizar publica otra copia en el MISMO link, con el tipo de contenido del link', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'POST /upload-url': () => json({ revision: 'a'.repeat(32), url: 'https://s3.test/', fields: {} }),
      'POST https://s3.test/': () => new Response(null, { status: 204 }),
      [`PUT /matex/shares/${SHARE.id}`]: () => json({ ...SHARE, kind: 'pdf', published: true }),
    })
    await api(fetchImpl).update({ id: SHARE.id, kind: 'pdf' }, { name: 'Apunte v2', content: new Blob(['%PDF']) })
    expect(((calls[1]!.body as FormData).get('file') as Blob).type).toBe('application/pdf')
    expect(calls[2]!.body).toEqual({ revision: 'a'.repeat(32), name: 'Apunte v2' })
  })

  it('abrir un link no manda credenciales (funciona sin sesión)', async () => {
    const shared = { id: SHARE.id, name: 'Apunte', kind: 'pdf', size: 3, updatedAt: SHARE.updatedAt, url: 'https://s3.test/signed' }
    const { fetchImpl, calls } = fakeFetch({
      [`GET /matex/shared/${SHARE.id}`]: () => json(shared),
      'GET https://s3.test/signed': () => new Response('pdf'),
    })
    const client = api(fetchImpl, null)
    const opened = await client.open(SHARE.id)
    expect(opened).toEqual(shared)
    expect(await (await client.download(opened)).text()).toBe('pdf')
    expect(calls.every((call) => call.auth === null)).toBe(true)
  })

  it('un link revocado o mal copiado es ShareNotFound', async () => {
    const { fetchImpl } = fakeFetch({ 'GET /matex/shared/nope': () => json({ error: 'Not found' }, 404) })
    await expect(api(fetchImpl, null).open('nope')).rejects.toBeInstanceOf(ShareNotFound)
  })

  it('sin sesión no se puede listar ni crear, y no llega a llamar a la API', async () => {
    const { fetchImpl, calls } = fakeFetch({})
    await expect(api(fetchImpl, null).list()).rejects.toBeInstanceOf(ShareUnauthorized)
    expect(calls).toHaveLength(0)
  })

  it('sesión vencida (401) y tope de links se informan', async () => {
    const expired = fakeFetch({ 'GET /matex/shares': () => json({}, 401) })
    await expect(api(expired.fetchImpl).list()).rejects.toBeInstanceOf(ShareUnauthorized)
    const full = fakeFetch({ 'POST /matex/shares': () => json({ error: 'too-many-shares', max: 200 }, 409) })
    await expect(api(full.fetchImpl).create({ projectId: 'p1', name: 'x', kind: 'pdf', content: new Blob(['x']) })).rejects.toThrow('máximo de links')
  })
})

describe('shareLink', () => {
  it('es la ruta pública del sitio', () => {
    expect(shareLink('Ab3_x-9', 'https://matex.el-gato-consciente.com')).toBe('https://matex.el-gato-consciente.com/compartido/Ab3_x-9')
  })
})
