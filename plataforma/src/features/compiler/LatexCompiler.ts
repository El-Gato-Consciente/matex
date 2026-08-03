import type { CompileInput, CompileResult } from './types'

/**
 * PUERTO del compilador de LaTeX (arquitectura hexagonal).
 *
 * La UI depende solo de esta interfaz, nunca de una implementación concreta.
 * Adaptadores intercambiables:
 *  - `MockCompiler`        — sin backend, para construir la app de punta a punta.
 *  - `RemoteCompiler`      — HTTP a un backend (candidato: Docker + TeX Live).
 *  - (futuro) WASM         — SwiftLaTeX en el navegador, si alguna vez conviene.
 *
 * Es async y agnóstica del transporte: sirve igual para HTTP, worker o local.
 */
export interface LatexCompiler {
  compile(input: CompileInput): Promise<CompileResult>
}
