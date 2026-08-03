import { Extension, Node, mergeAttributes, type Editor, type NodeViewRendererProps } from '@tiptap/core'
import {
  Table,
  TableCell as BaseTableCell,
  TableHeader as BaseTableHeader,
  TableRow,
} from '@tiptap/extension-table'
import { NodeSelection, Plugin } from '@tiptap/pm/state'
import { listReferenceables, numberingKey, resolveRef, type Referenceable } from './numbering'
import { autoGrowInput, insertIntoInput, setActiveMathInsert } from './mathPalette'
import { attachMathAutocomplete } from './mathAutocomplete'
import { displayBody, displayRows } from './equationDisplay'
import { closeOnOutsideMousedown, editableAtomView, katexInto, makeId, positionPopover } from './nodeViewHelpers'
import { equationPlan, type DerivationStep, type EquationRow } from '../core'

/**
 * Nodos custom de TipTap para lo que StarterKit no cubre: **matemática** (en línea y
 * en bloque, KaTeX), **rawLatex** (válvula de escape), **ref** (referencia cruzada) y
 * **theorem** (entorno tipo teorema). Los *atoms* se editan **inline** (input con
 * preview KaTeX en vivo), no con `window.prompt`. El contenido viaja por `attrs` y el
 * mapeo doc↔AST lo pasa al AST Matex (`matex-core`, que no sabe que TipTap existe).
 */

// ── Matemática en línea (atom con popover KaTeX) ─────────────────────────────

/**
 * Fórmula **en línea** (`$…$`): un *atom* con `tex` que se edita con el popover
 * genérico de `editableAtomView` (preview KaTeX en vivo). Tipear el segundo `$`
 * inserta una fórmula vacía y abre su popover ("modo fórmula").
 */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ tex: { default: '' } }),
  parseHTML: () => [{ tag: '[data-mathInline]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-mathInline': '' }),
    String(node.attrs.tex ?? ''),
  ],
  addProseMirrorPlugins() {
    const type = this.type
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '$') return false
            const before = view.state.doc.textBetween(Math.max(0, from - 1), from)
            if (before !== '$') return false // primer `$`: se escribe literal
            const tr = view.state.tr.replaceRangeWith(from - 1, to, type.create({ tex: '' }))
            tr.setSelection(NodeSelection.create(tr.doc, from - 1))
            view.dispatch(tr.scrollIntoView())
            return true
          },
        },
      }),
    ]
  },
  addNodeView: () => (props) =>
    editableAtomView(props, {
      name: 'mathInline',
      attr: 'tex',
      inline: true,
      multiline: false,
      placeholder: 'x^2',
      className: 'matex-math-inline',
      palette: true,
      renderStatic: (el, attrs) => katexInto(el, String(attrs.tex ?? ''), false),
    }),
})

// ── Matemática en bloque (modelo de filas) ───────────────────────────────────

/** Filas normalizadas (siempre ≥ 1) del attr `rows` de una fórmula en bloque. */
/**
 * Node view de la fórmula en bloque: la vista KaTeX en el lienzo + un **editor de
 * filas** flotante (un input por fila; para align/gather, checkbox "Nº" y quitar por
 * fila, más "agregar fila"; para plain, una sola fila con toggle "Numerada"). Escribe
 * el attr `rows` en vivo (un dispatch por tecleo, que no ensucia demasiado el undo) y
 * re-pinta con la numeración del plugin `numberingKey`.
 */
