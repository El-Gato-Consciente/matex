import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EquationRow, TheoremVariant } from '../core'
import { createDocNumbering } from '../core/policy/numbering'

/**
 * **Numeración en vivo del documento.** El editor es un **tercer backend** para la política de
 * numeración (ver `matex/03-modelo-semantico/reglas-del-modelo.md` §3): las reglas —secciones
 * jerárquicas, teoremas por sección con `proof`/`remark` sin número, ecuaciones continuas— **no
 * viven acá**, vienen de `createDocNumbering()` (la fuente única, compartida con LaTeX y HTML).
 * Este módulo solo recorre el árbol de ProseMirror en orden de documento y alimenta el contador;
 * así «lo que se ve = lo que compila» deja de ser una promesa y pasa a ser el mismo código.
 *
 * Se calcula en una sola pasada y se expone por `numberingKey` (para los node views)
 * + decoraciones `data-sec-number` en los headings (el CSS las muestra).
 */
export interface Numbering {
  /** part pos → "I" (romano) */
  part: Map<number, string>
  /** heading pos → "1.1" */
  section: Map<number, string>
  /** theorem pos → "1.2" */
  theorem: Map<number, string>
  /** mathDisplay pos → número por fila (`null` = fila sin número), sin paréntesis */
  equation: Map<number, (string | null)[]>
  /** table pos → "1" */
  table: Map<number, string>
  /** figure pos → "1" (solo figuras con caption; sin caption no numeran) */
  figure: Map<number, string>
}

/** Nombres en español de los entornos tipo teorema (para descripciones/refs). */
const VARIANT_ES: Record<string, string> = {
  theorem: 'Teorema',
  lemma: 'Lema',
  proposition: 'Proposición',
  corollary: 'Corolario',
  definition: 'Definición',
  example: 'Ejemplo',
  remark: 'Observación',
  proof: 'Demostración',
}

export const numberingKey = new PluginKey<Numbering>('matexNumbering')

/** Filas de una fórmula en bloque (attr `rows`). */
function rowsOf(node: { attrs: Record<string, unknown> }): EquationRow[] {
  const rows = node.attrs.rows
  return Array.isArray(rows) ? (rows as EquationRow[]) : []
}

function compute(state: EditorState): Numbering {
  const part = new Map<number, string>()
  const section = new Map<number, string>()
  const theorem = new Map<number, string>()
  const equation = new Map<number, (string | null)[]>()
  const table = new Map<number, string>()
  const figure = new Map<number, string>()
  // La numeración la decide la política única; este recorrido solo la alimenta en orden.
  const num = createDocNumbering()

  state.doc.descendants((node, pos) => {
    const name = node.type.name
    if (name === 'part') {
      part.set(pos, num.part())
    } else if (name === 'heading') {
      const level = (Math.min(3, Math.max(1, Number(node.attrs.level) || 1)) as 1 | 2 | 3)
      section.set(pos, num.section(level))
    } else if (name === 'theorem') {
      const n = num.theorem(String(node.attrs.variant ?? 'theorem') as TheoremVariant)
      if (n) theorem.set(pos, n)
    } else if (name === 'mathDisplay') {
      const nums = num.equation(rowsOf(node), node.attrs.aligned as boolean | undefined)
      if (nums.some((n) => n !== null)) equation.set(pos, nums)
    } else if (name === 'table') {
      const n = num.table(typeof node.attrs.caption === 'string' && !!node.attrs.caption)
      if (n) table.set(pos, n)
    } else if (name === 'figure') {
      const n = num.figure(typeof node.attrs.caption === 'string' && !!node.attrs.caption)
      if (n) figure.set(pos, n)
    }
    return true
  })
  return { part, section, theorem, equation, table, figure }
}

/** Un objeto referenciable (para el picker y para resolver una `ref`). */
export interface Referenceable {
  pos: number
  /** Para ecuaciones: índice de la **fila** referenciada (el id vive en la fila). */
  rowIndex?: number
  id: string | null
  typeLabel: string // "Sección" | "Teorema" | "Ecuación" | "Cuadro"
  number: string // "1.1" | "(3)" | "1"
  description: string // snippet (título/texto/caption/tex)
}

