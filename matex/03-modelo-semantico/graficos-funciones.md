# Diseño — figuras compuestas y gráficos de funciones

> **Estado:** decisiones tomadas (2026-07-04). Refactoriza `figure` a un **contenedor de
> partes** (imagen | gráfico) y agrega **gráficos de funciones** (pgfplots) con preview JS.

## Postura sobre layouts de figura (análisis)

Regla matex: se modela el **qué** (intención); el **dónde/cómo fluye** lo decide LaTeX.

| Opción LaTeX | ¿Semántico? | Postura |
|---|---|---|
| `[htbp]`/`[H]` placement | No (tipografía) | No modelar; default `[htbp]` |
| caption/label/ref | Sí | ✅ ya está |
| width (frac. `\textwidth`) | Sí | ✅ ya está |
| **subfigure/subcaption** | **Sí (composición)** | **Modelar** → figura = lista de partes |
| minipage lado a lado | Parcial | subfigure sin subcaption |
| wrapfig (texto alrededor) | Tipografía frágil | rawLatex |
| `figure*` (2 col) | Solo 2-col | No aplica (Matex 1-col) |
| sideways/rotate/trim/clip | Detalle raro | rawLatex |

**Conclusión:** el único layout que es intención (no tipografía) es **subfiguras**. Todo lo
demás: default + `rawLatex`. Y una figura-compuesta aloja naturalmente imágenes **y** gráficos
como "partes" (incluida la subfigura imagen+gráfico).

## Modelo — figura = lista de partes

```ts
interface FigureNode {
  type: 'figure'
  caption?: string
  id?: string
  label?: string
  items: FigureItem[]            // 1..n (n≥2 = subfiguras)
}
type FigureItem = FigureImage | FigurePlot
interface FigureImage { kind: 'image'; src: string; width?: number; subcaption?: string; id?: string; label?: string }
interface FigurePlot  { kind: 'plot'; spec: PlotSpec; width?: number; subcaption?: string; id?: string; label?: string }

interface PlotSpec {
  functions: { expr: string; legend?: string }[]   // expr = sintaxis normalizada (ver abajo)
  domain: [number, number]                          // [xmin, xmax]
  range?: [number, number]                          // [ymin, ymax] (auto si falta)
  xlabel?: string; ylabel?: string
  grid?: boolean; legend?: boolean
}
```

**Migración:** `figure { src, caption, width, id, label }` → `figure { caption, id, label,
items: [{ kind:'image', src, width }] }`.

**Compilación:**
- 1 item imagen → `figure` + `\includegraphics` (como hoy).
- 1 item plot → `figure` + `\begin{axis}…\end{axis}` (pgfplots).
- ≥2 items → **subfiguras** (`subcaption`): cada item en `\begin{subfigure}` con su subcaption/label.
  (Fase 2; el modelo ya lo soporta.)

## Motor de expresiones (la pieza central)

El problema (como `\R` en KaTeX vs LaTeX): la misma función debe **evaluarse en JS** (preview =
el "otro backend", web) y **emitirse a pgfplots** (PDF), sin divergir. Solución: una **sintaxis
normalizada** con un **parser → AST** puro (`core/plotExpr.ts`), del que salen varios emisores.

- **Sintaxis** (subset, variable `x`): `+ - * / ^`, unario `-`, paréntesis; números decimales;
  constantes `pi`, `e`; funciones `sin cos tan asin acos atan exp ln log sqrt abs` (+ `sinh…`).
- **AST** `ExprNode` = num | var | const | neg | bin(op,a,b) | call(fn,a).
- **Emisores:** `evalExpr(node,x)` (preview, radianes = JS nativo), `exprToPgfplots(node)`
  (radianes vía opción de eje `trig format=rad` → emisión casi 1:1), y a futuro `exprToLatex`
  (mostrar "y = x²" y round-trip con entrada LaTeX).
- **Radianes en todo**: JS `Math.sin` es radianes; en pgfplots se fija `trig format=rad` en el
  `axis` → `sin(x)` significa lo mismo en ambos. Nada de `deg()`.

**Puertas abiertas (no v1):** construir la expresión no solo tipeando ASCII sino
**simbólicamente** (botones/paleta, reusando el patrón del asistente de fórmulas) o desde
**LaTeX** (`parseLatexExpr → ExprNode`). El AST central habilita todas.

## Preview (editor)

`evalExpr` muestrea el dominio y se dibuja una **curva SVG** (sin dependencias pesadas). Es
literalmente el backend web de la misma spec que compila a pgfplots → "lo que se ve = lo que
compila".

## Plan por fases

- **F1 — motor de expresiones** (`plotExpr.ts`: parse/eval/pgfplots) + tests. **✅ hecho.**
- **F2 — modelo figura=items** (ast/parse+migración/compile 1-item imagen|plot/mapping/numbering/bundle) + tests + PDF. **✅ hecho.**
- **F3 — editor del plot**: insertar gráfico, editar spec (funciones/dominio/opciones), **preview SVG en vivo**. **✅ hecho** (+ color/trazo/dominio por función, áreas bajo/entre curvas, puntos ●/○, verticales/horizontales, posición de leyenda, `unbounded coords=jump`, **funciones partidas** con `\begin{cases}` y continuidad).
- **F4 — subfiguras** (≥2 items: subcaption compile + editor de partes + subcaption/ref por parte). **✅ hecho** (compile `subfigure`+`\subcaption`+refs, node view (a)(b), gestor de partes con parte activa).
- **F5 — entrada simbólica/LaTeX** de la expresión (paleta de plot, `parseLatexExpr`). **✅ hecho** (toggle ASCII/LaTeX + botonera + parser unificado + `sec/csc/cot`).

**Post-plan:**
- **Tier 2c — didáctico:** tangente en un punto (derivada) + ticks en π. **✅ hecho.**
- **Tier 3 — tipos nuevos:**
  - datos/scatter (`data`: series de puntos, marcas + línea opcional). **✅ hecho.**
  - paramétricas `(x(t),y(t))` (`parametrics`; motor con variable configurable `parseExpr(...,'t')` + `\addplot[parametric, variable=t]`). **✅ hecho.**
  - polares `r(θ)` (`polars`) → **✅ hecho** vía **reescritura a paramétrica** `(r·cos t, r·sin t)` sobre el eje cartesiano (evita el fork `polaraxis`; se pierde solo la grilla polar decorativa). El ángulo es la variable `t`.
- **Consolidación UI:** panel del gráfico en **pestañas** (Funciones/Datos/Paramétricas/Polares/Ejes/Anotaciones) + `ColorStyleControls` compartido (color+trazo homogéneo en todas las series). **✅ hecho.**
- **Sueltos:** muestreo (`samples`), título del gráfico (`title`), texto libre anotado (`texts`). **✅ hecho.** Escala log **descartada** por ahora (es un fork de eje `loglogaxis`/`semilogyaxis`, de bajo uso en cálculo intro).