function displayMathView({ node, editor, getPos }: NodeViewRendererProps) {
  let current = node
  let popover: HTMLElement | null = null
  let detachOutside: (() => void) | null = null
  let acDetachers: (() => void)[] = [] // autocompletado por fila (ME-16); se recrean al re-render

  const dom = document.createElement('div')
  dom.className = 'matex-math-display'
  const staticEl = document.createElement('div')
  dom.appendChild(staticEl)

  const alignedOf = (): boolean => current.attrs.aligned !== false // default true
  const numsOf = (): (string | null)[] => {
    const pos = typeof getPos === 'function' ? getPos() : null
    return pos == null ? [] : (numberingKey.getState(editor.state)?.equation.get(pos) ?? [])
  }

  const paint = (rows: EquationRow[] = displayRows(current)): void => {
    staticEl.replaceChildren()
    const nums = numsOf()
    katexInto(staticEl, displayBody(rows, alignedOf(), nums), true)
    // Ecuación suelta (1 fila) numerada: el número va a la derecha (span por CSS).
    // Con varias filas los números los pone KaTeX (\tag), ya alineados por renglón.
    if (!equationPlan(rows, alignedOf()).multiline && nums[0]) {
      const tag = document.createElement('span')
      tag.className = 'matex-eq-number-inline'
      tag.textContent = `(${nums[0]})`
      staticEl.appendChild(tag)
    }
  }
  paint()

  const setRows = (rows: EquationRow[]): void => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos == null) return
    editor.chain().command(({ tr }) => {
      tr.setNodeAttribute(pos, 'rows', rows)
      return true
    }).run()
  }

  const closePopover = (): void => {
    dom.classList.remove('matex-editing')
    if (!popover) return
    popover.remove()
    popover = null
    setActiveMathInsert(null)
    acDetachers.forEach((f) => f())
    acDetachers = []
    detachOutside?.()
    detachOutside = null
  }

  const openPopover = (): void => {
    if (popover) return
    dom.classList.add('matex-editing')
    // Editor de filas uniforme: una fila o varias es lo mismo (input + Nº por fila +
    // agregar). La disposición (alinear en `&` vs centrar) se elige en la barra
    // contextual, no acá. El placeholder recuerda usar `&` para alinear.
    const aligned = alignedOf()
    const draft = displayRows(current).map((r) => ({ ...r }))
    let lastFocused: HTMLInputElement | null = null // fila donde inserta la paleta
    const commit = (): void => {
      setRows(draft.map((r) => ({ ...r })))
      paint(draft)
    }

    popover = document.createElement('div')
    popover.className = 'matex-eq-editor'
    const rowsBox = document.createElement('div')
    rowsBox.className = 'matex-eq-rows'

    const renderRows = (): void => {
      acDetachers.forEach((f) => f()) // los inputs se recrean → soltar el autocompletado viejo
      acDetachers = []
      rowsBox.replaceChildren()
      const single = draft.length === 1
      draft.forEach((row, i) => {
        const rowEl = document.createElement('div')
        rowEl.className = 'matex-eq-row'
        const input = document.createElement('input')
        input.className = 'matex-atom-popover-field'
        input.value = row.tex
        input.setAttribute('placeholder', aligned ? 'a &= b + c' : '\\int_0^1 x^2 \\, dx')
        input.addEventListener('input', () => {
          const r = draft[i]
          if (r) r.tex = input.value
          commit()
        })
        // Enter/Escape salen de la edición (el texto ya se guardó en vivo por `input`);
        // devolvemos el foco al editor, igual que el popover de atoms inline.
        input.addEventListener('keydown', (event) => {
          const key = event as KeyboardEvent
          if (key.key === 'Enter' || key.key === 'Escape') {
            key.preventDefault()
            closePopover()
            editor.commands.focus(undefined, { scrollIntoView: false })
          }
        })
        input.addEventListener('focus', () => {
          lastFocused = input
        })
        autoGrowInput(input) // la fila (y el popover) crecen con la fórmula
        acDetachers.push(attachMathAutocomplete(input)) // autocompletar \comandos (ME-16)
        rowEl.appendChild(input)
        const numL = document.createElement('label')
        numL.className = 'matex-eq-row-num'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = Boolean(row.numbered)
        cb.addEventListener('change', () => {
          const r = draft[i]
          if (r) r.numbered = cb.checked
          commit()
        })
        numL.append(cb, document.createTextNode('Nº'))
        rowEl.appendChild(numL)
        if (!single) {
          const rm = document.createElement('button')
          rm.type = 'button'
          rm.className = 'matex-eq-row-rm'
          rm.textContent = '✕'
          rm.title = 'Quitar fila'
          rm.addEventListener('click', () => {
            draft.splice(i, 1)
            if (draft.length === 0) draft.push({ tex: '' })
            renderRows()
            commit()
          })
          rowEl.appendChild(rm)
        }
        rowsBox.appendChild(rowEl)
      })
    }
    renderRows()
    popover.appendChild(rowsBox)

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'matex-eq-add'
    add.textContent = '+ fila'
    add.addEventListener('click', () => {
      draft.push({ tex: '', numbered: true })
      renderRows()
      commit()
      ;(rowsBox.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus()
    })
    popover.appendChild(add)

    // La paleta vive en la barra contextual: registramos la fila enfocada como destino.
    setActiveMathInsert((snippet) => {
      const target = lastFocused ?? (rowsBox.querySelector('input') as HTMLInputElement | null)
      if (target) insertIntoInput(target, snippet)
    })

    document.body.appendChild(popover)
    positionPopover(popover, staticEl.getBoundingClientRect())
    setTimeout(() => (rowsBox.querySelector('input') as HTMLInputElement | null)?.focus(), 0)
    // Click afuera = cerrar y devolver el foco al editor; no cierra si el click cae en la
    // barra contextual (donde está la paleta que inserta acá).
    detachOutside = closeOnOutsideMousedown(
      popover,
      dom,
      () => {
        closePopover()
        editor.commands.focus(undefined, { scrollIntoView: false })
      },
      '.matex-context-bar',
    )
  }

  dom.addEventListener('mousedown', (event) => {
    event.preventDefault()
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null) editor.commands.setNodeSelection(pos)
    openPopover()
  })
  ;(dom as HTMLElement & { __matexOpenEditor?: () => void }).__matexOpenEditor = openPopover

  // Reactivo: re-pinta si cambia la numeración o la alineación (mientras no editamos).
  let lastKey = ''
  const onDocUpdate = (): void => {
    if (popover) return
    const key = `${numsOf().join(',')}|${alignedOf()}`
    if (key !== lastKey) {
      lastKey = key
      paint()
    }
  }
  editor.on('update', onDocUpdate)

  return {
    dom,
    update: (updated: typeof node) => {
      if (updated.type.name !== 'mathDisplay') return false
      current = updated
      if (!popover) paint()
      return true
    },
    selectNode: () => {
      dom.classList.add('matex-selected')
      const rows = displayRows(current)
      if (!popover && rows.length === 1 && !rows[0]?.tex) openPopover()
    },
    deselectNode: () => dom.classList.remove('matex-selected'),
    ignoreMutation: () => true,
    destroy: () => {
      editor.off('update', onDocUpdate)
      closePopover()
    },
  }
}

/**
 * Fórmula **en bloque**: `aligned` (alinear en `&` vs centrar; default true) + `rows`
 * (una o varias filas, cada una `tex` opaco con `numbered`/`id`/`label` propios). El
 * entorno LaTeX concreto lo deriva el compilador; el modelo de filas hace robustas la
 * numeración y la referencia **por fila** (ver `ecuaciones-multilinea.md`).
 */
export const MathDisplay = Node.create({
  name: 'mathDisplay',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({
    aligned: { default: true },
    rows: { default: [{ tex: '' }] },
  }),
  parseHTML: () => [{ tag: 'div[data-mathDisplay]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-mathDisplay': '' }),
    displayRows(node).map((r) => r.tex).join(' \\\\ '),
  ],
  addNodeView: () => (props) => displayMathView(props),
})

// ── Derivación (razonamiento estructurado) ───────────────────────────────────

