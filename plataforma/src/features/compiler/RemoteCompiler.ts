import type { LatexCompiler } from './LatexCompiler'
import type { CompileDiagnostic, CompileInput, CompileResult } from './types'

interface FailurePayload {
  readonly diagnostics?: readonly CompileDiagnostic[]
  readonly log?: string
}

export interface RemoteCompilerOptions {
  /** URL base del backend de compilación (p. ej. el servicio Docker + TeX Live). */
  readonly baseUrl: string
  /** `fetch` inyectable para testear sin red. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Adaptador HTTP hacia un backend de compilación. Candidato principal de backend
 * real: un servicio en Docker con la suite TeX Live completa.
 *
 * Contrato esperado: `POST {baseUrl}/compile` con `{ source, mainFile? }` y
 * respuesta `200` con el PDF (`application/pdf`) o `422` con diagnósticos JSON.
 * Mientras el backend no exista, este adaptador no se registra; la app corre con
 * `MockCompiler`. Cuando exista, se enchufa sin tocar la UI.
 */
export class RemoteCompiler implements LatexCompiler {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: RemoteCompilerOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async compile(input: CompileInput): Promise<CompileResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: input.files, mainFile: input.mainFile }),
    })

    if (response.ok) {
      const buffer = await response.arrayBuffer()
      return {
        ok: true,
        pdf: new Uint8Array(buffer),
        log: response.headers.get('X-Compile-Log') ?? '',
      }
    }

    const payload = (await response.json().catch(() => null)) as FailurePayload | null

    return {
      ok: false,
      diagnostics: payload?.diagnostics ?? [],
      log: payload?.log ?? `HTTP ${response.status}`,
    }
  }
}