/** Lista de objetos referenciables del documento, con su número en vivo y descripción. */
export function listReferenceables(state: EditorState): Referenceable[] {
  const num = numberingKey.getState(state)
  if (!num) return []
  const out: Referenceable[] = []
  state.doc.descendants((node, pos) => {
    const name = node.type.name
    const id = (node.attrs.id as string | null | undefined) ?? null
    if (name === 'part') {
      out.push({ pos, id, typeLabel: 'Parte', number: num.part.get(pos) ?? '', description: node.textContent.slice(0, 60) })
    } else if (name === 'heading') {
      out.push({ pos, id, typeLabel: 'Sección', number: num.section.get(pos) ?? '', description: node.textContent.slice(0, 60) })
    } else if (name === 'theorem') {
      const n = num.theorem.get(pos)
      if (n) {
        const variant = String(node.attrs.variant ?? 'theorem')
        out.push({ pos, id, typeLabel: VARIANT_ES[variant] ?? 'Teorema', number: n, description: String(node.attrs.title ?? '') })
      }
    } else if (name === 'mathDisplay') {
      // Cada **fila numerada** es un referenciable propio (su id vive en la fila).
      const nums = num.equation.get(pos)
      rowsOf(node).forEach((row, i) => {
        const n = nums?.[i]
        if (n) {
          out.push({
            pos,
            rowIndex: i,
            id: row.id ?? null,
            typeLabel: 'Ecuación',
            number: `(${n})`,
            description: String(row.tex ?? '').slice(0, 40),
          })
        }
      })
    } else if (name === 'table') {
      // Solo las tablas con caption tienen número → son las referenciables.
      const n = num.table.get(pos)
      if (n) out.push({ pos, id, typeLabel: 'Cuadro', number: n, description: String(node.attrs.caption ?? '') })
    } else if (name === 'figure') {
      // Solo las figuras con caption tienen número → son las referenciables.
      const n = num.figure.get(pos)
      if (n) out.push({ pos, id, typeLabel: 'Figura', number: n, description: String(node.attrs.caption ?? '') })
    }
    return true
  })
  return out
}

/** Texto legible de una `ref` a partir de su destino (id): "Teorema 1.1", o `null` si cuelga. */
export function resolveRef(state: EditorState, target: string): string | null {
  if (!target) return null
  const item = listReferenceables(state).find((r) => r.id === target)
  return item ? `${item.typeLabel} ${item.number}` : null
}

export const MatexNumbering = Extension.create({
  name: 'matexNumbering',
  addProseMirrorPlugins() {
    return [
      new Plugin<Numbering>({
        key: numberingKey,
        state: {
          init: (_config, state) => compute(state),
          apply: (tr, value, _old, newState) => (tr.docChanged ? compute(newState) : value),
        },
        props: {
          decorations(state) {
            const num = numberingKey.getState(state)
            if (!num) return null
            const decos: Decoration[] = []
            num.part.forEach((text, pos) => {
              const node = state.doc.nodeAt(pos)
              if (node) decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-part-number': text }))
            })
            num.section.forEach((text, pos) => {
              const node = state.doc.nodeAt(pos)
              if (node) decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-sec-number': text }))
            })
            // Epígrafe de tabla **debajo** (como las figuras): "Cuadro N: …". Widget no
            // editable justo después de la tabla; solo para tablas con caption (num.table).
            num.table.forEach((n, pos) => {
              const node = state.doc.nodeAt(pos)
              const caption = node ? String(node.attrs.caption ?? '') : ''
              if (!node || !caption) return
              decos.push(
                Decoration.widget(
                  pos + node.nodeSize,
                  () => {
                    const el = document.createElement('div')
                    el.className = 'matex-table-caption'
                    el.contentEditable = 'false'
                    el.textContent = `Cuadro ${n}: ${caption}`
                    return el
                  },
                  { side: -1 },
                ),
              )
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})