function derivationView({ node, editor, getPos }: NodeViewRendererProps) {
  let current = node
  let popover: HTMLElement | null = null
  let detachOutside: (() => void) | null = null

  const dom = document.createElement('div')
  dom.className = 'matex-derivation'
  const staticEl = document.createElement('div')
  dom.appendChild(staticEl)

  const stepsOf = (): DerivationStep[] => (Array.isArray(current.attrs.steps) ? (current.attrs.steps as DerivationStep[]) : [])
  const titleOf = (): string => String(current.attrs.title ?? '')

  const paint = (steps: DerivationStep[] = stepsOf(), title: string = titleOf()): void => {
    staticEl.replaceChildren()
    if (title.trim()) {
      const t = document.createElement('div')
      t.className = 'matex-deriv-title'
      t.textContent = title
      staticEl.appendChild(t)
    }
    const list = document.createElement('div')
    list.className = 'matex-deriv-steps'
    if (steps.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'matex-deriv-empty'
      empty.textContent = 'Derivación vacía — clic para editar'
      list.appendChild(empty)
    }
    for (const s of steps) {
      const row = document.createElement('div')
      row.className = 'matex-deriv-step'
      const m = document.createElement('span')
      m.className = 'matex-deriv-math'
      // El `&` de alineación es de `align` (no vale en una fórmula suelta): se quita para el preview.
      katexInto(m, (s.boxed ? `\\boxed{${s.tex.replace(/&/g, '')}}` : s.tex.replace(/&/g, '')), false)
      row.appendChild(m)
      if (s.note && s.note.trim()) {
        const n = document.createElement('span')
        n.className = 'matex-deriv-note'
        n.textContent = s.note
        row.appendChild(n)
      }
      list.appendChild(row)
    }
    staticEl.appendChild(list)
  }
  paint()

  const setAttrs = (patch: Record<string, unknown>): void => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos == null) return
    editor.chain().command(({ tr }) => {
      for (const [k, v] of Object.entries(patch)) tr.setNodeAttribute(pos, k, v)
      return true
    }).run()
  }

  const closePopover = (): void => {
    dom.classList.remove('matex-editing')
    if (!popover) return
    popover.remove()
    popover = null
    setActiveMathInsert(null)
    detachOutside?.()
    detachOutside = null
  }

  const openPopover = (): void => {
    if (popover) return
    dom.classList.add('matex-editing')
    const draft = stepsOf().map((s) => ({ ...s }))
    let draftTitle = titleOf()
    let lastFocused: HTMLInputElement | null = null
    const commit = (): void => {
      setAttrs({ title: draftTitle || null, steps: draft.map((s) => ({ ...s })) })
      paint(draft, draftTitle)
    }
    const onKey = (event: Event): void => {
      const key = event as KeyboardEvent
      if (key.key === 'Enter' || key.key === 'Escape') {
        key.preventDefault()
        closePopover()
        editor.commands.focus(undefined, { scrollIntoView: false })
      }
    }

    popover = document.createElement('div')
    popover.className = 'matex-deriv-editor'

    const titleInput = document.createElement('input')
    titleInput.className = 'matex-deriv-titlefield'
    titleInput.value = draftTitle
    titleInput.setAttribute('placeholder', 'Título (opcional)')
    titleInput.addEventListener('input', () => {
      draftTitle = titleInput.value
      commit()
    })
    titleInput.addEventListener('keydown', onKey)
    popover.appendChild(titleInput)

    const rowsBox = document.createElement('div')
    rowsBox.className = 'matex-deriv-rows'
    const renderRows = (): void => {
      rowsBox.replaceChildren()
      draft.forEach((s, i) => {
        const rowEl = document.createElement('div')
        rowEl.className = 'matex-deriv-editrow'
        const tex = document.createElement('input')
        tex.className = 'matex-atom-popover-field'
        tex.value = s.tex
        tex.setAttribute('placeholder', 'x^2 - 1 &= 0')
        tex.setAttribute('aria-label', `Paso ${i + 1}`)
        tex.addEventListener('input', () => {
          const r = draft[i]
          if (r) r.tex = tex.value
          commit()
        })
        tex.addEventListener('focus', () => {
          lastFocused = tex
        })
        tex.addEventListener('keydown', onKey)
        autoGrowInput(tex, 12, 44)
        const note = document.createElement('input')
        note.className = 'matex-deriv-notefield'
        note.value = s.note ?? ''
        note.setAttribute('placeholder', 'justificación')
        note.addEventListener('input', () => {
          const r = draft[i]
          if (r) r.note = note.value || undefined
          commit()
        })
        note.addEventListener('keydown', onKey)
        const boxL = document.createElement('label')
        boxL.className = 'matex-deriv-boxed'
        boxL.title = 'Recuadrar este paso (típico del resultado)'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = Boolean(s.boxed)
        cb.addEventListener('change', () => {
          const r = draft[i]
          if (r) r.boxed = cb.checked || undefined
          commit()
        })
        boxL.append(cb, document.createTextNode('▭'))
        const rm = document.createElement('button')
        rm.type = 'button'
        rm.className = 'matex-eq-row-rm'
        rm.textContent = '✕'
        rm.title = 'Quitar paso'
        rm.addEventListener('click', () => {
          draft.splice(i, 1)
          renderRows()
          commit()
        })
        rowEl.append(tex, note, boxL, rm)
        rowsBox.appendChild(rowEl)
      })
    }
    renderRows()
    popover.appendChild(rowsBox)

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'matex-eq-add'
    add.textContent = '+ paso'
    add.addEventListener('click', () => {
      draft.push({ tex: '' })
      renderRows()
      commit()
      ;(rowsBox.lastElementChild?.querySelector('.matex-atom-popover-field') as HTMLInputElement | null)?.focus()
    })
    popover.appendChild(add)

    // La paleta de símbolos (barra contextual) inserta en el input de paso enfocado.
    setActiveMathInsert((snippet) => {
      const target = lastFocused ?? (rowsBox.querySelector('.matex-atom-popover-field') as HTMLInputElement | null)
      if (target) insertIntoInput(target, snippet)
    })

    document.body.appendChild(popover)
    positionPopover(popover, staticEl.getBoundingClientRect())
    setTimeout(() => (rowsBox.querySelector('.matex-atom-popover-field') as HTMLInputElement | null)?.focus(), 0)
    detachOutside = closeOnOutsideMousedown(
      popover,
      dom,
      () => {
        closePopover()
        editor.commands.focus(undefined, { scrollIntoView: false })
      },
      '.matex-context-bar',
    )
  }

  dom.addEventListener('mousedown', (event) => {
    event.preventDefault()
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null) editor.commands.setNodeSelection(pos)
    openPopover()
  })
  ;(dom as HTMLElement & { __matexOpenEditor?: () => void }).__matexOpenEditor = openPopover

  return {
    dom,
    update: (updated: typeof node) => {
      if (updated.type.name !== 'derivation') return false
      current = updated
      if (!popover) paint()
      return true
    },
    selectNode: () => {
      dom.classList.add('matex-selected')
      if (!popover && stepsOf().length === 0) openPopover()
    },
    deselectNode: () => dom.classList.remove('matex-selected'),
    ignoreMutation: () => true,
    destroy: () => closePopover(),
  }
}

/**
 * **Derivación**: secuencia de pasos (matemática + justificación + `boxed`) para razonamientos
 * paso a paso. Nodo atómico de bloque; se edita en un popover (título + pasos). El backend LaTeX
 * lo arma con `align` + notas a la derecha; un backend HTML lo haría como lista (ver LE-03).
 */
export const Derivation = Node.create({
  name: 'derivation',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({
    title: { default: null },
    steps: { default: [{ tex: '' }] },
    id: { default: null },
    label: { default: null },
  }),
  parseHTML: () => [{ tag: 'div[data-derivation]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-derivation': '' })],
  addNodeView: () => (props) => derivationView(props),
})

