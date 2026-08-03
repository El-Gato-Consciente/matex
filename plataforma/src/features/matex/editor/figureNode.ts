import { Node, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core'
import { numberingKey } from './numbering'
import { chartToSvg, diagramToSvg, distToSvg, equalAxesExpand, PLOT_VIEW, plotDisplayWindow, plotFeatureLegendHtml, plotLegendHtml, plotToSvg, plotValuesAt, resolvePlotStyle, treeToSvg, type FigureItem, type PlotSpec, type PlotView } from '../core'

/**
 * **Nodo `figure` de TipTap** (QA-10, slice 3): imagen del proyecto o gráfico generado (chart,
 * distribución, diagrama, árbol o plot), con epígrafe referenciable y subfiguras. El plot trae su
 * **preview interactivo** en el lienzo (zoom/pan/hover, gemelo en el editor del `__mxInitPlot` del
 * HTML — misma geometría `PLOT_VIEW`). Se movió desde `nodes.ts` (era ~360 líneas, el nodo más
 * grande) para dejar ese archivo navegable; `nodes.ts` lo re-exporta para no tocar a los consumidores.
 */

export interface FigureOptions {
  /** Resuelve el nombre de archivo del proyecto a una URL mostrable (data URL), o null. */
  resolveSrc: (src: string) => string | null
}

/** Node view de la figura: sus **partes** (imagen resuelta desde los assets | gráfico SVG)
 *  + epígrafe con su número en vivo. Todo se edita en la barra contextual; acá solo se
 *  muestra y se selecciona (para que la barra aparezca). */
function figureView({ node, editor, getPos }: NodeViewRendererProps, options: FigureOptions) {
  let current = node
  let selected = false // el zoom/pan y sus botones **solo** con la figura seleccionada (panel abierto)
  const dom = document.createElement('figure')
  dom.className = 'matex-figure'
  const itemsWrap = document.createElement('div')
  itemsWrap.className = 'matex-figure-items'
  const cap = document.createElement('figcaption')
  cap.className = 'matex-figure-caption'
  dom.append(itemsWrap, cap)

  const figNum = (): string | undefined => {
    const pos = typeof getPos === 'function' ? getPos() : null
    return pos == null ? undefined : numberingKey.getState(editor.state)?.figure.get(pos)
  }
  const itemsOf = (): FigureItem[] => (Array.isArray(current.attrs.items) ? (current.attrs.items as FigureItem[]) : [])

  // ── Zoom/pan del preview (por parte 'plot'). La **vista** es transitoria (no toca el AST): solo
  // cambia lo que muestra el SVG. "Fijar vista" la escribe en domain/range para que el PDF coincida.
  // Geometría del viewBox (para invertir píxel→dato): fuente única con `relationSvg.ts` (AR-11).
  const { w: PLOT_W, h: PLOT_H, pad: PLOT_PAD } = PLOT_VIEW
  const plotViews = new Map<number, PlotView>()
  // La vista arranca desde la **ventana realmente mostrada** (con rango auto / ejes iguales ya
  // aplicados) → el primer zoom/pan no "salta".
  const baseView = (spec: PlotSpec): PlotView => plotDisplayWindow(spec)
  /** Escribe la vista actual en `domain`/`range` de la parte (una transacción → compila con esa ventana). */
  const commitView = (index: number): void => {
    const view = plotViews.get(index)
    const pos = typeof getPos === 'function' ? getPos() : null
    if (!view || pos == null) return
    const r = (n: number): number => Number(n.toFixed(4))
    const items = itemsOf().map((it, i) =>
      i === index && it.kind === 'plot'
        ? {
            ...it,
            // Fijar = ventana explícita: se apagan ejes iguales (si no, se re-expandiría y no
            // coincidiría con lo fijado). El rango pasa a ser explícito (fin del rango auto).
            spec: { ...it.spec, domain: [r(view.xmin), r(view.xmax)] as [number, number], range: [r(view.ymin), r(view.ymax)] as [number, number], equalAxes: false },
          }
        : it,
    )
    // Se borra la vista **antes** del dispatch: la transacción dispara `update()`→`paint()` de
    // forma síncrona, y así los botones (Fijar/Reset) reflejan el estado nuevo (desaparecen).
    plotViews.delete(index)
    editor.chain().command(({ tr }) => {
      tr.setNodeAttribute(pos, 'items', items)
      return true
    }).run()
  }
  /** Zoom **por eje** alrededor del centro de la vista (para los botones). `factor`<1 acerca, >1 aleja. */
  const zoomAxis = (index: number, spec: PlotSpec, axis: 'x' | 'y' | 'both', factor: number): void => {
    const v = plotViews.get(index) ?? baseView(spec)
    const cx = (v.xmin + v.xmax) / 2
    const cy = (v.ymin + v.ymax) / 2
    const nv = { ...v }
    if (axis !== 'y') {
      nv.xmin = cx - (cx - v.xmin) * factor
      nv.xmax = cx + (v.xmax - cx) * factor
    }
    if (axis !== 'x') {
      nv.ymin = cy - (cy - v.ymin) * factor
      nv.ymax = cy + (v.ymax - cy) * factor
    }
    plotViews.set(index, nv)
    paint()
  }
  /** Iguala la escala de los ejes (1 unidad x = 1 unidad y) sobre la vista actual (botón 1:1). */
  const equalizeView = (index: number, spec: PlotSpec): void => {
    const v = plotViews.get(index) ?? baseView(spec)
    plotViews.set(index, equalAxesExpand(v.xmin, v.xmax, v.ymin, v.ymax))
    paint()
  }
  // Botonera flotante del preview: **fila fija** de íconos (mismo lenguaje visual que el HTML web).
  // Todos los botones ocupan un slot **estable** → agregar/quitar estado no reordena la fila:
  // ⟲ (restablecer) y 📌 (fijar la vista en el gráfico → default del PDF/LaTeX) están **siempre
  // presentes**, solo se **deshabilitan** cuando no hay una vista transitoria (zoom/pan) que aplicar.
  const makePlotTools = (index: number, spec: PlotSpec): HTMLElement => {
    const tools = document.createElement('div')
    tools.className = 'matex-plot-tools'
    const mk = (text: string, title: string, onClick: () => void, opts?: { cls?: string; disabled?: boolean }): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = text
      b.title = title
      if (opts?.cls) b.className = opts.cls
      if (opts?.disabled) b.disabled = true
      b.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!b.disabled) onClick()
      })
      return b
    }
    const hasView = plotViews.has(index)
    tools.append(
      mk('⊕', 'Acercar (ambos ejes) · rueda ↑', () => zoomAxis(index, spec, 'both', 0.8)),
      mk('⊖', 'Alejar (ambos ejes) · rueda ↓', () => zoomAxis(index, spec, 'both', 1.25)),
      mk('↔﹢', 'Acercar horizontal (eje x) · Shift+rueda', () => zoomAxis(index, spec, 'x', 0.8)),
      mk('↔﹣', 'Alejar horizontal (eje x) · Shift+rueda', () => zoomAxis(index, spec, 'x', 1.25)),
      mk('↕﹢', 'Acercar vertical (eje y) · Alt+rueda', () => zoomAxis(index, spec, 'y', 0.8)),
      mk('↕﹣', 'Alejar vertical (eje y) · Alt+rueda', () => zoomAxis(index, spec, 'y', 1.25)),
      mk('1:1', 'Igualar la escala de los ejes (1 unidad en x = 1 en y)', () => equalizeView(index, spec)),
      mk('⟲', 'Restablecer vista', () => {
        plotViews.delete(index)
        paint()
      }, { disabled: !hasView }),
      mk('📌', 'Fijar esta vista en el gráfico (así el PDF/LaTeX usa esta ventana)', () => commitView(index), { cls: 'matex-plot-pin', disabled: !hasView }),
    )
    return tools
  }
  /** Rueda = zoom (alrededor del cursor); arrastre = pan. Repinta (solo DOM, sin transacción). */
  const attachPlotInteractivity = (box: HTMLElement, spec: PlotSpec, index: number): void => {
    const svgEl = box.querySelector('svg')
    if (!svgEl) return
    box.style.cursor = 'grab'
    let dragging = false // durante el pan se oculta el hover
    box.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const view = plotViews.get(index) ?? baseView(spec)
        const rect = svgEl.getBoundingClientRect()
        const vx = ((e.clientX - rect.left) / rect.width) * PLOT_W
        const vy = ((e.clientY - rect.top) / rect.height) * PLOT_H
        const dataX = view.xmin + ((vx - PLOT_PAD) / (PLOT_W - 2 * PLOT_PAD)) * (view.xmax - view.xmin)
        const dataY = view.ymin + ((PLOT_H - PLOT_PAD - vy) / (PLOT_H - 2 * PLOT_PAD)) * (view.ymax - view.ymin)
        const f = e.deltaY < 0 ? 0.85 : 1 / 0.85 // arriba = acercar, abajo = alejar
        // Modificadores: Shift = solo X, Alt = solo Y (si no, ambos).
        const fx = e.altKey ? 1 : f
        const fy = e.shiftKey ? 1 : f
        plotViews.set(index, {
          xmin: dataX - (dataX - view.xmin) * fx,
          xmax: dataX + (view.xmax - dataX) * fx,
          ymin: dataY - (dataY - view.ymin) * fy,
          ymax: dataY + (view.ymax - dataY) * fy,
        })
        paint()
      },
      { passive: false },
    )
    box.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.matex-plot-tools')) return // clic en los botones
      const rect = svgEl.getBoundingClientRect()
      const start = plotViews.get(index) ?? baseView(spec)
      const sx0 = e.clientX
      const sy0 = e.clientY
      const onMove = (m: MouseEvent): void => {
        if (Math.abs(m.clientX - sx0) < 3 && Math.abs(m.clientY - sy0) < 3) return // clic ≠ pan
        dragging = true
        const dvx = ((m.clientX - sx0) / rect.width) * PLOT_W
        const dvy = ((m.clientY - sy0) / rect.height) * PLOT_H
        const ddx = (dvx / (PLOT_W - 2 * PLOT_PAD)) * (start.xmax - start.xmin)
        const ddy = (dvy / (PLOT_H - 2 * PLOT_PAD)) * (start.ymax - start.ymin)
        plotViews.set(index, { xmin: start.xmin - ddx, xmax: start.xmax - ddx, ymin: start.ymin + ddy, ymax: start.ymax + ddy })
        paint()
      }
      const onUp = (): void => {
        dragging = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })

    // Hover (ME-43): punto + tooltip con (x, f(x)) sobre la curva más cercana al cursor.
    const dot = document.createElement('div')
    dot.className = 'matex-hover-dot'
    const tip = document.createElement('div')
    tip.className = 'matex-hover-tip'
    dot.style.display = 'none'
    tip.style.display = 'none'
    box.append(dot, tip)
    const hideHover = (): void => {
      dot.style.display = 'none'
      tip.style.display = 'none'
    }
    const fmtHover = (n: number): string => String(Number(n.toFixed(2))).replace('-', '−')
    box.addEventListener('mousemove', (e) => {
      if (dragging || (e.target as HTMLElement).closest('.matex-plot-tools')) return hideHover()
      const rect = svgEl.getBoundingClientRect()
      const view = plotViews.get(index) ?? baseView(spec)
      const px = ((e.clientX - rect.left) / rect.width) * PLOT_W
      const dataX = view.xmin + ((px - PLOT_PAD) / (PLOT_W - 2 * PLOT_PAD)) * (view.xmax - view.xmin)
      const vals = plotValuesAt(spec, dataX)
      if (vals.length === 0) return hideHover()
      const py = ((e.clientY - rect.top) / rect.height) * PLOT_H
      const syOf = (y: number): number => PLOT_H - PLOT_PAD - ((y - view.ymin) / (view.ymax - view.ymin)) * (PLOT_H - 2 * PLOT_PAD)
      let best = vals[0]!
      for (const v of vals) if (Math.abs(syOf(v.y) - py) < Math.abs(syOf(best.y) - py)) best = v
      const vbx = PLOT_PAD + ((dataX - view.xmin) / (view.xmax - view.xmin)) * (PLOT_W - 2 * PLOT_PAD)
      const boxRect = box.getBoundingClientRect() // offset del SVG dentro del contenedor posicionado
      const left = rect.left - boxRect.left + vbx * (rect.width / PLOT_W)
      const top = rect.top - boxRect.top + syOf(best.y) * (rect.height / PLOT_H)
      const color = resolvePlotStyle({ color: spec.functions[best.index]?.color, role: spec.functions[best.index]?.role, index: best.index }).color.hex
      dot.style.display = 'block'
      dot.style.left = `${left}px`
      dot.style.top = `${top}px`
      dot.style.background = color
      tip.textContent = `(${fmtHover(dataX)}, ${fmtHover(best.y)})`
      tip.style.display = 'block'
      tip.style.left = `${left + 8}px`
      tip.style.top = `${top - 8}px`
      tip.style.borderColor = color
    })
    box.addEventListener('mouseleave', hideHover)
  }

  const paintItem = (item: FigureItem, index: number, total: number): HTMLElement => {
    const box = document.createElement('div')
    box.className = 'matex-figure-item'
    // Con varias partes (subfiguras) el ancho lo reparte el flex; con una, el `width` propio.
    box.style.width = total >= 2 ? '' : typeof item.width === 'number' && item.width > 0 ? `${Math.round(item.width * 100)}%` : '100%'
    if (item.kind === 'image') {
      const url = item.src ? options.resolveSrc(item.src) : null
      if (url) {
        const img = document.createElement('img')
        img.src = url
        img.alt = item.src
        box.appendChild(img)
      } else {
        const ph = document.createElement('div')
        ph.className = 'matex-figure-placeholder'
        ph.textContent = item.src ? `No se encontró la imagen «${item.src}»` : 'Sin imagen'
        box.appendChild(ph)
      }
    } else {
      try {
        // Backend web puro (core): devuelve markup SVG; el `<svg>` raíz hace que el parser HTML
        // cree los nodos en el namespace SVG correcto. Las partes 'plot' aceptan una **vista**
        // (zoom/pan) transitoria que reemplaza domain/range sin tocar el AST.
        box.insertAdjacentHTML(
          'beforeend',
          item.kind === 'chart'
            ? chartToSvg(item.spec)
            : item.kind === 'distribution'
              ? distToSvg(item.spec)
              : item.kind === 'diagram'
                ? diagramToSvg(item.spec)
                : item.kind === 'tree'
                  ? treeToSvg(item.spec)
                  : plotToSvg(item.spec, plotViews.get(index)),
        )
      } catch {
        const ph = document.createElement('div')
        ph.className = 'matex-figure-placeholder'
        ph.textContent = 'Gráfico inválido'
        box.appendChild(ph)
      }
      // Leyenda como overlay HTML/MathML (misma que el HTML); repinta con el spec → refleja los
      // valores actuales de los parámetros al moverlos en el inspector.
      if (item.kind === 'plot') {
        box.insertAdjacentHTML('beforeend', plotLegendHtml(item.spec))
        if (item.spec.featureLegend) box.insertAdjacentHTML('beforeend', plotFeatureLegendHtml(item.spec))
      }
      // Zoom/pan + botones **solo** con la figura seleccionada (si no, la rueda scrollea el lienzo).
      if (item.kind === 'plot' && selected) {
        attachPlotInteractivity(box, item.spec, index)
        box.appendChild(makePlotTools(index, item.spec))
      }
    }
    // Subepígrafe (a)(b)… solo cuando hay ≥2 partes (subfiguras).
    if (total >= 2) {
      const sc = document.createElement('figcaption')
      sc.className = 'matex-subfigure-caption'
      const letter = String.fromCharCode(97 + index)
      sc.textContent = item.subcaption ? `(${letter}) ${item.subcaption}` : `(${letter})`
      box.appendChild(sc)
    }
    return box
  }

  const paint = (): void => {
    const items = itemsOf()
    itemsWrap.classList.toggle('is-multi', items.length >= 2)
    itemsWrap.replaceChildren(...items.map((it, i) => paintItem(it, i, items.length)))
    const caption = String(current.attrs.caption ?? '')
    const n = figNum()
    if (caption) {
      cap.style.display = ''
      cap.textContent = `Figura${n ? ` ${n}` : ''}: ${caption}`
    } else {
      cap.style.display = 'none'
      cap.textContent = ''
    }
  }
  paint()

  dom.addEventListener('mousedown', (event) => {
    event.preventDefault()
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos != null) editor.commands.setNodeSelection(pos)
  })

  // Reactivo: el número depende de otras figuras; re-pinta si cambió lo que se muestra.
  let lastKey = ''
  const onDocUpdate = (): void => {
    const key = `${figNum() ?? ''}|${String(current.attrs.caption)}|${JSON.stringify(current.attrs.items)}`
    if (key !== lastKey) {
      lastKey = key
      paint()
    }
  }
  editor.on('update', onDocUpdate)

  return {
    dom,
    update: (updated: typeof node) => {
      if (updated.type.name !== 'figure') return false
      current = updated
      paint()
      return true
    },
    selectNode: () => {
      selected = true
      dom.classList.add('matex-selected')
      paint() // re-pinta para habilitar zoom/pan + mostrar los botones
    },
    deselectNode: () => {
      selected = false
      dom.classList.remove('matex-selected')
      paint() // gráfico estático → la rueda vuelve a scrollear el lienzo
    },
    ignoreMutation: () => true,
    destroy: () => editor.off('update', onDocUpdate),
  }
}

export const Figure = Node.create<FigureOptions>({
  name: 'figure',
  group: 'block',
  atom: true,
  selectable: true,
  addOptions() {
    return { resolveSrc: () => null }
  },
  addAttributes: () => ({
    items: { default: [{ kind: 'image', src: '' }] },
    caption: { default: null },
    id: { default: null },
    label: { default: null },
  }),
  parseHTML: () => [{ tag: 'figure[data-figure]' }],
  renderHTML: ({ HTMLAttributes }) => ['figure', mergeAttributes(HTMLAttributes, { 'data-figure': '' })],
  addNodeView() {
    const options = this.options
    return (props) => figureView(props, options)
  },
})
