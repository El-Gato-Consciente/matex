import { buildMinimalPdf } from '@/lib/buildMinimalPdf'
import type { LatexCompiler } from './LatexCompiler'
import type { CompileInput, CompileResult } from './types'

export interface MockCompilerOptions {
  /** Latencia simulada en ms, para que la UI ejerza sus estados de carga. */
  readonly latencyMs?: number
}

/**
 * Adaptador de desarrollo: no compila LaTeX de verdad, devuelve un PDF mínimo
 * que confirma que el flujo editor → compilador → preview funciona. Permite
 * construir toda la app antes de decidir el backend real.
 */
export class MockCompiler implements LatexCompiler {
  private readonly latencyMs: number

  constructor(options: MockCompilerOptions = {}) {
    this.latencyMs = options.latencyMs ?? 400
  }

  async compile(input: CompileInput): Promise<CompileResult> {
    await delay(this.latencyMs)

    const main = input.files.find((file) => file.path === input.mainFile)?.content ?? ''
    const lineCount = main.split('\n').length
    const charCount = main.length
    const pdf = buildMinimalPdf([
      'MOCK COMPILER',
      '',
      'Aun no hay un backend de LaTeX conectado.',
      'Este PDF confirma el flujo editor -> compilador -> preview.',
      '',
      `Lineas de fuente: ${lineCount}`,
      `Caracteres: ${charCount}`,
    ])

    return {
      ok: true,
      pdf,
      log: `[mock] compiled ${charCount} chars in ${lineCount} lines`,
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