// ── Razonamiento en dos columnas (contenido rico recursivo) ──────────────────

/**
 * **Razonamiento**: layout de dos columnas por fila; cada celda es contenido de bloque **rico y
 * recursivo** (párrafos con fórmulas, math en bloque, tablas, figuras…). Tres nodos de contenido
 * (reasoning → fila → celda), editables nativamente (sin popover). Las filas/columnas y el título
 * se gestionan desde la barra contextual. Compila a dos `minipage` por fila (ver `compile.ts`).
 */
/** Node view del razonamiento: rejilla de filas (contentDOM) + un botón **"+ fila"** siempre visible. */
function reasoningView({ node, editor, getPos }: NodeViewRendererProps) {
  const dom = document.createElement('div')
  dom.className = 'matex-reasoning'
  if (node.attrs.title) dom.setAttribute('data-title', String(node.attrs.title))
  const contentDOM = document.createElement('div')
  contentDOM.className = 'matex-reasoning-rows'
  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'matex-reasoning-addrow'
  addBtn.textContent = '+ fila'
  addBtn.title = 'Agregar una fila (otro paso, con su divisor izquierda | derecha)'
  addBtn.contentEditable = 'false'
  addBtn.addEventListener('mousedown', (e) => e.preventDefault()) // no robar la selección
  addBtn.addEventListener('click', () => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos == null) return
    const cell = { type: 'reasoningCell', content: [{ type: 'paragraph' }] }
    editor.chain().insertContentAt(pos + node.nodeSize - 1, { type: 'reasoningRow', attrs: { boxed: false }, content: [cell, cell] }).focus().run()
  })
  dom.append(contentDOM, addBtn)
  return {
    dom,
    contentDOM,
    update: (updated: typeof node) => {
      if (updated.type.name !== 'reasoning') return false
      if (updated.attrs.title) dom.setAttribute('data-title', String(updated.attrs.title))
      else dom.removeAttribute('data-title')
      return true
    },
    // `Node` acá es el de TipTap (colisiona) → uso el `Node` del DOM explícito para el target.
    ignoreMutation: (m: MutationRecord | { type: 'selection'; target: InstanceType<typeof globalThis.Node> }) => m.type !== 'selection' && !contentDOM.contains(m.target),
  }
}

export const Reasoning = Node.create({
  name: 'reasoning',
  group: 'block',
  content: 'reasoningRow+',
  defining: true,
  isolating: true,
  addAttributes: () => ({ title: { default: null }, id: { default: null }, label: { default: null } }),
  parseHTML: () => [{ tag: 'div[data-reasoning]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-reasoning': '', class: 'matex-reasoning', ...(node.attrs.title ? { 'data-title': String(node.attrs.title) } : {}) }),
    0,
  ],
  addNodeView: () => (props) => reasoningView(props),
})

export const ReasoningRow = Node.create({
  name: 'reasoningRow',
  content: 'reasoningCell reasoningCell',
  isolating: true,
  addAttributes: () => ({ boxed: { default: false } }),
  parseHTML: () => [{ tag: 'div[data-reasoning-row]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-reasoning-row': '', class: node.attrs.boxed ? 'matex-reasoning-row is-boxed' : 'matex-reasoning-row' }),
    0,
  ],
})

export const ReasoningCell = Node.create({
  name: 'reasoningCell',
  content: 'block+',
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-reasoning-cell]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-reasoning-cell': '', class: 'matex-reasoning-cell' }), 0],
})

// ── Escape hatch: LaTeX crudo ────────────────────────────────────────────────

export const RawLatex = Node.create({
  name: 'rawLatex',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: { default: '' } }),
  parseHTML: () => [{ tag: 'pre[data-raw-latex]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'pre',
    mergeAttributes(HTMLAttributes, { 'data-raw-latex': '' }),
    String(node.attrs.latex ?? ''),
  ],
  addNodeView: () => (props) =>
    editableAtomView(props, {
      name: 'rawLatex',
      attr: 'latex',
      inline: false,
      multiline: true,
      placeholder: '\\vspace{1em}',
      className: 'matex-raw-latex',
      renderStatic: (el, attrs) => {
        el.textContent = String(attrs.latex ?? '') || 'LaTeX crudo…'
      },
    }),
})

// ── Inclusión de archivo (\input) ────────────────────────────────────────────

/**
 * **Incluir archivo** (`\input{target}`): *atom* de bloque con `target` (ruta a un `.tex` del
 * proyecto). Se muestra como `📎 \input{ruta}` y se edita en el popover. Escotilla file-based.
 */
