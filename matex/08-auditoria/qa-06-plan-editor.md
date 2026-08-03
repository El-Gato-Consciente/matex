# QA-06 · Plan para partir el editor

> **Fase 4 del [plan de acción](plan-de-accion-2026-07.md).** `MatexWorkspace.tsx` tiene **2.109
> líneas**, **56 hooks** y **0 tests directos** — la mitad del código del producto con 6% de la
> cobertura del núcleo, y el mayor hueco de calidad según la [auditoría](auditoria-2026-07-21.md).
> Tres reportes recientes (partes, dos columnas, campos de familia) son síntomas de lo mismo: el
> editor laga el modelo porque es intratable.

## Principio (el de QA-05)

**Refactor → test, no test → refactor.** Escribir tests contra el God component actual da tests
frágiles que se rompen con cada cambio cosmético. Primero se extrae la **lógica** a unidades
cohesivas (hooks + módulos puros), y recién eso se testea — como `paths.ts`/`outcome.ts` hicieron
testeable el backend. Cada rebanada se commitea en verde.

## Las siete costuras (del mapeo)

El componente mezcla siete responsabilidades. En orden de valor/seguridad para extraer:

| # | Concern | Estado hoy | Extraer a | Testeable |
|---|---------|-----------|-----------|-----------|
| 1 | **Compilación** (`result`, `compiling`, `compiledLatex`, `handleCompile`, `outputStale`, autosave) | efecto + callbacks sueltos | **`useMatexCompile` hook** | sí (compiler + store dobles) |
| 2 | **Archivos/assets** (`imageFiles`, `textFiles`, `dataUrls`, subir/borrar/renombrar, `buildDataUrls`, `safeAssetName`, `uniqueName`) | estado + funciones | **`useProjectAssets` hook** + `assets.ts` puro | sí |
| 3 | **Descargas** (`downloadAst/Html/Bundle/Tex`, `baseName`) | funciones sueltas | **`downloads.ts`** (puro, recibe ast/nombre) | sí |
| 4 | **Config de documento** (el modal: docKind/style/accent/columns/familia/márgenes/toc) | JSX + `applyDocClass` inline | **`<DocumentSettings>` componente** + helpers puros | sí (helpers) |
| 5 | **Inserción de nodos** (`insertTheorem/Callout/Figure/Plot/Slide/Part/…`) | ~15 funciones `editor.chain()` | **`insertActions.ts`** (recibe `editor`) | parcial |
| 6 | **Layout/paneles** (`filesCollapsed`, `outputCollapsed`, `rightView`, `inspectorW`, refs) | estado UI | **`useWorkspaceLayout` hook** | liviano |
| 7 | **Bibliografía bridge** (`referencesRef`, `setBibKeysProvider`, `MATEX_BIB_EVENT`) | efectos | ya semi-aislado; dejar o `useBibBridge` | — |

Lo que **queda** en `MatexWorkspace` tras las extracciones: la composición (armar el `useEditor`
con las extensiones) + el JSX de layout, consumiendo los hooks. De ~2.100 líneas debería bajar a
~600-800 de orquestación/JSX legítimos.

## Orden de rebanadas — progreso

| Slice | Extracción | Estado | Bug/feature |
|---|---|---|---|
| 1 | **`useMatexCompile`** (compilar/staleness/descarga) + 6 tests | ✅ | verificó que la descarga nunca entregue un PDF viejo |
| 2 | **`assets.ts`** (mime/dataUrls/nombres/usedFigureSrcs) + 11 tests | ✅ | **bug**: `usedFigureSrcs` no recorría callout/reasoning/columns/slide/póster/examen → imágenes contadas como sin usar |
| 3 | **`downloads.ts`** (.mtex/.html/.zip/.tex) + 4 tests | ✅ | **bug**: nombre de solo espacios → archivo sin nombre |
| 4 | **`<DocumentSettings>`** + **ME-47** (UI de familias) + 8 tests | ✅ | **feature**: editar carta/examen/CV/póster desde el editor (3er reporte del usuario) |
| 5 | **`defaultSpecs.ts`** (fábricas de gráficos) + 8 tests | ✅ | pura, testeada |
| 6 | **`insertActions.ts`** (12 inserciones agrupadas) | ✅ | cierra el split; el componente queda en orquestación + JSX |

**Resultado a slice 5:** `MatexWorkspace` de **2.109 → 1.853 líneas**; **5 módulos nuevos con 37
tests directos** donde antes había 0. Cada slice de lógica real destapó un bug latente o entregó
una feature — el patrón "refactor→test" pagando exactamente lo que promete.

**Sobre el slice 6:** lo que queda (agrupar las ~15 `insert*` y el estado de layout) es
**wiring de UI fino**, sin lógica testeable de valor. Se puede hacer para completar el split
cosmético, pero el grueso de la deuda —lógica sin cobertura— ya está saldado. Prioridad baja
frente a otros frentes.

## Compuerta

Cada slice: `tsc -b` + `npm test` + `npm run lint` en verde antes de commitear. La **paridad de
comportamiento** la cuida la suite existente (mapping round-trip, numbering, etc.) + los tests
nuevos de cada hook. Al terminar, el editor pasa de 6% a cobertura real de su lógica.

## Por qué QA-06 antes que ME-47

ME-47 (UI de familias) es una sección de UI nueva sustancial. Hecha sobre el God component actual
sería otra pieza sin tests y enredada; hecha sobre el **slice 4** ya partido, entra limpia y
testeada. El refactor no se hace dos veces. (Ver la decisión de orden en el plan de acción.)
