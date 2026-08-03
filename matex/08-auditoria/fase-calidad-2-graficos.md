# Fase de calidad 2 — el módulo de gráficos (y el resto del inventario)

> Continuación tras cerrar la [impecabilidad](impecabilidad-2026-07-22.md). La deuda
> **estructural** está saldada; esto ataca el **hueso más duro que queda** (el módulo de
> gráficos: `PlotEditor.tsx` + `PlotSpec`) y **registra todo lo demás** para que nada se
> pierda. Derivado de un barrido con evidencia, no de memoria.

## Inventario completo de lo que queda (para no olvidar nada)

Todo lo pendiente de calidad, ordenado por valor. Los dos primeros son **este** documento;
el resto queda anotado acá y en el backlog para retomar.

| # | Ítem | Qué es | Esf. | Prioridad |
|---|------|--------|:----:|-----------|
| **1** | **QA-09** · partir `PlotEditor.tsx` | God-component de 1.686 líneas, 0 tests. Misma cura que QA-06 (refactor→test) | L | **este doc** |
| **2** | **F-1** · clasificar `PlotSpec` | ~30 campos: ¿intención semántica · receta · presentación · estado de editor? Las 4 reglas | L (juicio) | **este doc** |
| 3 | **AR-11** · JS como sopa de strings en `html.ts` | ✅ **HECHO** — controlador → `__mxInitPlot` tipado en el runtime bundleado; `PLOT_VIEW` fuente única del viewBox | M | ✅ |
| 4 | **QA-10** · partir `nodes.ts` | ✅ **HECHO** — `equationDisplay.ts` (puro, 7 tests) + `nodeViewHelpers.ts` (infra) + `figureNode.ts`; 2.151→1.536 (−29%). Cierra C-1 (los 3 God-files partidos) | L | ✅ |
| 5 | **F-3** · representación de la matemática | `tex` crudo vs. estructurado; **decisión de producto**, precondición de LE-06 | — | pre-LE-06 |
| 6 | **O-2** · bundle de 2.5 MB en un chunk | Code-splitting por `import()` dinámico | S | pulido |
| 7 | **O-3** · accesibilidad (AR-02) | Widgets propios no operables por teclado | M | pulido |
| 8 | **C-2** · `verify:content` no corre en PRs | Es lento (~150 PDFs); job nocturno o gate opcional | XS | pulido |
| 9 | **C-3** · `showcase`/`templates` cobertura 0.02 | Solo anti-bitrot; subir a comportamiento | S | pulido |

---

## Ítem 1 — QA-09: partir `PlotEditor.tsx`

### Diagnóstico (medido)
1.686 líneas, 0 tests directos. Ya está partido en **componentes** dentro del archivo
(`PlotEditor` → `CurvesTab`/`AxesTab`/`AnnotationsTab`; 6 `*Row`), pero **la lógica pura vive
enredada en el JSX**: los constructores de patch (`removalPatch`, `addPatch`, `changeType`),
el parseo de referencias (`curveRefKey`/`parseCurveRefKey`), `curveOptions`, `clean`,
`fnValueAt`, `subDigits`, y las tablas `ARR_KEY`/`CURVE_LABEL`. Eso es exactamente lo
testeable, y es lo que un cambio de forma del `PlotSpec` rompe en silencio hoy.

### Principio (el de QA-05/QA-06)
**Refactor → test.** Extraer la lógica a módulos puros (`core/graphics/` o
`editor/plot/`), testearla, y dejar los componentes consumiéndola. No escribir tests contra
el JSX actual (frágiles).

### Rebanadas (orden de valor/seguridad) — **HECHO**
| Slice | Extracción | Estado | Aporte |
|---|---|---|---|
| 1 | **`plotCurves.ts`** — `CurveType`, `ARR_KEY`, `CURVE_LABEL`, `curveCount`, `curveOptions`, `curveRefKey`/`parseCurveRefKey`, `subDigits`, `clean` | ✅ | 17 tests (round-trip ref↔key, opciones por spec, truncado) + de paso cubrió `plotEditorUtils` sin tests |
| 2 | **`plotPatch.ts`** — `removalPatch`, `addPatch`, `changeTypePatch`, `syntaxPatch` | ✅ | 11 tests: cubre el **reindexado** al borrar función/serie, que vivía sin red |
| 3 | **`fnValueAt`** → `plotEditorUtils.ts` | ✅ | 5 tests (explícita, parámetros, ramas, no parseable, fuera de dominio) |
| 4 | **`plotRows.tsx`** — las 6 filas `*Row`; `ParamNumberField`/`LabelPosSelect` a `plotEditorParts` | ✅ | split físico: `PlotEditor.tsx` 1.686 → **889** (−47%) |