export const Include = Node.create({
  name: 'include',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({ target: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-include]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-include': '' }), String(node.attrs.target ?? '')],
  addNodeView: () => (props) =>
    editableAtomView(props, {
      name: 'include',
      attr: 'target',
      inline: false,
      multiline: false,
      placeholder: 'figuras/tikz1.tex',
      className: 'matex-include',
      renderStatic: (el, attrs) => {
        const t = String(attrs.target ?? '').trim()
        el.textContent = t ? `📎 \\input{${t}}` : '📎 Incluir archivo… (ruta del .tex)'
      },
    }),
})

// ── Caja / callout (tcolorbox) ───────────────────────────────────────────────

/** Etiqueta + ícono por variante de callout (encabezado visual). */
const CALLOUT_ES = {
  note: { label: 'Nota', icon: '📝' },
  tip: { label: 'Consejo', icon: '💡' },
  warning: { label: 'Cuidado', icon: '⚠️' },
  important: { label: 'Importante', icon: '❗' },
} as const

/**
 * **Caja / callout**: bloque con **contenido de bloques** (como el teorema) + encabezado no
 * editable (ícono + variante o título). La variante/título se editan en la barra contextual.
 * Compila a `tcolorbox`.
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes: () => ({ variant: { default: 'note' }, title: { default: null } }),
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-callout': '', 'data-variant': String(node.attrs.variant ?? 'note') }),
    0,
  ],
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'matex-callout'
      const header = document.createElement('div')
      header.className = 'matex-callout-header'
      header.contentEditable = 'false'
      const body = document.createElement('div')
      body.className = 'matex-callout-body'
      const paint = (n: typeof node): void => {
        dom.setAttribute('data-variant', String(n.attrs.variant ?? 'note'))
        const v = CALLOUT_ES[String(n.attrs.variant) as keyof typeof CALLOUT_ES] ?? CALLOUT_ES.note
        header.textContent = `${v.icon}  ${n.attrs.title ? String(n.attrs.title) : v.label}`
      }
      paint(node)
      dom.append(header, body)
      return {
        dom,
        contentDOM: body,
        update: (updated) => {
          if (updated.type.name !== 'callout') return false
          paint(updated)
          return true
        },
      }
    },
})

// ── Diapositiva y columnas (presentaciones, ME-23) ───────────────────────────

/**
 * **Diapositiva** (modo presentación): sección con título editable + toggle de *revelado
 * incremental*, y contenido de bloques arbitrario. Compila a un `frame` de beamer.
 */
export const Slide = Node.create({
  name: 'slide',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes: () => ({ title: { default: null }, reveal: { default: false } }),
  parseHTML: () => [{ tag: 'section[data-slide]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', mergeAttributes(HTMLAttributes, { 'data-slide': '' }), 0],
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      const dom = document.createElement('section')
      dom.className = 'matex-slide'
      const header = document.createElement('div')
      header.className = 'matex-slide-header'
      header.contentEditable = 'false'
      const badge = document.createElement('span')
      badge.className = 'matex-slide-badge'
      badge.textContent = 'Diapositiva'
      const titleInput = document.createElement('input')
      titleInput.className = 'matex-slide-title'
      titleInput.placeholder = 'Título de la diapositiva'
      titleInput.value = node.attrs.title ? String(node.attrs.title) : ''
      const revealWrap = document.createElement('label')
      revealWrap.className = 'matex-slide-reveal'
      const reveal = document.createElement('input')
      reveal.type = 'checkbox'
      reveal.checked = node.attrs.reveal === true
      revealWrap.append(reveal, document.createTextNode(' revelar de a uno'))
      const setAttr = (patch: Record<string, unknown>): void => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos == null) return
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...patch }))
      }
      titleInput.addEventListener('input', () => setAttr({ title: titleInput.value || null }))
      reveal.addEventListener('change', () => setAttr({ reveal: reveal.checked }))
      header.append(badge, titleInput, revealWrap)
      const body = document.createElement('div')
      body.className = 'matex-slide-body'
      dom.append(header, body)
      return {
        dom,
        contentDOM: body,
        update: (updated) => {
          if (updated.type.name !== 'slide') return false
          current = updated
          if (document.activeElement !== titleInput) titleInput.value = updated.attrs.title ? String(updated.attrs.title) : ''
          reveal.checked = updated.attrs.reveal === true
          return true
        },
      }
    },
})

/** Contenedor de **columnas** (fila) dentro de una diapositiva. */
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column+',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-columns]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '', class: 'matex-columns' }), 0],
})

/** Una **columna** (celda de la fila `columns`) con su fracción de ancho opcional. */
export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  addAttributes: () => ({ ratio: { default: null } }),
  parseHTML: () => [{ tag: 'div[data-column]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'matex-column' }), 0],
})

// ── Figura (imagen del proyecto + caption, referenciable) ────────────────────
// El nodo vive en su propio archivo (QA-10); se re-exporta para no tocar a los consumidores.
export { Figure, type FigureOptions } from './figureNode'

// ── Referencia cruzada en línea (\cref) ──────────────────────────────────────

/**
 * Referencia por **identidad**: `target` = el `id` del objeto. El editor la muestra
 * resuelta ("→ Teorema 1.1") y se edita con un **picker con filtro** que lista los
 * objetos referenciables (con su número en vivo). Al elegir, si el destino no tiene
 * `id`, se le asigna uno. Nunca se escribe una clave a mano.
 */
