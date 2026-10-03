import { mergeAttributes, Node, type Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

/**
 * **Bloques propios de cada familia de documento** (examen · CV · póster) en el editor visual.
 *
 * Existían en el modelo (`ExamQuestionNode`, `CvEntryNode`, `PosterBlockNode`) y en las
 * plantillas, pero no como nodos del editor: TipTap no los reconocía, **abría esas plantillas
 * vacías** y, al primer cambio, el autosave pisaba el documento con lo que veía (vacío). Ahora el
 * editor los conoce y se pueden insertar y editar.
 *
 * Los campos (puntaje, período, título…) son `<input>` en la cabecera del bloque: se guardan como
 * atributos del nodo y ProseMirror no los toca (`stopEvent` / `ignoreMutation`).
 */

type GetPos = (() => number | undefined) | boolean

/** Escribe atributos del nodo en la posición actual (si el nodo sigue en el documento). */
function setAttrs(editor: Editor, getPos: GetPos, current: PmNode, patch: Record<string, unknown>): void {
  if (typeof getPos !== 'function') return
  const pos = getPos()
  if (pos == null) return
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...patch }))
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text) node.textContent = text
  return node
}

/** Los eventos que nacen en los campos de la cabecera son del campo, no de ProseMirror. */
function isFieldEvent(event: Event): boolean {
  const target = event.target as HTMLElement | null
  return Boolean(target?.closest('input, select, button, textarea'))
}

// ── Examen ─────────────────────────────────────────────────────────────────────────────

/**
 * **Pregunta de examen**: enunciado (bloques) + puntaje + solución opcional. La solución es un
 * sub-bloque editable (`examSolution`), no un dato opaco: se escribe como cualquier contenido y
 * se imprime solo en la versión «con soluciones» (una ocasión de emisión, no del modelo).
 */
export const ExamQuestion = Node.create({
  name: 'examQuestion',
  group: 'block',
  content: 'block+ examSolution?',
  defining: true,
  isolating: true,
  addAttributes: () => ({ points: { default: null } }),
  parseHTML: () => [{ tag: 'section[data-exam-question]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', mergeAttributes(HTMLAttributes, { 'data-exam-question': '' }), 0],
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      const dom = el('section', 'matex-family-block matex-exam-question')
      const header = el('div', 'matex-family-header')
      header.contentEditable = 'false'
      const badge = el('span', 'matex-family-badge matex-exam-number')
      const points = el('input', 'matex-family-field matex-exam-points')
      points.type = 'number'
      points.min = '0'
      points.step = '0.5'
      points.placeholder = '—'
      points.title = 'Puntaje de la pregunta'
      const pointsLabel = el('label', 'matex-family-inline')
      pointsLabel.append(points, document.createTextNode(' pts'))
      const addSolution = el('button', 'matex-family-action', '+ Solución')
      addSolution.type = 'button'
      addSolution.title = 'Agregar la resolución de referencia (va solo en la versión con soluciones)'
      header.append(badge, el('span', 'matex-family-spacer'), pointsLabel, addSolution)
      const body = el('div', 'matex-family-body')
      dom.append(header, body)

      const sync = (n: PmNode) => {
        if (document.activeElement !== points) points.value = n.attrs.points == null ? '' : String(n.attrs.points)
        let hasSolution = false
        n.forEach((child) => {
          if (child.type.name === 'examSolution') hasSolution = true
        })
        addSolution.hidden = hasSolution
      }
      sync(node)

      points.addEventListener('input', () => {
        const value = points.value.trim() === '' ? null : Number(points.value)
        setAttrs(editor, getPos, current, { points: value != null && Number.isFinite(value) ? value : null })
      })
      addSolution.addEventListener('click', () => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos == null) return
        const end = pos + current.nodeSize - 1
        editor
          .chain()
          .insertContentAt(end, { type: 'examSolution', content: [{ type: 'paragraph' }] })
          .focus(end + 2)
          .run()
      })

      return {
        dom,
        contentDOM: body,
        stopEvent: isFieldEvent,
        ignoreMutation: (mutation) => header.contains(mutation.target as globalThis.Node),
        update: (updated) => {
          if (updated.type.name !== 'examQuestion') return false
          current = updated
          sync(updated)
          return true
        },
      }
    },
})

/** **Solución** de una pregunta: solo vive adentro de `examQuestion` (no es un bloque suelto). */
export const ExamSolution = Node.create({
  name: 'examSolution',
  content: 'block+',
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-exam-solution]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-exam-solution': '' }), 0],
  addNodeView:
    () =>
    ({ editor, getPos, node }) => {
      let current = node
      const dom = el('div', 'matex-exam-solution')
      const header = el('div', 'matex-exam-solution-header')
      header.contentEditable = 'false'
      const remove = el('button', 'matex-family-action', 'Quitar')
      remove.type = 'button'
      remove.addEventListener('click', () => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos == null) return
        editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize))
      })
      header.append(el('span', '', 'Solución · solo en la versión con soluciones'), remove)
      const body = el('div', 'matex-exam-solution-body')
      dom.append(header, body)
      return {
        dom,
        contentDOM: body,
        stopEvent: isFieldEvent,
        ignoreMutation: (mutation) => header.contains(mutation.target as globalThis.Node),
        update: (updated) => {
          if (updated.type.name !== 'examSolution') return false
          current = updated
          return true
        },
      }
    },
})

