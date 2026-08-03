import { EditorView, showTooltip, type Tooltip } from '@codemirror/view'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * Preview de fórmulas: muestra la matemática LaTeX **renderizada** (KaTeX) en un
 * **único** tooltip, alimentado por una sola fuente de verdad — la fórmula bajo el
 * **mouse** (hover) o, si no hay hover, la del **cursor** (mientras editás, se
 * refresca al cambiar el contenido). Un solo mecanismo (`showTooltip`) => una sola
 * posición y nunca dos popovers. Cubre `$…$`, `\[…\]` y los entornos de ecuación
 * más comunes; `throwOnError:false` degrada con elegancia.
 */

const KATEX_MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\sen': '\\operatorname{sen}',
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\|#1\\right\\|',
}

interface MathHit {
  from: number
  to: number
  tex: string
  display: boolean
}

function scan(
  doc: string,
  pos: number,
  re: RegExp,
  toHit: (m: RegExpExecArray, from: number, to: number) => MathHit,
): MathHit | null {
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(doc))) {
    const from = m.index
    const to = m.index + m[0].length
    if (pos >= from && pos <= to) return toHit(m, from, to)
  }
  return null
}

/** Fórmula que cubre la posición `pos`, si la hay (entorno → display → inline). */
function mathAt(doc: string, pos: number): MathHit | null {
  return (
    scan(
      doc,
      pos,
      /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g,
      (m, from, to) => ({ from, to, display: true, tex: m[1]!.startsWith('equation') ? m[2]! : m[0] }),
    ) ??
    scan(doc, pos, /\\\[([\s\S]*?)\\\]/g, (m, from, to) => ({ from, to, display: true, tex: m[1]! })) ??
    scan(doc, pos, /\$([^$\n]+)\$/g, (m, from, to) => ({ from, to, display: false, tex: m[1]! }))
  )
}

/** ¿Es la misma fórmula (rango + contenido)? Para reusar el tooltip sin recrearlo. */
function sameHit(a: MathHit | null, b: MathHit | null): boolean {
  return a === b || (!!a && !!b && a.from === b.from && a.to === b.to && a.tex === b.tex)
}

/** Tooltip con la fórmula renderizada (KaTeX), anclado en el rango de la fórmula. */
function mathTooltip(hit: MathHit): Tooltip {
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-math-preview'
      try {
        katex.render(hit.tex.trim(), dom, {
          throwOnError: false,
          displayMode: hit.display,
          macros: KATEX_MACROS,
        })
      } catch {
        dom.textContent = hit.tex
      }
      return {
        dom,
        // Separación de la línea: margin en el .cm-tooltip real (inline; el CSS del
        // tema vía style-mod no toma :has). Pedimos `above`, así que por defecto
        // subimos (margin-top negativo); solo bajamos si CM lo marcó `below`.
        positioned() {
          const tip = dom.closest('.cm-tooltip') as HTMLElement | null
          if (tip) tip.style.marginTop = tip.classList.contains('cm-tooltip-below') ? '10px' : '-10px'
        },
      }
    },
  }
}

/** Fija (o limpia) la posición bajo el mouse. `null` = no hay hover. */
const setHoverPos = StateEffect.define<number | null>()

interface PreviewState {
  /** Posición del mouse dentro de una fórmula (se re-resuelve contra el doc). */
  hoverPos: number | null
  hit: MathHit | null
  tooltip: Tooltip | null
}

const EMPTY: PreviewState = { hoverPos: null, hit: null, tooltip: null }

/** Elige qué previsualizar: el hover tiene prioridad; si no, el cursor. */
function computePreview(state: EditorState, hoverPos: number | null, prev: PreviewState): PreviewState {
  const doc = state.doc.toString()
  let hit = hoverPos != null ? mathAt(doc, hoverPos) : null
  if (!hit) {
    const sel = state.selection.main
    if (sel.empty) hit = mathAt(doc, sel.head)
  }
  // Reusar el tooltip si es la misma fórmula: evita recrearlo en cada tecla y solo
  // se re-renderiza cuando cambia su contenido (así "se refresca al editar").
  if (sameHit(hit, prev.hit)) return { hoverPos, hit, tooltip: prev.tooltip }
  return { hoverPos, hit, tooltip: hit ? mathTooltip(hit) : null }
}

const previewField = StateField.define<PreviewState>({
  create: (state) => computePreview(state, null, EMPTY),
  update(value, tr) {
    let hoverPos = value.hoverPos
    let hovered = false
    for (const e of tr.effects) {
      if (e.is(setHoverPos)) {
        hoverPos = e.value
        hovered = true
      }
    }
    if (hoverPos != null && tr.docChanged) hoverPos = tr.changes.mapPos(hoverPos)
    if (!tr.docChanged && !tr.selection && !hovered) return value
    return computePreview(tr.state, hoverPos, value)
  },
  provide: (f) => showTooltip.from(f, (v) => v.tooltip),
})

/** Rastrea la fórmula bajo el mouse y la despacha solo cuando cambia de fórmula. */
const hoverTracker = EditorView.domEventHandlers({
  mousemove(event, view) {
    const doc = view.state.doc.toString()
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    const nextHit = pos == null ? null : mathAt(doc, pos)
    const { hoverPos } = view.state.field(previewField)
    const currentHit = hoverPos == null ? null : mathAt(doc, hoverPos)
    if (!sameHit(nextHit, currentHit)) view.dispatch({ effects: setHoverPos.of(nextHit ? pos : null) })
  },
  mouseleave(_event, view) {
    if (view.state.field(previewField).hoverPos != null) view.dispatch({ effects: setHoverPos.of(null) })
  },
})

/** Extensión: preview de fórmulas (hover + cursor) en un único tooltip. */
export const mathPreview = [previewField, hoverTracker]