export const Ref = Node.create({
  name: 'ref',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ target: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-ref]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-ref': '' }),
    `\\cref{${String(node.attrs.target ?? '')}}`,
  ],
  // Atajo `@`: inserta una ref vacía y la selecciona → el node view abre el picker.
  addProseMirrorPlugins() {
    const type = this.type
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '@') return false
            const tr = view.state.tr.replaceRangeWith(from, to, type.create({ target: '' }))
            tr.setSelection(NodeSelection.create(tr.doc, from))
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      let popover: HTMLElement | null = null
      let detachOutside: (() => void) | null = null
      const dom = document.createElement('span')
      dom.className = 'matex-ref'

      const paint = (): void => {
        const target = String(current.attrs.target ?? '')
        const resolved = target ? resolveRef(editor.state, target) : null
        dom.textContent = resolved ? `→ ${resolved}` : target ? '⚠ referencia rota' : '→ elegir…'
        dom.classList.toggle('matex-ref-broken', Boolean(target) && !resolved)
        dom.title = resolved
          ? `Click: editar · Ctrl/Cmd+Click: ir a ${resolved}`
          : target
            ? 'Referencia rota — Click para reasignar'
            : 'Click para elegir el destino'
      }
      paint()

      /** Ir al destino: selecciona el objeto referenciado y hace scroll hasta él. */
      const goToTarget = (): void => {
        const target = String(current.attrs.target ?? '')
        if (!target) return
        const item = listReferenceables(editor.state).find((r) => r.id === target)
        if (item) editor.chain().focus().setNodeSelection(item.pos).scrollIntoView().run()
      }

      const closePicker = (): void => {
        if (!popover) return
        popover.remove()
        popover = null
        detachOutside?.()
        detachOutside = null
      }

      const select = (item: Referenceable): void => {
        const targetId = item.id ?? makeId()
        const refPos = typeof getPos === 'function' ? getPos() : null
        // Cerramos ANTES de despachar: si no, el `update()` que dispara el cambio de
        // `target` ve el popover abierto y saltea el `paint()` → no se refresca.
        closePicker()
        editor
          .chain()
          .command(({ tr }) => {
            if (!item.id) {
              // Etiquetar el destino. En ecuaciones el id vive en la **fila** referenciada
              // (y esa fila queda numerada, para que el número exista/sea estable).
              if (item.rowIndex != null) {
                const destNode = tr.doc.nodeAt(item.pos)
                const rows = Array.isArray(destNode?.attrs.rows)
                  ? (destNode.attrs.rows as EquationRow[]).map((r) => ({ ...r }))
                  : []
                const row = rows[item.rowIndex]
                if (row) {
                  row.id = targetId
                  row.numbered = true
                  tr.setNodeAttribute(item.pos, 'rows', rows)
                }
              } else {
                tr.setNodeAttribute(item.pos, 'id', targetId)
              }
            }
            if (refPos != null) tr.setNodeAttribute(refPos, 'target', targetId)
            return true
          })
          // Cursor después de la ref, **sin scroll** (no saltar a otra parte del doc).
          .focus(refPos != null ? refPos + 1 : null, { scrollIntoView: false })
          .run()
      }

      const openPicker = (): void => {
        if (popover) return
        const rect = dom.getBoundingClientRect()
        popover = document.createElement('div')
        popover.className = 'matex-ref-picker'
        const input = document.createElement('input')
        input.className = 'matex-atom-popover-field'
        input.setAttribute('placeholder', 'Filtrar referenciables…')
        const list = document.createElement('div')
        list.className = 'matex-ref-list'
        const items = listReferenceables(editor.state)
        let shown: Referenceable[] = []
        const rows: HTMLElement[] = []
        let highlight = 0

        const paintHighlight = (): void => {
          rows.forEach((r, i) => r.classList.toggle('matex-ref-item-active', i === highlight))
          rows[highlight]?.scrollIntoView({ block: 'nearest' })
        }
        const render = (filter: string): void => {
          list.replaceChildren()
          rows.length = 0
          const f = filter.toLowerCase()
          shown = items.filter((it) => `${it.typeLabel} ${it.number} ${it.description}`.toLowerCase().includes(f))
          if (shown.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'matex-ref-empty'
            empty.textContent = 'No hay nada referenciable (agregá secciones, teoremas, ecuaciones numeradas o tablas).'
            list.appendChild(empty)
            return
          }
          shown.forEach((it, i) => {
            const row = document.createElement('button')
            row.type = 'button'
            row.className = 'matex-ref-item'
            row.textContent = `${it.typeLabel} ${it.number}${it.description ? ` — ${it.description}` : ''}`
            row.addEventListener('mousedown', (event) => {
              event.preventDefault()
              select(it)
            })
            row.addEventListener('mousemove', () => {
              highlight = i
              paintHighlight()
            })
            rows.push(row)
            list.appendChild(row)
          })
          highlight = Math.max(0, Math.min(highlight, shown.length - 1))
          paintHighlight()
        }
        input.addEventListener('input', () => {
          highlight = 0
          render(input.value)
        })
        input.addEventListener('keydown', (event) => {
          const key = event as KeyboardEvent
          if (key.key === 'Escape') {
            key.preventDefault()
            closePicker()
            editor.commands.focus(undefined, { scrollIntoView: false })
          } else if (key.key === 'ArrowDown' && shown.length > 0) {
            key.preventDefault()
            highlight = (highlight + 1) % shown.length
            paintHighlight()
          } else if (key.key === 'ArrowUp' && shown.length > 0) {
            key.preventDefault()
            highlight = (highlight - 1 + shown.length) % shown.length
            paintHighlight()
          } else if (key.key === 'Enter' && shown[highlight]) {
            key.preventDefault()
            select(shown[highlight]!)
          }
        })
        popover.append(input, list)
        document.body.appendChild(popover)
        render('')
        positionPopover(popover, rect)
        setTimeout(() => input.focus(), 0)
        detachOutside = closeOnOutsideMousedown(popover, dom, closePicker)
      }

      dom.addEventListener('mousedown', (event) => {
        event.preventDefault()
        // Ctrl/Cmd+Click = ir al destino; click normal = editar (re-elegir).
        if (event.metaKey || event.ctrlKey) goToTarget()
        else openPicker()
      })
      // Puente para re-editar por teclado (Enter con la ref seleccionada, ver MatexKeymap).
      ;(dom as HTMLElement & { __matexOpenEditor?: () => void }).__matexOpenEditor = openPicker

      // Reactivo: el texto resuelto depende de la numeración de todo el doc.
      let lastResolved = ''
      const onUpdate = (): void => {
        if (popover) return
        const target = String(current.attrs.target ?? '')
        const r = target ? (resolveRef(editor.state, target) ?? 'broken') : ''
        if (r !== lastResolved) {
          lastResolved = r
          paint()
        }
      }
      editor.on('update', onUpdate)

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'ref') return false
          current = updated
          if (!popover) paint()
          return true
        },
        selectNode: () => {
          dom.classList.add('matex-selected')
          if (!popover && !current.attrs.target) openPicker()
        },
        deselectNode: () => dom.classList.remove('matex-selected'),
        ignoreMutation: () => true,
        destroy: () => {
          editor.off('update', onUpdate)
          closePicker()
        },
      }
    },
})

// ── Cita bibliográfica en línea (\parencite/\textcite) ───────────────────────

/**
 * Puente a la **biblioteca de referencias**, que vive a nivel documento (`doc.references`,
 * fuera de ProseMirror, como `meta`). El workspace registra acá un proveedor de las claves
 * disponibles; los node views (cita, marcador) lo consultan. Al cambiar la biblioteca, el
 * workspace despacha el evento `MATEX_BIB_EVENT` para que se repinten. Mismo patrón que
 * `setActiveMathInsert` (bridge vanilla node view ↔ React).
 */
let bibKeysProvider: () => string[] = () => []
export function setBibKeysProvider(fn: () => string[]): void {
  bibKeysProvider = fn
}
/** Evento global que dispara el workspace cuando cambia `doc.references` (repintar chips/rotos). */
export const MATEX_BIB_EVENT = 'matex-bib-changed'

/**
 * Cita en línea: *atom* con `keys` (claves BibTeX) + `style` (`parenthetical`→`\parencite`
 * «[1]», `textual`→`\textcite` «Autor (año)»). Se muestra resuelta («[knuth1984]») y se edita
 * con un **picker**: input de claves separadas por coma + chips de las claves disponibles (de
 * la bibliografía del doc) para agregar de un click + toggle de estilo. Atajo `#` inserta una
 * cita vacía. Las claves rotas (no están en la bibliografía) se marcan en rojo.
 */
