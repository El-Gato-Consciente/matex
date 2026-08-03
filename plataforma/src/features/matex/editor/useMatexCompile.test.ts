// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMatexCompile, type UseMatexCompileArgs } from './useMatexCompile'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import type { CompileInput, CompileResult } from '@/features/compiler/types'
import type { ProjectStore } from '@/features/documents/ProjectStore'
import type { ProjectFile } from '@/features/documents/types'

// `downloadPdf` toca el DOM (blob URL + click); lo mockeamos para verificar la **decisión** de
// descargar (¿bajó bytes al día, o recompiló primero?), no el navegador.
const downloadPdf = vi.fn()
vi.mock('@/lib/downloadPdf', () => ({ downloadPdf: (...a: unknown[]) => downloadPdf(...a) }))

afterEach(() => {
  downloadPdf.mockClear()
})

const PDF = new Uint8Array([37, 80, 68, 70])

/** Compilador falso que devuelve un resultado fijo y registra lo que recibió. */
function fakeCompiler(result: CompileResult = { ok: true, pdf: PDF, log: 'ok' }): LatexCompiler & { calls: CompileInput[] } {
  const calls: CompileInput[] = []
  return { calls, compile: async (req) => (calls.push(req), result) }
}

/** Store espía: solo nos importa `updateFiles`; el resto lanza si se toca por error. */
function spyStore(): ProjectStore & { files: { files: readonly ProjectFile[]; main: string }[] } {
  const files: { files: readonly ProjectFile[]; main: string }[] = []
  return new Proxy(
    { files, updateFiles: (_id: string, f: readonly ProjectFile[], main: string) => void files.push({ files: f, main }) },
    { get: (t, p) => (p in t ? (t as Record<string, unknown>)[p as string] : () => { throw new Error(`store.${String(p)} no esperado`) }) },
  ) as never
}

const setup = (over: Partial<UseMatexCompileArgs> = {}) => {
  const compiler = over.compiler ?? fakeCompiler()
  const store = (over.store ?? spyStore()) as ReturnType<typeof spyStore>
  const args: UseMatexCompileArgs = {
    latex: '\\documentclass{article}...',
    compiledFiles: [{ path: 'refs.bib', content: '@book{x}', encoding: 'utf8' }],
    compiler,
    store,
    projectId: 'p1',
    docName: 'mi-doc',
    ...over,
  }
  const view = renderHook((props: UseMatexCompileArgs) => useMatexCompile(props), { initialProps: args })
  return { view, compiler: compiler as ReturnType<typeof fakeCompiler>, store }
}

describe('useMatexCompile', () => {
  it('estado inicial: sin compilar, sin resultado, no stale', () => {
    const { view } = setup()
    expect(view.result.current).toMatchObject({ result: null, compiling: false, pdf: null, compiled: false, outputStale: false })
  })

  it('compile(): manda el `main.tex` + recursos al compilador, guarda el PDF y persiste', async () => {
    const { view, compiler, store } = setup()
    await act(async () => {
      await view.result.current.compile()
    })
    // Llamó al compilador con main.tex (el LaTeX actual) + los recursos.
    expect(compiler.calls).toHaveLength(1)
    expect(compiler.calls[0]?.mainFile).toBe('main.tex')
    expect(compiler.calls[0]?.files.map((f: { path: string }) => f.path)).toEqual(['main.tex', 'refs.bib'])
    // Expuso el PDF y quedó "compilado", no compilando.
    expect(view.result.current.pdf).toEqual(PDF)
    expect(view.result.current.compiled).toBe(true)
    expect(view.result.current.compiling).toBe(false)
    // Persistió el .tex derivado JUNTO con los recursos (no los pisa).
    expect(store.files.at(-1)?.main).toBe('main.tex')
    expect(store.files.at(-1)?.files.map((f: { path: string }) => f.path)).toEqual(['main.tex', 'refs.bib'])
  })

  it('el PDF queda STALE si el LaTeX cambia después de compilar', async () => {
    const { view } = setup({ latex: 'v1' })
    await act(async () => {
      await view.result.current.compile()
    })
    expect(view.result.current.outputStale).toBe(false)
    // El documento cambió → nuevo LaTeX; el PDF compilado quedó viejo.
    view.rerender({ ...view.result.current, latex: 'v2' } as never)
    expect(view.result.current.outputStale).toBe(true)
  })

  it('descargar con el PDF al día baja los bytes, sin recompilar', async () => {
    const { view, compiler } = setup()
    await act(async () => {
      await view.result.current.compile()
    })
    compiler.calls.length = 0
    act(() => {
      view.result.current.requestPdfDownload()
    })
    expect(downloadPdf).toHaveBeenCalledWith(PDF, 'mi-doc')
    expect(compiler.calls).toHaveLength(0) // ya estaba al día: no recompiló
  })

  it('descargar sin haber compilado NO baja un PDF: recompila primero', () => {
    const { view } = setup()
    act(() => {
      view.result.current.requestPdfDownload()
    })
    // No hay PDF al día → no se baja nada de una; dispara la compilación.
    expect(downloadPdf).not.toHaveBeenCalled()
  })

  it('un compilador que falla → resultado no-ok, sin quedar "compilando"', async () => {
    const failing: LatexCompiler = { compile: async () => { throw new Error('boom') } }
    const { view } = setup({ compiler: failing })
    await act(async () => {
      await view.result.current.compile()
    })
    expect(view.result.current.result?.ok).toBe(false) // safeCompile lo atrapa
    expect(view.result.current.compiling).toBe(false)
    expect(view.result.current.pdf).toBeNull()
  })
})
