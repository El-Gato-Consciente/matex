// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShareDialog } from './ShareDialog'
import { SharedView } from './SharedView'
import { ShareNotFound, type Share, type ShareApi, type SharedDocument, type ShareKind } from './ShareApi'

// El visor de PDF usa pdf.js (canvas): acá solo importa QUÉ se le ofrece a quien abre el link.
vi.mock('@/features/preview/PdfPreview', () => ({ PdfPreview: () => <div>visor de pdf</div> }))

afterEach(cleanup)

// El `Blob` de jsdom no implementa `text()` ni `arrayBuffer()`; el de Node sí (como el del navegador).
const blob = (text: string) => new NodeBlob([text]) as unknown as Blob

const AST = { type: 'doc', version: 4, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola mundo' }] }] }

/** API en memoria: guarda los links y la copia publicada de cada uno. */
function fakeApi(initial: Share[] = []) {
  let next = 1
  const shares = new Map(initial.map((share) => [share.id, share]))
  const contents = new Map<string, Blob>()
  const api: ShareApi & { contents: Map<string, Blob>; shares: Map<string, Share> } = {
    contents,
    shares,
    list: async () => [...shares.values()],
    create: async ({ projectId, name, kind, content }) => {
      const share: Share = { id: `link-${next++}`, projectId, name, kind, size: content.size, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), published: true }
      shares.set(share.id, share)
      contents.set(share.id, content)
      return share
    },
    update: async (share, { name, content }) => {
      const updated = { ...shares.get(share.id)!, name, size: content.size, updatedAt: new Date().toISOString() }
      shares.set(share.id, updated)
      contents.set(share.id, content)
      return updated
    },
    revoke: async (id) => {
      shares.delete(id)
      contents.delete(id)
    },
    open: async (id) => {
      const share = shares.get(id)
      if (!share) throw new ShareNotFound()
      return { id, name: share.name, kind: share.kind, size: share.size, updatedAt: share.updatedAt, url: `mem:${id}` }
    },
    download: async (document: SharedDocument) => contents.get(document.id)!,
  }
  return api
}

function dialog(api: ShareApi | null, over: { signedIn?: boolean; getContent?: (kind: ShareKind) => Promise<Blob> } = {}) {
  const getContent = vi.fn(over.getContent ?? (async (kind: ShareKind) => blob(kind === 'pdf' ? '%PDF' : JSON.stringify(AST))))
  const renderSignInButton = vi.fn()
  render(
    <ShareDialog
      open
      onClose={() => {}}
      project={{ id: 'p1', name: 'Apunte' }}
      api={api}
      signedIn={over.signedIn ?? true}
      renderSignInButton={renderSignInButton}
      getContent={getContent}
    />,
  )
  return { getContent, renderSignInButton }
}

describe('ShareDialog', () => {
  it('sin sesión pide iniciar sesión y no ofrece crear links', () => {
    const { renderSignInButton } = dialog(fakeApi(), { signedIn: false })
    expect(screen.getByText(/iniciar sesión/)).toBeTruthy()
    expect(renderSignInButton).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Crear link' })).toBeNull()
  })

  it('crea un link por tipo, con la copia del documento de ese momento', async () => {
    const api = fakeApi()
    const { getContent } = dialog(api)
    const buttons = await screen.findAllByRole('button', { name: 'Crear link' })
    expect(buttons).toHaveLength(2) // .mtex y PDF
    await waitFor(() => expect((buttons[1] as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(buttons[1]!)

    const link = (await screen.findByLabelText('Link de PDF')) as HTMLInputElement
    expect(link.value).toMatch(/\/compartido\/link-1$/)
    expect(getContent).toHaveBeenCalledWith('pdf')
    expect([...api.shares.values()]).toMatchObject([{ projectId: 'p1', kind: 'pdf', name: 'Apunte' }])
    // El otro tipo sigue sin link.
    expect(screen.getAllByRole('button', { name: 'Crear link' })).toHaveLength(1)
  })

  it('muestra los links que ya existían de ESTE documento, y deja actualizar y revocar', async () => {
    const mine: Share = { id: 'link-a', projectId: 'p1', name: 'Apunte', kind: 'mtex', size: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', published: true }
    const other: Share = { ...mine, id: 'link-b', projectId: 'otro', kind: 'pdf' }
    const api = fakeApi([mine, other])
    const { getContent } = dialog(api)

    expect(((await screen.findByLabelText('Link de Documento Matex (.mtex)')) as HTMLInputElement).value).toMatch(/link-a$/)
    expect(screen.queryByLabelText('Link de PDF')).toBeNull() // el del otro documento no aparece

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(api.contents.has('link-a')).toBe(true))
    expect(getContent).toHaveBeenCalledWith('mtex')

    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    await waitFor(() => expect(api.shares.has('link-a')).toBe(false))
    expect(api.shares.has('link-b')).toBe(true)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Crear link' })).toHaveLength(2))
  })

  it('si el PDF no compila, lo dice y no crea el link', async () => {
    const api = fakeApi()
    dialog(api, { getContent: async () => Promise.reject(new Error('El documento no compila')) })
    const buttons = await screen.findAllByRole('button', { name: 'Crear link' })
    await waitFor(() => expect((buttons[1] as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(buttons[1]!)
    expect((await screen.findByRole('alert')).textContent).toContain('no compila')
    expect(api.shares.size).toBe(0)
  })
})

describe('SharedView', () => {
  async function view(kind: ShareKind, content: Blob) {
    const api = fakeApi()
    const share = await api.create({ projectId: 'p1', name: 'Apunte', kind, content })
    const onImport = vi.fn()
    render(<SharedView shareId={share.id} api={api} onImport={onImport} onGoProjects={() => {}} />)
    return { onImport }
  }

  it('.mtex: ver, descargar e importar', async () => {
    const { onImport } = await view('mtex', blob(JSON.stringify(AST)))
    expect(await screen.findByRole('button', { name: /Descargar \.mtex/ })).toBeTruthy()
    const frame = screen.getByTitle('Apunte') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Hola mundo')
    // Contenido ajeno: scripts sí (gráficos), pero sin acceso al origen de la app.
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')

    fireEvent.click(screen.getByRole('button', { name: /Importar a mis proyectos/ }))
    expect(onImport).toHaveBeenCalledWith('Apunte', expect.objectContaining({ ast: expect.objectContaining({ type: 'doc' }) }))
  })

  it('PDF: ver y descargar, sin importar', async () => {
    await view('pdf', blob('%PDF-1.7'))
    expect(await screen.findByRole('button', { name: /Descargar PDF/ })).toBeTruthy()
    expect(await screen.findByText('visor de pdf')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull()
  })

  it('un link revocado avisa en vez de quedar en blanco', async () => {
    render(<SharedView shareId="no-existe" api={fakeApi()} onImport={() => {}} onGoProjects={() => {}} />)
    expect(await screen.findByText('Este link no está disponible')).toBeTruthy()
  })

  it('un .mtex que no es un documento válido no se muestra ni se puede importar', async () => {
    await view('mtex', blob(JSON.stringify({ type: 'doc', content: [{ type: 'inventado' }] })))
    expect(await screen.findByText('No se pudo abrir el documento')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull()
  })
})