export const Cite = Node.create({
  name: 'cite',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ keys: { default: [] as string[] }, style: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-cite]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-cite': '' }),
    `\\parencite{${(Array.isArray(node.attrs.keys) ? (node.attrs.keys as string[]) : []).join(',')}}`,
  ],
  addProseMirrorPlugins() {
    const type = this.type
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '#') return false
            const tr = view.state.tr.replaceRangeWith(from, to, type.create({ keys: [] }))
            tr.setSelection(NodeSelection.create(tr.doc, from))
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      let popover: HTMLElement | null = null
      let detachOutside: (() => void) | null = null
      const dom = document.createElement('span')
      dom.className = 'matex-cite'

      const keysOf = (): string[] => (Array.isArray(current.attrs.keys) ? (current.attrs.keys as string[]) : [])
      const styleOf = (): 'parenthetical' | 'textual' => (current.attrs.style === 'textual' ? 'textual' : 'parenthetical')

      const paint = (): void => {
        const keys = keysOf()
        if (keys.length === 0) {
          dom.textContent = '⁋ cita…'
          dom.classList.remove('matex-cite-broken')
          dom.title = 'Click para elegir la cita'
          return
        }
        const known = new Set(bibKeysProvider())
        const broken = keys.some((k) => !known.has(k))
        dom.textContent = styleOf() === 'textual' ? keys.join(', ') : `[${keys.join(', ')}]`
        dom.classList.toggle('matex-cite-broken', broken)
        dom.title = broken ? 'Alguna clave no está en la bibliografía · Click para editar' : 'Click: editar cita'
      }
      paint()
      // La biblioteca vive fuera de ProseMirror: repintar cuando el workspace la cambia.
      const onBibChanged = (): void => {
        if (!popover) paint()
      }
      document.addEventListener(MATEX_BIB_EVENT, onBibChanged)

      const setAttrs = (keys: string[], style: 'parenthetical' | 'textual'): void => {
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        editor.chain().command(({ tr }) => {
          tr.setNodeAttribute(pos, 'keys', keys)
          tr.setNodeAttribute(pos, 'style', style === 'textual' ? 'textual' : null)
          return true
        }).run()
      }

      const closePopover = (): void => {
        if (!popover) return
        popover.remove()
        popover = null
        detachOutside?.()
        detachOutside = null
      }

      const openPopover = (): void => {
        if (popover) return
        const rect = dom.getBoundingClientRect()
        let draftKeys = keysOf()
        let draftStyle = styleOf()
        popover = document.createElement('div')
        popover.className = 'matex-cite-picker'

        const input = document.createElement('input')
        input.className = 'matex-atom-popover-field'
        input.setAttribute('placeholder', 'clave1, clave2')
        input.value = draftKeys.join(', ')

        const parseInput = (): string[] => input.value.split(',').map((k) => k.trim()).filter((k) => k.length > 0)
        const commit = (): void => {
          draftKeys = parseInput()
          setAttrs(draftKeys, draftStyle)
          paint()
        }

        // Toggle de estilo (parenthetical/textual).
        const styleRow = document.createElement('div')
        styleRow.className = 'matex-cite-style'
        const mkStyleBtn = (value: 'parenthetical' | 'textual', label: string): HTMLButtonElement => {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'matex-cite-style-btn'
          b.textContent = label
          b.addEventListener('mousedown', (e) => {
            e.preventDefault()
            draftStyle = value
            styleRow.querySelectorAll('.matex-cite-style-btn').forEach((el) => el.classList.remove('is-active'))
            b.classList.add('is-active')
            commit()
          })
          if (draftStyle === value) b.classList.add('is-active')
          return b
        }
        styleRow.append(mkStyleBtn('parenthetical', '[cita]'), mkStyleBtn('textual', 'Autor (año)'))

        // Chips de claves disponibles en la bibliografía (click = agregar).
        const chips = document.createElement('div')
        chips.className = 'matex-cite-chips'
        const available = [...new Set(bibKeysProvider())]
        if (available.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'matex-ref-empty'
          empty.textContent = 'No hay claves: agregá un bloque de Bibliografía con entradas .bib.'
          chips.appendChild(empty)
        } else {
          for (const key of available) {
            const chip = document.createElement('button')
            chip.type = 'button'
            chip.className = 'matex-cite-chip'
            chip.textContent = key
            chip.addEventListener('mousedown', (e) => {
              e.preventDefault()
              const cur = parseInput()
              if (!cur.includes(key)) input.value = [...cur, key].join(', ')
              commit()
              input.focus()
            })
            chips.appendChild(chip)
          }
        }

        input.addEventListener('input', commit)
        input.addEventListener('keydown', (event) => {
          const key = event as KeyboardEvent
          if (key.key === 'Enter' || key.key === 'Escape') {
            key.preventDefault()
            closePopover()
            editor.commands.focus(undefined, { scrollIntoView: false })
          }
        })

        popover.append(styleRow, input, chips)
        document.body.appendChild(popover)
        positionPopover(popover, rect)
        setTimeout(() => input.focus(), 0)
        detachOutside = closeOnOutsideMousedown(popover, dom, () => {
          commit()
          closePopover()
        })
      }

      dom.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos != null) editor.commands.setNodeSelection(pos)
        openPopover()
      })
      ;(dom as HTMLElement & { __matexOpenEditor?: () => void }).__matexOpenEditor = openPopover

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'cite') return false
          current = updated
          if (!popover) paint()
          return true
        },
        selectNode: () => {
          dom.classList.add('matex-selected')
          if (!popover && keysOf().length === 0) openPopover()
        },
        deselectNode: () => dom.classList.remove('matex-selected'),
        ignoreMutation: () => true,
        destroy: () => {
          document.removeEventListener(MATEX_BIB_EVENT, onBibChanged)
          closePopover()
        },
      }
    },
})

// ── Nota al pie en línea (\footnote) ─────────────────────────────────────────

/**
 * **Nota al pie** en línea: *atom* con `text` (contenido de la nota). Se muestra como un
 * marcador superíndice «†» (el número lo pone LaTeX); el contenido se edita en el popover
 * (textarea). Atajo: no tiene (se inserta desde el menú).
 */
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ text: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-footnote]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-footnote': '' }),
    String(node.attrs.text ?? ''),
  ],
  addNodeView: () => (props) =>
    editableAtomView(props, {
      name: 'footnote',
      attr: 'text',
      inline: true,
      multiline: true,
      placeholder: 'texto de la nota al pie',
      className: 'matex-footnote',
      renderStatic: (el, attrs) => {
        el.textContent = '†'
        el.title = String(attrs.text ?? '').trim() || 'Nota al pie (vacía) — clic para editar'
      },
    }),
})

// ── Entornos tipo teorema ────────────────────────────────────────────────────

/** Nombres en español de los entornos tipo teorema, para el encabezado visual. */
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

/**
 * Entorno tipo teorema (teorema/definición/demostración/…): nodo con **contenido de
 * bloque** (párrafos, math…), encabezado no editable con el nombre y el título. El
 * `variant` se elige al insertar; el título se edita clickeando el encabezado.
 */
