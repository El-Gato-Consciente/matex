/**
 * Runner compartido de los scripts de verificación.
 *
 * **Por qué el compilador entra por el puerto y no por una clase concreta.** Estos scripts
 * verifican *contenido del producto*, no el backend: lo único que necesitan es "algo que
 * compile LaTeX". Ese algo es el puerto `LatexCompiler` que la app ya usa. Al depender del
 * puerto en vez de `LatexmkCompiler`, la verificación:
 *
 *  - vive en el repo donde vive el contenido que verifica (y deja de atar `plataforma/` con
 *    el repo del servicio desplegable);
 *  - corre contra **la imagen que va a producción**, no contra el `latexmk` de la máquina de
 *    turno — que es un test más fiel, no solo más cómodo;
 *  - puede paralelizar, porque el transporte es HTTP y cada request es independiente.
 */
import { RemoteCompiler } from '../../src/features/compiler/RemoteCompiler'
import type { LatexCompiler } from '../../src/features/compiler/LatexCompiler'
import type { CompileInput } from '../../src/features/compiler/types'

/** Un documento a verificar: un nombre para el reporte y qué compilar. */
export interface Target {
  readonly name: string
  readonly input: CompileInput
}

/**
 * Compilador apuntado al backend real. Por defecto el contenedor local
 * (`docker compose up compiler`); `MATEX_COMPILE_URL` permite apuntar a otro.
 */
export function compilerFromEnv(): LatexCompiler {
  const baseUrl = process.env.MATEX_COMPILE_URL ?? 'http://localhost:8787'
  return new RemoteCompiler({ baseUrl })
}

/** Corta la lista según `MATEX_LIMIT` (smoke test) y `MATEX_ONLY` (ids puntuales). */
export function applyFilters<T extends { readonly id: string }>(items: readonly T[]): readonly T[] {
  const only = process.env.MATEX_ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
  const filtered = only?.length ? items.filter((item) => only.includes(item.id)) : items
  const limit = Number(process.env.MATEX_LIMIT)
  return Number.isFinite(limit) && limit > 0 ? filtered.slice(0, limit) : filtered
}

/**
 * Compila todos los targets y reporta. Devuelve la cantidad de fallos.
 *
 * Corre con concurrencia acotada: el backend local serializa internamente, pero en Lambda cada
 * invocación es su propio contenedor, así que el límite lo pone el servidor y no el script.
 * Los resultados se imprimen **en orden de la lista**, no de llegada: un reporte que cambia de
 * orden entre corridas es imposible de comparar en un diff de CI.
 */
export async function runTargets(
  targets: readonly Target[],
  compiler: LatexCompiler,
  concurrency = Number(process.env.MATEX_CONCURRENCY) || 4,
): Promise<number> {
  const lines: string[] = new Array<string>(targets.length)
  let failed = 0
  let next = 0

  const worker = async (): Promise<void> => {
    for (let i = next++; i < targets.length; i = next++) {
      const target = targets[i]!
      const result = await compiler.compile(target.input)
      if (result.ok) {
        lines[i] = `ok    ${target.name}`
      } else {
        failed++
        const detail = result.diagnostics.map((d) => d.message).join(' | ') || '(sin diagnóstico)'
        lines[i] = `FAIL  ${target.name}: ${detail}`
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))

  for (const line of lines) console.log(line)
  console.log(`\n${targets.length} compilaciones · ${failed ? `${failed} FALLOS` : 'TODO OK'}`)
  return failed
}

/**
 * Verifica que el backend esté arriba antes de intentar 100+ compilaciones. Sin esto, un
 * contenedor apagado produce 100 fallos idénticos y el reporte no dice cuál es el problema.
 */
export async function assertBackendUp(): Promise<void> {
  const baseUrl = process.env.MATEX_COMPILE_URL ?? 'http://localhost:8787'
  const response = await fetch(`${baseUrl}/health`).catch(() => null)
  if (!response?.ok) {
    console.error(
      `No hay backend de compilación en ${baseUrl}.\n` +
        `Levantalo con:  docker compose up compiler   (o apuntá MATEX_COMPILE_URL a otro).`,
    )
    process.exit(1)
  }
}