// ── Currículum ─────────────────────────────────────────────────────────────────────────

const CV_FIELDS: ReadonlyArray<{ key: string; label: string; placeholder: string; wide?: boolean }> = [
  { key: 'period', label: 'Período', placeholder: '2020–2024' },
  { key: 'role', label: 'Rol', placeholder: 'Ayudante de cátedra' },
  { key: 'org', label: 'Institución', placeholder: 'Universidad…' },
  { key: 'place', label: 'Lugar', placeholder: 'Ciudad' },
  { key: 'detail', label: 'Detalle', placeholder: 'Qué hiciste, logros…', wide: true },
]

/** **Entrada de CV**: una línea de la trayectoria (cuándo, qué rol, dónde, detalle). */
export const CvEntry = Node.create({
  name: 'cvEntry',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => Object.fromEntries(CV_FIELDS.map((field) => [field.key, { default: null }])),
  parseHTML: () => [{ tag: 'div[data-cv-entry]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-cv-entry': '' })],
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      const dom = el('div', 'matex-family-block matex-cv-entry')
      dom.contentEditable = 'false'
      const header = el('div', 'matex-family-header')
      header.append(el('span', 'matex-family-badge', 'Entrada de CV'))
      const grid = el('div', 'matex-cv-grid')
      const inputs = new Map<string, HTMLInputElement>()
      for (const field of CV_FIELDS) {
        const wrap = el('label', `matex-cv-field${field.wide ? ' matex-cv-field--wide' : ''}`)
        const input = el('input', 'matex-family-field')
        input.placeholder = field.placeholder
        input.value = node.attrs[field.key] ? String(node.attrs[field.key]) : ''
        input.addEventListener('input', () => setAttrs(editor, getPos, current, { [field.key]: input.value || null }))
        wrap.append(el('span', 'matex-cv-label', field.label), input)
        grid.append(wrap)
        inputs.set(field.key, input)
      }
      dom.append(header, grid)
      return {
        dom,
        stopEvent: isFieldEvent,
        ignoreMutation: () => true,
        update: (updated) => {
          if (updated.type.name !== 'cvEntry') return false
          current = updated
          for (const [key, input] of inputs) {
            if (document.activeElement !== input) input.value = updated.attrs[key] ? String(updated.attrs[key]) : ''
          }
          return true
        },
      }
    },
})

// ── Póster ─────────────────────────────────────────────────────────────────────────────

/**
 * **Bloque de póster**: un recuadro con título; `column` fija en qué columna de la grilla cae
 * (vacío = se reparten en orden). Cuántas columnas hay lo dice la familia (`Documento`).
 */
export const PosterBlock = Node.create({
  name: 'posterBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes: () => ({ title: { default: null }, column: { default: null } }),
  parseHTML: () => [{ tag: 'section[data-poster-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', mergeAttributes(HTMLAttributes, { 'data-poster-block': '' }), 0],
  addNodeView:
    () =>
    ({ node, editor, getPos }) => {
      let current = node
      const dom = el('section', 'matex-family-block matex-poster-block')
      const header = el('div', 'matex-family-header')
      header.contentEditable = 'false'
      const title = el('input', 'matex-family-field matex-family-title')
      title.placeholder = 'Título del bloque'
      const column = el('select', 'matex-family-field')
      column.title = 'Columna del póster'
      column.append(new Option('Columna: auto', ''))
      for (let n = 1; n <= 4; n++) column.append(new Option(`Columna ${n}`, String(n)))
      header.append(el('span', 'matex-family-badge', 'Bloque'), title, column)
      const body = el('div', 'matex-family-body')
      dom.append(header, body)

      const sync = (n: PmNode) => {
        if (document.activeElement !== title) title.value = n.attrs.title ? String(n.attrs.title) : ''
        column.value = n.attrs.column == null ? '' : String(n.attrs.column)
      }
      sync(node)
      title.addEventListener('input', () => setAttrs(editor, getPos, current, { title: title.value || null }))
      column.addEventListener('change', () => setAttrs(editor, getPos, current, { column: column.value ? Number(column.value) : null }))

      return {
        dom,
        contentDOM: body,
        stopEvent: isFieldEvent,
        ignoreMutation: (mutation) => header.contains(mutation.target as globalThis.Node),
        update: (updated) => {
          if (updated.type.name !== 'posterBlock') return false
          current = updated
          sync(updated)
          return true
        },
      }
    },
})