export const Theorem = Node.create({
  name: 'theorem',
  group: 'block',
  content: 'block+',
  defining: true,
  // Sus bordes son frontera: backspace/lift no cruzan → dos entornos (teorema/proof…)
  // **no se fusionan** al borrar (son el mismo tipo con distinto `variant`).
  isolating: true,
  addAttributes: () => ({
    variant: { default: 'theorem' },
    title: { default: null },
    id: { default: null },
    label: { default: null },
    proves: { default: null },
  }),
  parseHTML: () => [{ tag: 'div[data-theorem]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-theorem': '', 'data-variant': String(node.attrs.variant ?? 'theorem') }),
    0,
  ],
  // El título/proves se editan en la barra contextual de teorema (no por prompt).
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      const dom = document.createElement('div')
      dom.className = 'matex-theorem'
      const header = document.createElement('div')
      header.className = 'matex-theorem-header'
      header.contentEditable = 'false'
      const body = document.createElement('div')
      body.className = 'matex-theorem-body'
      const paint = (n: typeof node): void => {
        dom.setAttribute('data-variant', String(n.attrs.variant ?? 'theorem'))
        const name = VARIANT_ES[String(n.attrs.variant)] ?? 'Teorema'
        // Número en vivo (por sección, como LaTeX); proof/remark no se numeran.
        const pos = typeof getPos === 'function' ? getPos() : null
        const num = pos == null ? undefined : numberingKey.getState(editor.state)?.theorem.get(pos)
        // proof diferido: mostramos "Demostración de → <ref>"; si no, el título.
        const suffix =
          n.attrs.variant === 'proof' && n.attrs.proves
            ? ` de → ${String(n.attrs.proves)}`
            : n.attrs.title
              ? ` (${String(n.attrs.title)})`
              : ''
        const label = n.attrs.label ? `  ·  ${String(n.attrs.label)}` : ''
        header.textContent = `${name}${num ? ` ${num}` : ''}${suffix}${label}`
      }
      paint(node)
      dom.append(header, body)
      // Reactivo: el número depende de otras secciones/teoremas → re-pintar el header.
      let lastNum = ''
      const onDocUpdate = (): void => {
        const pos = typeof getPos === 'function' ? getPos() : null
        const num = pos == null ? '' : (numberingKey.getState(editor.state)?.theorem.get(pos) ?? '')
        if (num !== lastNum) {
          lastNum = num
          paint(current)
        }
      }
      editor.on('update', onDocUpdate)
      return {
        dom,
        contentDOM: body,
        update: (updated) => {
          if (updated.type.name !== 'theorem') return false
          current = updated
          paint(updated)
          return true
        },
        destroy: () => editor.off('update', onDocUpdate),
      }
    },
})

// ── Tablas (TipTap tables) ───────────────────────────────────────────────────

/**
 * `Table` de TipTap **extendida** con los atributos de presentación de Matex
 * (capa 2): `align` (por columna), `caption`, `label`, `rules`. Van como attrs
 * **no renderizados a HTML** (`rendered: false`): viven en el AST, no en el DOM. El
 * `header` se modela con celdas `tableHeader` en la primera fila (natural en TipTap).
 * Sin `resizable`: no exponemos ancho de columna (sería otra capa-2 futura).
 */
export const MatexTable = Table.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      // `align` (por columna) es derivado de las celdas; caption/label/rules van al AST.
      caption: { default: null, rendered: false },
      id: { default: null, rendered: false },
      label: { default: null, rendered: false },
      rules: { default: null, rendered: false },
    }
  },
}).configure({ resizable: false })

// Alineación **por celda** (así se VE en el editor); el AST la agrega por columna.
const cellAlignAttribute = {
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.textAlign || null,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.align ? { style: `text-align: ${String(attrs.align)}` } : {},
  },
}

export const TableCell = BaseTableCell.extend({
  addAttributes() {
    return { ...(this.parent?.() ?? {}), ...cellAlignAttribute }
  },
})

export const TableHeader = BaseTableHeader.extend({
  addAttributes() {
    return { ...(this.parent?.() ?? {}), ...cellAlignAttribute }
  },
})

export { TableRow }

/**
 * Inserta un párrafo vacío **después del bloque de nivel superior** actual y coloca
 * el cursor ahí. Resuelve "escribir entre/después de bloques" (teorema/proof/tabla)
 * por teclado, donde el gapcursor no llega: entre contenedores con texto el cursor
 * fluye por su contenido y ProseMirror no ve un hueco.
 */
function insertParagraphAfterBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection
  const pos = $from.depth >= 1 ? $from.after(1) : editor.state.selection.to
  return editor.chain().insertContentAt(pos, { type: 'paragraph' }).setTextSelection(pos + 1).focus().run()
}

/**
 * Atajos de teclado de Matex:
 * - **Enter** sobre un atom seleccionado (fórmula/ref/rawLatex) → abre su popover.
 * - **Mod-Enter** → párrafo nuevo después del bloque actual (escapar de contenedores).
 */
export const MatexKeymap = Extension.create({
  name: 'matexKeymap',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { view } = this.editor
        const sel = view.state.selection
        if (!(sel instanceof NodeSelection)) return false
        const dom = view.nodeDOM(sel.from) as (HTMLElement & { __matexOpenEditor?: () => void }) | null
        if (dom && typeof dom.__matexOpenEditor === 'function') {
          dom.__matexOpenEditor()
          return true
        }
        return false
      },
      'Mod-Enter': () => insertParagraphAfterBlock(this.editor),
    }
  },
})

/**
 * Atributos Matex sobre nodos de StarterKit: `label` en `heading` (para `\cref`).
 * Se agrega como atributo global para no re-declarar el nodo `heading`.
 */
export const MatexBlockAttrs = Extension.create({
  name: 'matexBlockAttrs',
  addGlobalAttributes() {
    return [{ types: ['heading', 'part'], attributes: { id: { default: null }, label: { default: null } } }]
  },
})

/**
 * **Parte** (`\part`, ME-46): la división por encima del capítulo. Título editable en línea
 * (como un heading), rotulada «Parte I/II/…» por el plugin de numeración (CSS `data-part-number`).
 */
export const Part = Node.create({
  name: 'part',
  group: 'block',
  content: 'inline*',
  defining: true,
  parseHTML: () => [{ tag: 'h1[data-part]' }],
  renderHTML: ({ HTMLAttributes }) => ['h1', mergeAttributes(HTMLAttributes, { 'data-part': '', class: 'matex-part' }), 0],
})
