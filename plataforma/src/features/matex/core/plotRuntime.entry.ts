import { plotToSvg, equalAxesExpand, plotValuesAt, plotFeatureLegendHtml, PLOT_VIEW, type PlotView } from './graphics/relationSvg'
import { resolvePlotStyle } from './plotTheme'
import type { PlotSpec } from './ast'

/**
 * **Entry del runtime de gráficos para el HTML interactivo (ME-37).** Se **bundlea** (rolldown, ver
 * `scripts/build-plot-runtime.mjs`) a un IIFE autocontenido que `compileToHtml` embebe en el `.html`
 * del lector. Expone `window.__mxRenderPlot(specJson, overrides, view?)`: sustituye los valores de
 * los parámetros y devuelve el SVG del gráfico — **el mismo `plotToSvg` que usa el editor**. Así el
 * slider computa **en vivo** (continuo, cualquier nº de parámetros), no por fotogramas.
 *
 * Sin `eval` de código del usuario: la expresión la parsea nuestro motor (`parseExpr`), no el JS `eval`.
 */
const withOverrides = (spec: PlotSpec, overrides: Record<string, number>): PlotSpec => ({
  ...spec,
  parameters: (spec.parameters ?? []).map((p) => (overrides[p.name] != null ? { ...p, value: overrides[p.name]! } : p)),
})
function render(spec: PlotSpec, overrides: Record<string, number>, view?: PlotView): string {
  return plotToSvg(withOverrides(spec, overrides), view)
}

type Overrides = Record<string, number>
/** Superficie del runtime en `window`: las funciones de cómputo + el inicializador de widget. */
interface PlotRuntime {
  __mxRenderPlot?: (specJson: string, overrides: Overrides, view?: PlotView) => string
  __mxFeatureLegend?: (specJson: string, overrides: Overrides) => string
  __mxValuesAt?: (specJson: string, overrides: Overrides, x: number) => { index: number; y: number; color: string }[]
  __mxEqualView?: (view: PlotView) => PlotView
  __mxInitPlot?: (uid: string, specJson: string, view: PlotView) => void
}
const g = globalThis as unknown as PlotRuntime
// Leyenda de rasgos recomputada con los valores actuales de los sliders (ME-43).
g.__mxFeatureLegend = (specJson: string, overrides: Record<string, number>): string => {
  try {
    return plotFeatureLegendHtml(withOverrides(JSON.parse(specJson) as PlotSpec, overrides))
  } catch {
    return ''
  }
}
// `y = f(x)` de cada función (con overrides de sliders aplicados) + su color → el tooltip de hover del HTML.
g.__mxValuesAt = (specJson: string, overrides: Record<string, number>, x: number): { index: number; y: number; color: string }[] => {
  try {
    const spec = withOverrides(JSON.parse(specJson) as PlotSpec, overrides)
    return plotValuesAt(spec, x).map((v) => ({
      ...v,
      color: resolvePlotStyle({ color: spec.functions[v.index]?.color, role: spec.functions[v.index]?.role, index: v.index }).color.hex,
    }))
  } catch {
    return []
  }
}
g.__mxRenderPlot = (specJson: string, overrides: Record<string, number>, view?: PlotView): string => {
  try {
    return render(JSON.parse(specJson) as PlotSpec, overrides, view)
  } catch {
    return ''
  }
}
// Iguala la escala de una ventana (px/unidad igual en x e y), como "ejes iguales" del editor.
g.__mxEqualView = (view: PlotView): PlotView => equalAxesExpand(view.xmin, view.xmax, view.ymin, view.ymax)

/**
 * **Inicializa un gráfico interactivo del HTML del lector** (AR-11). Antes vivía como una sopa de
 * strings concatenados dentro de `html.ts`, un handler por widget sin tipos ni lint. Ahora es
 * **código de verdad** acá (bundleado una vez); `compileToHtml` solo emite una llamada
 * parametrizada `window.__mxInitPlot(uid, specJson, view)`. Cablea, sobre el elemento `uid`:
 * sliders de parámetros (+ animación play/pause), zoom por eje (botones y Ctrl/Shift/Alt+rueda
 * centrado en el cursor), arrastre = pan, ejes iguales, reset, y hover con tooltip `(x, f(x))`.
 * Recomputa el SVG con el mismo `__mxRenderPlot` (= `plotToSvg` del editor). Sin `eval`.
 */
