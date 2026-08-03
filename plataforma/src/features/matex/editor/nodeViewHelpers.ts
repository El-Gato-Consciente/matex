import type { NodeViewRendererProps } from '@tiptap/core'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { matexKatexMacros } from '../core'
import { autoGrowInput, insertIntoInput, setActiveMathInsert } from './mathPalette'
import { attachMathAutocomplete } from './mathAutocomplete'

/**
 * **Infraestructura compartida de los node views** de TipTap (QA-10, slice 2). Los helpers de
 * DOM que varios nodos reusaban desde `nodes.ts`: posicionar popovers, renderizar KaTeX, cerrar al
 * click-afuera, y el **node view genérico de *atom* editable** (input flotante con preview en vivo).
 * Se extrajeron para que `nodes.ts` quede en definiciones de nodo y para partirlo por familia sin
 * duplicar este plumbing. Es DOM imperativo (no testeable sin jsdom), pero **cohesivo y en un lugar**.
 */

// Mismas macros que el compilador inyecta en el preámbulo LaTeX (fuente única en
// `matex-core/macros.ts`): así el preview de KaTeX y el PDF coinciden.
const MACROS: Record<string, string> = matexKatexMacros()

/**
 * Posiciona un popover `fixed`: debajo del ancla si entra, si no **arriba**, y clampeado al
 * viewport (para que no se corte fuera de pantalla). Requiere que el popover ya esté en el DOM.
 */
export function positionPopover(popover: HTMLElement, anchor: DOMRect): void {
  const margin = 6
  const { innerWidth: vw, innerHeight: vh } = window
  const { width, height } = popover.getBoundingClientRect()
  let top = anchor.bottom + margin
  if (top + height > vh - 8) {
    const above = anchor.top - margin - height
    top = above >= 8 ? above : Math.max(8, vh - height - 8)
  }
  const left = Math.max(8, Math.min(anchor.left, vw - width - 8))
  popover.style.top = `${top}px`
  popover.style.left = `${left}px`
}

/** Genera un id estable corto para un objeto que se referencia por primera vez. */
export function makeId(): string {
  return `mx-${Math.random().toString(36).slice(2, 8)}`
}

/** Renderiza `tex` en `el` con KaTeX (macros del compilador); si falla, deja el crudo. */
export function katexInto(el: HTMLElement, tex: string, display: boolean): void {
  try {
    katex.render(tex.trim() || '\\square', el, { throwOnError: false, displayMode: display, macros: MACROS })
  } catch {
    el.textContent = tex
  }
}

/**
 * Registra un listener global que dispara `onOutside` al hacer mousedown fuera de `panel` y de
 * `host` (el popover flotante y el nodo que lo ancla). Devuelve la función para desregistrarlo
 * (llamarla al cerrar). Centraliza el plumbing común de los tres popovers (atom inline, editor de
 * filas, picker de refs).
 */
export function closeOnOutsideMousedown(
  panel: HTMLElement,
  host: HTMLElement,
  onOutside: () => void,
  ignoreSelector?: string,
): () => void {
  const handler = (event: MouseEvent): void => {
    const target = event.target as globalThis.Node
    if (panel.contains(target) || host.contains(target)) return
    // No cerrar si el click cae en un contenedor "amigo" (p. ej. la barra contextual,
    // donde vive la paleta de símbolos que inserta en este popover).
    if (ignoreSelector) {
      const el = target instanceof globalThis.Element ? target : target.parentElement
      if (el?.closest(ignoreSelector)) return
    }
    onOutside()
  }
  document.addEventListener('mousedown', handler, true)
  return () => document.removeEventListener('mousedown', handler, true)
}

// ── Node view editable inline (atoms) ────────────────────────────────────────

export interface EditableAtomSpec {
  /** Nombre del nodo (para `setNodeAttribute`). */
  name: string
  /** Atributo que se edita (`tex` | `latex` | `target`). */
  attr: string
  /** En línea (span/input) o bloque (div/textarea). */
  inline: boolean
  /** Textarea multilínea (bloque) vs input de una línea. */
  multiline: boolean
  placeholder: string
  className: string
  /** Muestra la paleta de símbolos/plantillas (asistente de fórmulas) en el popover. */
  palette?: boolean
  /** Pinta la vista estática (KaTeX/texto) con los attrs actuales. */
  renderStatic: (el: HTMLElement, attrs: Record<string, unknown>) => void
}

/**
 * Node view genérico para un *atom* editable con **popover flotante**: la vista (KaTeX) queda **en
 * el lienzo** y se re-renderiza en vivo mientras escribís el LaTeX en un input que **flota** al lado
 * (sin reflow: nada se mueve). Enter/click-afuera confirma, Escape cancela. Un solo dispatch al
 * confirmar (no ensucia el undo).
 */