**Resultado:** `PlotEditor.tsx` de **1.686 → 889** líneas; **40 tests nuevos** donde había 0 en el
área de gráficos. El patrón `refactor→test` volvió a pagar: la lógica de reindexado (borrar una
función corre los índices de áreas/tangentes/puntos) quedó cubierta por primera vez.

### Compuerta
Cada slice: `npm run build` + `npm test` + `npm run lint` verde antes de commitear. La paridad
la cuidan los tests existentes de `core/graphics/` (svg, relation) + los nuevos de cada módulo.

---

## Ítem 2 — F-1: clasificar los campos de `PlotSpec` (las 4 reglas)

La pregunta de la auditoría: *"el 33% del AST es un panel de configuración de gráficos"* —
¿es intención semántica o carpintería? Pasada campo por campo por
[reglas-del-modelo.md](../03-modelo-semantico/reglas-del-modelo.md): ¿vive en **AST** (contenido
del gráfico) · **política compartida** (dos backends lo resolverían distinto = bug) · **ocasión
de emisión** (`opts`; dos personas lo querrían distinto sobre el mismo doc) · **estado de
editor** (no debería persistir en el AST)?

| Campo(s) | Veredicto | Razón |
|----------|-----------|-------|
| `functions`, `parametrics`, `polars`, `implicits`, `conics`, `data`, `areas`, `points`, `vlines`, `hlines`, `tangents`, `intersections`, `texts`, `parameters` | **AST** ✓ | Son el **contenido** del gráfico: qué se dibuja. Intención pura. |
| `domain`, `range`, `equalAxes` | **AST** ✓ | El encuadre es parte de qué significa el gráfico (una parábola en `[-1,1]` no es la misma figura que en `[-10,10]`). |
| `xlabel`, `ylabel`, `title` | **AST** ✓ | Contenido textual autoral de la figura. |
| `grid`, `legend`, `featureLegend`, `legendPos`, `hideTicks`, `piTicks` | **AST** (presentación autoral) | Preferencias de display *elegidas por el autor para esta figura*; viajan con el documento, no con la ocasión. Se quedan, pero **documentadas como "presentación", no intención**. |
| `samples` | **AST (receta autoral)** | Densidad de muestreo: receta de render, pero **elegida por el autor para esta figura** (una curva con esquinas quiere más muestras). No cambia *qué* es la figura, sí *cómo* se traza; viaja con el documento. Se queda, documentado como receta. |
| `syntax` (`ascii`\|`latex`) | **AST (notación autoral)** — resuelto en slice 2 | Primera lectura: "estado de editor filtrado al AST". Segunda lectura (la correcta): es la **notación en que el autor escribió las fórmulas**. Litmus de la Regla 2 "¿afecta la salida?" → **no**: ASCII y LaTeX compilan a la misma curva. Pero sacarlo **pierde fidelidad al reabrir/compartir** (el editor tendría que adivinar el modo) sin ganar nada — un lateral con costo de UX, no una purificación. **Se queda**; lo que sí se hizo fue **extraer y testear su conversión** (`syntaxPatch`). |

**Conclusión de F-1:** el `PlotSpec` es, en su enorme mayoría, **contenido semántico legítimo**
(la auditoría lo sobredimensionó; el contra-informe ya lo bajó a 33%). Pasados los ~30 campos por
las 4 reglas, **ninguno resultó mal ubicado**: los dos sospechosos (`samples`, `syntax`) son
**receta/notación elegida por el autor** que viaja con el documento, no estado transitorio ni
ocasión de emisión. F-1 se **cierra como decisión tomada** (esta tabla), no como deuda: el modelo
del gráfico está sano; lo que faltaba era la **cobertura** de su lógica (QA-09), no reclasificarlo.
El aprendizaje: "config panel" describía la *UI* (la pestaña Ejes), no una impureza del *modelo*.

---

## Lo que queda registrado (ítems 3-9)

Anotados arriba y en el backlog (AR-11, F-3, O-2, O-3, C-2, C-3 ya tienen ID; se agregan
**QA-09** y **QA-10** al backlog). Nada se pierde: cada uno tiene ID estable y esta tabla es su
índice de prioridad.