g.__mxInitPlot = (uid: string, specJson: string, view: PlotView): void => {
  const w = document.getElementById(uid)
  if (!w || !g.__mxRenderPlot) return
  const box = w.querySelector<HTMLElement>('.mx-plot-canvas')
  if (!box) return
  const rs = Array.from(w.querySelectorAll<HTMLInputElement>('input[type=range]'))
  const v0 = view
  let v: PlotView = { ...v0 }
  const fl = w.querySelector<HTMLElement>('.mx-featleg-wrap')

  /** Valores actuales de los sliders → overrides; de paso refresca la etiqueta `.mx-pval`. */
  const overrides = (): Overrides => {
    const o: Overrides = {}
    for (const rng of rs) {
      const x = +rng.value
      o[rng.getAttribute('data-name') ?? ''] = x
      const label = rng.parentElement?.querySelector<HTMLElement>('.mx-pval')
      if (label) label.textContent = String(Math.round(x * 1e4) / 1e4)
    }
    return o
  }
  /** Recomputa el SVG (y la leyenda de rasgos si la hay) con los valores y la ventana actuales. */
  const redraw = (): void => {
    const o = overrides()
    box.innerHTML = g.__mxRenderPlot!(specJson, o, v)
    if (fl && g.__mxFeatureLegend) fl.innerHTML = g.__mxFeatureLegend(specJson, o)
  }
  /** Escala la ventana alrededor de su centro por (fx, fy). */
  const zoomAround = (fx: number, fy: number): void => {
    const cx = (v.xmin + v.xmax) / 2
    const cy = (v.ymin + v.ymax) / 2
    const hw = ((v.xmax - v.xmin) / 2) * fx
    const hh = ((v.ymax - v.ymin) / 2) * fy
    v = { xmin: cx - hw, xmax: cx + hw, ymin: cy - hh, ymax: cy + hh }
    redraw()
  }

  for (const rng of rs) rng.addEventListener('input', redraw)

  // Animación de parámetro (ME-40d): play/pause por slider; recorre [min, max] ida y vuelta (~4s/barrido).
  Array.from(w.querySelectorAll<HTMLButtonElement>('.mx-panim')).forEach((btn, i) => {
    const rng = rs[i]
    if (!rng) return
    let on = false
    let raf = 0
    let last = 0
    let dir = 1
    const step = (ts: number): void => {
      if (!on) return
      if (!last) {
        last = ts
        raf = requestAnimationFrame(step)
        return
      }
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts
      const mn = +rng.min
      const mx = +rng.max
      const speed = (mx - mn) / 4
      let nv = +rng.value + dir * speed * dt
      if (nv >= mx) {
        nv = mx
        dir = -1
      } else if (nv <= mn) {
        nv = mn
        dir = 1
      }
      rng.value = String(nv)
      redraw()
      raf = requestAnimationFrame(step)
    }
    btn.addEventListener('click', () => {
      on = !on
      btn.textContent = on ? '⏸' : '▶'
      btn.classList.toggle('mx-anim-on', on)
      if (on) {
        last = 0
        raf = requestAnimationFrame(step)
      } else {
        cancelAnimationFrame(raf)
      }
    })
  })

  // Botones de zoom por eje (data-fx/data-fy en la botonera).
  for (const btn of Array.from(w.querySelectorAll<HTMLButtonElement>('.mx-plot-tools button[data-fx]'))) {
    btn.addEventListener('click', () => zoomAround(+(btn.getAttribute('data-fx') ?? '1'), +(btn.getAttribute('data-fy') ?? '1')))
  }

  // Zoom con rueda alrededor del cursor: Ctrl/⌘ = ambos ejes · Shift = horizontal · Alt = vertical.
  box.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const both = e.ctrlKey || e.metaKey
      if (!(both || e.shiftKey || e.altKey)) return
      e.preventDefault()
      const rc = box.getBoundingClientRect()
      const f = e.deltaY > 0 ? 1.12 : 1 / 1.12
      const mx = v.xmin + ((e.clientX - rc.left) / rc.width) * (v.xmax - v.xmin)
      const my = v.ymax - ((e.clientY - rc.top) / rc.height) * (v.ymax - v.ymin)
      const fx = both || e.shiftKey ? f : 1
      const fy = both || e.altKey ? f : 1
      v = { xmin: mx - (mx - v.xmin) * fx, xmax: mx + (v.xmax - mx) * fx, ymin: my - (my - v.ymin) * fy, ymax: my + (v.ymax - my) * fy }
      redraw()
    },
    { passive: false },
  )

  // Arrastrar = desplazar (pan).
  let dragging = false
  let px = 0
  let py = 0
  box.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true
    px = e.clientX
    py = e.clientY
    box.setPointerCapture(e.pointerId)
    box.style.cursor = 'grabbing'
  })
  box.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return
    const rc = box.getBoundingClientRect()
    const dx = ((e.clientX - px) / rc.width) * (v.xmax - v.xmin)
    const dy = ((e.clientY - py) / rc.height) * (v.ymax - v.ymin)
    v = { xmin: v.xmin - dx, xmax: v.xmax - dx, ymin: v.ymin + dy, ymax: v.ymax + dy }
    px = e.clientX
    py = e.clientY
    redraw()
  })
  const endDrag = (): void => {
    dragging = false
    box.style.cursor = ''
  }
  box.addEventListener('pointerup', endDrag)
  box.addEventListener('pointercancel', endDrag)

  const equalBtn = w.querySelector<HTMLElement>('.mx-plot-equal')
  if (equalBtn)
    equalBtn.addEventListener('click', () => {
      if (g.__mxEqualView) {
        v = g.__mxEqualView(v)
        redraw()
      }
    })
  const resetBtn = w.querySelector<HTMLElement>('.mx-plot-reset')
  if (resetBtn)
    resetBtn.addEventListener('click', () => {
      v = { ...v0 }
      redraw()
    })

  // Hover (ME-43): punto + tooltip con (x, f(x)) sobre la curva más cercana al cursor.
  const dot = w.querySelector<HTMLElement>('.mx-hover-dot')
  const tip = w.querySelector<HTMLElement>('.mx-hover-tip')
  const hideHover = (): void => {
    if (dot) dot.style.display = 'none'
    if (tip) tip.style.display = 'none'
  }
  const fmt = (n: number): string => String(Math.round(n * 100) / 100).replace('-', '−')
  const { w: VW, h: VH, pad: VPAD } = PLOT_VIEW
  box.addEventListener('mousemove', (e: MouseEvent) => {
    if (dragging || !g.__mxValuesAt || !dot || !tip) return hideHover()
    const rc = box.getBoundingClientRect()
    const dx = v.xmin + ((((e.clientX - rc.left) / rc.width) * VW - VPAD) / (VW - 2 * VPAD)) * (v.xmax - v.xmin)
    const vals = g.__mxValuesAt(specJson, overrides(), dx)
    if (!vals.length) return hideHover()
    const vy = ((e.clientY - rc.top) / rc.height) * VH
    const sy = (y: number): number => VH - VPAD - ((y - v.ymin) / (v.ymax - v.ymin)) * (VH - 2 * VPAD)
    let best = vals[0]!
    for (let i = 1; i < vals.length; i++) if (Math.abs(sy(vals[i]!.y) - vy) < Math.abs(sy(best.y) - vy)) best = vals[i]!
    const lx = box.offsetLeft + ((VPAD + ((dx - v.xmin) / (v.xmax - v.xmin)) * (VW - 2 * VPAD)) / VW) * rc.width
    const ly = box.offsetTop + (sy(best.y) / VH) * rc.height
    dot.style.display = 'block'
    dot.style.left = `${lx}px`
    dot.style.top = `${ly}px`
    dot.style.background = best.color
    tip.style.display = 'block'
    tip.style.left = `${lx + 8}px`
    tip.style.top = `${ly - 8}px`
    tip.style.borderColor = best.color
    tip.textContent = `(${fmt(dx)}, ${fmt(best.y)})`
  })
  box.addEventListener('mouseleave', hideHover)
}