export function editableAtomView({ node, editor, getPos }: NodeViewRendererProps, spec: EditableAtomSpec) {
  let current = node
  let popover: HTMLElement | null = null
  let detachOutside: (() => void) | null = null
  let detachAutocomplete: (() => void) | null = null
  let draft = ''

  const dom = document.createElement(spec.inline ? 'span' : 'div')
  dom.className = spec.className
  const staticEl = document.createElement(spec.inline ? 'span' : 'div')
  dom.appendChild(staticEl)

  // Pinta la vista con el valor actual, o con `override` (preview en vivo del draft).
  const paintStatic = (override?: string): void => {
    staticEl.replaceChildren()
    const attrs = override != null ? { ...current.attrs, [spec.attr]: override } : current.attrs
    spec.renderStatic(staticEl, attrs)
  }

  const closePopover = (): void => {
    dom.classList.remove('matex-editing')
    if (!popover) return
    popover.remove()
    popover = null
    if (spec.palette) setActiveMathInsert(null)
    detachAutocomplete?.()
    detachAutocomplete = null
    detachOutside?.()
    detachOutside = null
  }

  const caretAfter = (): void => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null) editor.chain().focus().setTextSelection(pos + 1).run()
    else editor.commands.focus()
  }
  // `moveCaret`: al salir por teclado (Enter/Escape) devolvemos el foco al editor
  // después del atom; al salir por click-afuera, respetamos dónde clickeó el usuario.
  const commit = (moveCaret: boolean): void => {
    const value = draft
    closePopover()
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null && value !== String(current.attrs[spec.attr] ?? '')) {
      editor.chain().command(({ tr }) => {
        tr.setNodeAttribute(pos, spec.attr, value)
        return true
      }).run()
    } else {
      paintStatic() // sin cambios: restauramos la vista actual
    }
    if (moveCaret) caretAfter()
  }
  const cancel = (): void => {
    closePopover()
    paintStatic()
    caretAfter()
  }

  const openPopover = (): void => {
    if (popover) return
    dom.classList.add('matex-editing')
    draft = String(current.attrs[spec.attr] ?? '')
    const rect = staticEl.getBoundingClientRect()
    popover = document.createElement('div')
    popover.className = 'matex-atom-popover'

    const field = document.createElement(spec.multiline ? 'textarea' : 'input') as
      | HTMLInputElement
      | HTMLTextAreaElement
    field.className = 'matex-atom-popover-field'
    field.value = draft
    field.setAttribute('placeholder', spec.placeholder)
    if (!spec.multiline) (field as HTMLInputElement).type = 'text'

    field.addEventListener('input', () => {
      draft = field.value
      paintStatic(draft) // preview EN EL LIENZO, en vivo
    })
    field.addEventListener('keydown', (event) => {
      const key = event as KeyboardEvent
      if (key.key === 'Escape') {
        key.preventDefault()
        cancel()
      } else if (key.key === 'Enter' && (!spec.multiline || key.ctrlKey || key.metaKey)) {
        key.preventDefault()
        commit(true)
      }
    })

    popover.appendChild(field)
    if (spec.palette && !spec.multiline) {
      autoGrowInput(field as HTMLInputElement) // el input (y el popover) crecen con la fórmula
      // La paleta vive en la barra contextual: registramos este input como destino.
      setActiveMathInsert((snippet) => insertIntoInput(field as HTMLInputElement, snippet))
      detachAutocomplete = attachMathAutocomplete(field) // autocompletar \comandos (ME-16)
    }
    document.body.appendChild(popover)
    positionPopover(popover, rect)
    setTimeout(() => {
      field.focus()
      field.select()
    }, 0)
    // Click afuera = confirmar (sin mover el cursor); no cierra si el click cae en la
    // barra contextual (donde está la paleta que inserta acá).
    detachOutside = closeOnOutsideMousedown(popover, dom, () => commit(false), spec.palette ? '.matex-context-bar' : undefined)
  }

  paintStatic()
  dom.addEventListener('mousedown', (event) => {
    event.preventDefault()
    // Seleccionamos el atom (NodeSelection) para que su metadata aparezca en la barra
    // contextual (numerada/etiqueta), además de abrir el popover para editar el contenido.
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null) editor.commands.setNodeSelection(pos)
    openPopover()
  })
  // Puente para editar por teclado (Enter con el atom seleccionado, ver MatexKeymap).
  ;(dom as HTMLElement & { __matexOpenEditor?: () => void }).__matexOpenEditor = openPopover

  return {
    dom,
    update: (updated: typeof node) => {
      if (updated.type.name !== spec.name) return false
      current = updated
      if (!popover) paintStatic()
      return true
    },
    // Definir selectNode hace que PM **no** agregue `.ProseMirror-selectednode`:
    // ponemos el resalte a mano (feedback al navegar con el cursor sobre el atom).
    selectNode: () => {
      dom.classList.add('matex-selected')
      if (!popover && !current.attrs[spec.attr]) openPopover()
    },
    deselectNode: () => {
      dom.classList.remove('matex-selected')
    },
    ignoreMutation: () => true,
    destroy: () => {
      closePopover()
    },
  }
}
