// Bundlea el runtime de gráficos (ME-37) a un IIFE autocontenido y lo escribe como constante `.ts`
// que `compileToHtml` embebe en el `.html` interactivo. Correr tras cambiar el renderer de gráficos:
//   node scripts/build-plot-runtime.mjs   (también corre en `prebuild`, ver package.json)
import { rolldown } from 'rolldown'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const entry = resolve(here, '../src/features/matex/core/plotRuntime.entry.ts')
const out = resolve(here, '../src/features/matex/core/plotRuntime.generated.ts')

const bundle = await rolldown({ input: entry, logLevel: 'silent' })
const { output } = await bundle.generate({ format: 'iife', minify: true, name: '__mxPlotRuntime' })
await bundle.close()

const code = output.find((c) => c.type === 'chunk')?.code ?? ''
if (!code) throw new Error('rolldown no produjo código')

const banner = '// GENERADO por scripts/build-plot-runtime.mjs — NO editar a mano. Ver ME-37.\n/* eslint-disable */\n'
writeFileSync(out, `${banner}export const PLOT_RUNTIME_JS = ${JSON.stringify(code)}\n`, 'utf8')
console.log(`plotRuntime: ${(code.length / 1024).toFixed(1)} KB → ${out}`)
