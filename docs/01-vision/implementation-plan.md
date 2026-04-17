# Formalia — Plan de implementación por fases

> **Propósito de este documento:** traducir la arquitectura definida en `02-architecture/` y las
> lecciones de los demos en un plan de construcción concreto, fase a fase.
> No repite el *qué* del roadmap ni el *cómo* de system-design — asume que el lector los conoce.
> Lo que agrega: orden, criterios de salida, camino crítico, y qué extraer de los demos.

---

## Punto de partida real

Antes de arrancar la Fase 0, el proyecto ya tiene:

| Activo | Estado |
|---|---|
| Arquitectura completa | Documentada en `02-architecture/` |
| Data model `.ltxj` | Especificado en `data-model.md` |
| Reglas del normalizador | Especificadas en `03-engine-specs/normalization.md` |
| Taxonomía de contenido | Especificada en `docs/varios/formalia-content-design.md` |
| Integración TipTap + MathLive + KaTeX | **Probada y documentada** en `demo3-integration.html` + `demo3-learnings.md` |

Los demos no son código de producción, pero prueban todos los patrones críticos.
La Fase 1 no va a descubrir nada nuevo sobre la integración — la va a productionizar.

### Qué extraer de demo3 sin reinventar

| Patrón | Demo3 lo probó | Archivo destino |
|---|---|---|
| TipTap NodeView con KaTeX render + click handler | ✓ | `MathInlineView.ts`, `MathDisplayView.ts` |
| `editingSource` guard anti-feedback-loop | ✓ | `EditorStore.ts` |
| `skipMfReload` flag para evitar doble-insert | ✓ | `FormulaPanel.ts` |
| `exitLatexMode()` antes de cualquier cambio de estado | ✓ | `FormulaPanel.ts` |
| MathLive fuera del DOM de TipTap | ✓ | `index.html` (layout estructural) |
| Visual/Código toggle con toolbar como hermano de ambos wraps | ✓ | `FormulaPanel.ts` |
| Sidebar colapsable con quick-access panel | ✓ | `SnippetSidebar.ts` |
| Dark mode via `body.dark` + CSS custom properties | ✓ | `tokens.css` |
| localStorage persistence para tema y sidebar state | ✓ | `SettingsStore.ts` |

---

## Camino crítico

```
Fase 0 (scaffold)
    │
    ├──→ Fase 1 (TipTap + KaTeX + FormulaPanel modo Código)
    │         │
    │         ├──→ Fase 2 (MathLive visual mode + TheoremEnv)
    │         │         │
    │         │         └──→ Fase 3 (AST pipeline + Normalizer + CoachPanel)
    │         │                   │
    │         │                   └──→ Fase 4 (ManifestEngine + Templates)
    │         │                               │
    │         │                               └──→ Fase 5 (Producción)
    │         │
    │         └──→ [Fase 1 es la única que desbloquea todo lo demás]
    │
    └── [Fase 0 < 1 día — no es bloqueante real]
```

**La Fase 1 es el cuello de botella.** Si `EditorStore`, `MathInlineView`, y el serializer
básico están bien hechos, todas las fases siguientes son aditivas. Si están mal abstraídos,
cada fase acumula deuda.

---

## Fase 0 — Bootstrap del proyecto

**Duración estimada:** medio día  
**Criterio de salida:** `npm run dev` levanta una página en blanco sin errores; `npm run build` produce un bundle.

### Comandos de setup

```bash
cd matex/
npm init vite@latest src -- --template vanilla-ts
cd src/
npm install @tiptap/core @tiptap/pm @tiptap/starter-kit
npm install @tiptap/extension-heading @tiptap/extension-bullet-list @tiptap/extension-ordered-list @tiptap/extension-bold @tiptap/extension-italic @tiptap/extension-code
npm install katex
npm install mathlive
npm install @preact/signals-core
npm install -D @types/katex eslint prettier
```

### Estructura de directorios a crear

Crear los directorios vacíos (con `.gitkeep`) que define `system-design.md`:

```
src/
├── core/
│   ├── editor/extensions/
│   ├── editor/nodeviews/
│   ├── math/normalizer/rules/
│   ├── linter/
│   ├── manifests/profiles/article-pro/
│   └── serializer/
├── features/
│   ├── formula-editor/
│   ├── coach/
│   ├── templates/
│   ├── documents/
│   └── export/
├── ui/
│   ├── toolbar/
│   └── components/
└── design/
    └── themes/
```

### Archivos de setup

- `src/design/tokens.css` — todas las CSS custom properties del demo3 (light + dark).
  El demo3 tiene el sistema de tokens completo y probado; copiarlo directamente.
- `src/main.ts` — punto de entrada vacío que importa `tokens.css`.
- `index.html` — layout estructural: toolbar superior, fila formula panel,
  tres columnas (sidebar | editor canvas | coach panel). Sin lógica todavía.

---

## Fase 1 — Pipeline de edición mínima

**Duración estimada:** 1.5–2 semanas  
**Criterio de salida:** el usuario puede escribir un documento con texto rico y fórmulas LaTeX (modo Código), y exportar un `.tex` que compila con `pdflatex`.

### Módulos a construir (en este orden)

#### 1.1 — Nodos TipTap

`src/core/editor/extensions/MathInline.ts`
```typescript
// Node type: inline, atom
// Attrs: { latex: string }
// parseHTML: reconoce <span data-math-inline>
// renderHTML: emite <span data-math-inline="...">
// Input rule: $<latex>$ (con espacio final o Enter)
```

`src/core/editor/extensions/MathDisplay.ts`
```typescript
// Node type: block
// Attrs: { latex: string, numbered: boolean, aligned: boolean, label: string }
// Input rule: $$ en línea vacía → inserta mathDisplay
```

`src/core/editor/extensions/TheoremEnv.ts`
```typescript
// Node type: block, con contenido (como blockquote)
// Attrs: { envType: TheoremEnvType, envTitle: string, label: string }
// Input rules: /thm, /def, /ex, /rmk, /lem, /proof
```

**Nota sobre TheoremEnv:** el NodeView de Phase 1 puede ser un div estilizado básico
sin la lógica de edición de título. La lógica de header editable es Fase 2.

#### 1.2 — NodeViews

`src/core/editor/nodeviews/MathInlineView.ts`
```typescript
// Implementa NodeView de ProseMirror en vanilla TS
// Constructor: crea <span class="math-inline">, llama katex.renderToString()
// update(node): re-renderiza si latex cambió
// selectNode() / deselectNode(): añade/quita clase .selected
// En click: comunica al EditorStore que este nodo está activo
```

`src/core/editor/nodeviews/MathDisplayView.ts`
```typescript
// Igual que MathInline pero block, displayMode: true
// Click en el bloque activa la fórmula en FormulaPanel
```

`src/core/editor/nodeviews/TheoremEnvView.ts`
```typescript
// Phase 1 mínimo: div con header (tipo + número auto) y contenteditable para el body
// El body ES editable por TipTap (es un NodeView con contentDOM)
```

**Regla crítica:** los NodeViews nunca escriben de vuelta al store. Solo leen attrs y comunican clicks.

#### 1.3 — EditorStore

`src/core/editor/EditorStore.ts`

El bridge central. Contiene:

```typescript
// Signals
export const activeFormula  = signal<string>('')
export const activeNodePos  = signal<number | null>(null)
export const coachChanges   = signal<NormalizerChange[]>([])

// Ref al editor (setter, no exportar el objeto directamente)
let _editor: Editor | null = null
export function setEditor(e: Editor) { _editor = e }

// API que consumen los componentes UI
export function activateNode(pos: number, latex: string): void
export function updateActiveFormula(latex: string): void  // textarea edit
export function insertNewFormula(latex: string, displayMode: boolean): void
export function deactivateNode(): void
```

La lógica de sincronización del demo3 (`editingSource`, `skipMfReload`, 
`dispatchToTipTap`) vive aquí, no en el componente de la FormulaPanel.

#### 1.4 — FormulaPanel (modo Código)

`src/features/formula-editor/FormulaPanel.ts`

Fase 1 implementa solo el modo Código (textarea). El modo Visual (MathLive) se agrega en Fase 2.

Responsabilidades:
- Muestra la fórmula activa en un `<textarea>`
- Actualiza el nodo en TipTap via `EditorStore.updateActiveFormula()`
- Renderiza preview KaTeX debajo del textarea
- Muestra estado "ninguna fórmula activa" cuando `activeNodePos === null`
- Botones: Insertar inline `$`, Insertar display `$$`

Implementación: puede ser un Lit component o vanilla TS. **Decisión:** hacerlo Lit
desde el principio para el patrón de Phase 2+ (necesita signals reactivos).

#### 1.5 — Serializer básico

`src/core/serializer/TexSerializer.ts`

Phase 1 implementa el serializador sin ManifestEngine (hardcoded article-pro mínimo):

```typescript
// serialize(doc: ProseMirrorDoc): string
// Mapeo nodo → LaTeX:
//   paragraph → texto con \n\n
//   heading   → \section, \subsection, \subsubsection
//   mathInline → $latex$
//   mathDisplay → \[latex\] o \begin{equation}...\end{equation}
//   theoremEnv  → \begin{theorem}[title]...content...\end{theorem}
//   bold/italic/code → \textbf, \textit, \texttt
//   bulletList / orderedList → itemize / enumerate
```

Wrapper LaTeX (hardcoded Phase 1):
```latex
\documentclass{article}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{mathtools}
\newtheorem{theorem}{Theorem}
\newtheorem{definition}[theorem]{Definition}
\newtheorem{example}[theorem]{Example}
\newtheorem{remark}[theorem]{Remark}
\begin{document}
%content%
\end{document}
```

#### 1.6 — Persistencia y export

`src/features/documents/LocalStorageAdapter.ts`
- `save(doc: ProseMirrorDoc): void` — JSON del estado de TipTap a localStorage
- `load(): ProseMirrorDoc | null` — recarga al iniciar

`src/features/export/ExportModal.ts`
- Modal simple: preview del `.tex` generado + botón Copy + botón Download

#### 1.7 — Toolbar básica

`src/ui/toolbar/Toolbar.ts`

Row 1: Bold, Italic, Code | H1, H2, H3 | BulletList, OrderedList | Undo, Redo | [Export .tex]  
Row 2: Insert `$` (inline), Insert `$$` (display) | TheoremEnv buttons (/thm /def /ex /rmk) | [☾/☀ tema]

### Qué NO construir en Fase 1

- MathLive (Fase 2)
- Normalizer (Fase 3)
- Coach Panel (Fase 3)
- ManifestEngine (Fase 4)
- Template selector (Fase 4)
- Multi-document (Fase 4)
- Input rules para `/` commands — se pueden dejar para Fase 2 si agregan complejidad

---

## Fase 2 — Modo Visual y bloques semánticos completos

**Duración estimada:** 1.5 semanas  
**Criterio de salida:** MathLive integrado con toggle Visual/Código sin bugs; todos los bloques semánticos (theorem, definition, example, remark, lemma, proof) insertables y exportables.

### Módulos a extender/agregar

#### 2.1 — MathLive en FormulaPanel

Extiende `FormulaPanel.ts` con todo lo aprendido en demo3:

- Estructura HTML: `#fp-mf-toolbar` como hermano de `#fp-mf-wrap` y `#fp-source-wrap`
- `exitLatexMode()` llamado en `showPopover()`, `hidePopover()`, y antes de cualquier insert
- Guard en blur handler: `if (fpMf.mode === 'latex') return`
- `skipMfReload` flag para evitar doble-insert al activar nodo
- `editingSource` en EditorStore (no en el componente)
- Toggle Visual/Código con estado persistido en localStorage

El código del demo3 es la referencia directa. La porting es principalmente convertirlo
a TypeScript con los tipos correctos.

#### 2.2 — TheoremEnvView completo

Extiende `TheoremEnvView.ts`:
- Header con tipo + número automático editable (título opcional)
- `contentDOM`: el body del teorema es editable por TipTap (no el header)
- Estilos visuales por tipo: theorem, definition, example, remark, proof — cada uno con
  borde izquierdo de color diferente (ver `formalia-content-design.md § 2`)

Numeración automática: calculada en el serializer al contar `theoremEnv` nodes del mismo
`envType` o por índice global (depende de la config del perfil). En Phase 2 puede ser
global (un contador para todos los tipos).

#### 2.3 — SnippetSidebar

`src/features/formula-editor/SnippetSidebar.ts`

Extrae el pattern del demo3:
- Panel expandido: búsqueda + categorías + lista de snippets
- Panel colapsado: 12 botones de acceso rápido (icon-only)
- Toggle con `‹ / ›`, estado en localStorage
- Al hacer click en snippet: llama `EditorStore.insertSnippet(template)` que delega a MathLive

Los 12 snippets rápidos son los del demo3: `\frac`, `\sqrt`, potencia, `\int`, `\sum`, `\lim`,
paréntesis, matriz 2×2, `\alpha`, `\pi`, `\in`, `\leq`.

La lista expandida incluye categorías de `formalia-content-design.md § 3`
(ordenadas por frecuencia por tipo de documento).

#### 2.4 — Input rules `/` commands

```typescript
// /thm  → insertar TheoremEnv { envType: 'theorem' }
// /def  → insertar TheoremEnv { envType: 'definition' }
// /ex   → insertar TheoremEnv { envType: 'example' }
// /rmk  → insertar TheoremEnv { envType: 'remark' }
// /lem  → insertar TheoremEnv { envType: 'lemma' }
// /proof → insertar TheoremEnv { envType: 'proof' }
// $$    → insertar MathDisplay (ya en Fase 1)
```

#### 2.5 — Dark mode completo

Extraer el sistema de tokens dark del demo3 a `src/design/themes/dark.css`.
`SettingsStore.ts`: señal `isDark`, persistencia localStorage, aplicación de clase `body.dark`.

---

## Fase 3 — Pipeline AST y Normalización

**Duración estimada:** 2–3 semanas  
**Criterio de salida:** tres reglas de normalización funcionando; CoachPanel muestra cambios; el `.tex` exportado es LaTeX canónico según las specs.

### Por qué el AST pipeline va en Fase 3, no antes

El normalizer requiere MathJSON de MathLive (`mf.getValue('math-json')`), que solo está
disponible en modo Visual. En modo Código (textarea) se opera sobre strings crudos.
La Fase 3 asume que el MathLive de Fase 2 está estable.

### Módulos a construir

#### 3.1 — MathAST types

`src/core/math/MathAST.ts`

Tipos del AST interno de Formalia. No es MathJSON directamente — es una representación
simplificada y tipada que las reglas del normalizer pueden navegar:

```typescript
type MathNode =
  | { kind: 'num';     value: string }
  | { kind: 'sym';     name: string }          // variable o constante
  | { kind: 'op';      op: string; args: MathNode[] }
  | { kind: 'frac';    num: MathNode; den: MathNode }
  | { kind: 'int';     integrand: MathNode; differential: MathNode; limits?: [MathNode, MathNode] }
  | { kind: 'delim';   open: string; close: string; body: MathNode }
  | { kind: 'text';    content: string }
  | { kind: 'raw';     latex: string }         // fallback para nodos no mapeados
```

#### 3.2 — ASTParser

`src/core/math/ASTParser.ts`

```typescript
// parse(mathJson: MathJsonExpression): MathAST
// Recibe mf.getValue('math-json') y produce MathAST
// Nodos no reconocidos → MathNode { kind: 'raw', latex: string }
// Los nodos 'raw' pasan por el serializer sin modificación (safe fallback)
```

Estrategia de robustez: el parser nunca lanza excepciones. Todo lo desconocido
cae en `raw`. Esto garantiza que el normalizer no rompa fórmulas válidas que
no maneja.

#### 3.3 — Normalizer (3 reglas Phase 3)

`src/core/math/normalizer/Normalizer.ts`  
`src/core/math/normalizer/rules/AutoDelimiters.ts`  
`src/core/math/normalizer/rules/DxSpacing.ts`  
`src/core/math/normalizer/rules/MacroExpansion.ts`

Implementar exactamente según `03-engine-specs/normalization.md`.
La interface `NormalizerRule` y `NormalizerResult` ya están definidas ahí.

Integración en EditorStore:
```typescript
// updateActiveFormula() ahora llama al normalizer si las reglas aplican
// Las NormalizerChanges se emiten como signal → CoachPanel las consume
```

#### 3.4 — ASTSerializer

`src/core/math/ASTSerializer.ts`

```typescript
// serialize(ast: MathAST): string
// Produce canonical LaTeX desde el AST normalizado
// Los nodos 'raw' se emiten verbatim
```

#### 3.5 — CoachPanel

`src/features/coach/CoachPanel.ts`

Componente Lit que consume el signal `coachChanges`:

Phase 3a (read-only):
- Lista de cards: cada card muestra `change.before` → `change.after` con `change.description`
- Badge de severidad (required / preferred / opinionated)
- Sin botones de acción todavía

Phase 3b (accept/revert):
- Botón Accept en cada card: aplica el cambio al nodo activo en TipTap
- Botón Revert: deshace el cambio y marca la regla como silenciada para esta sesión
- Botón "Apply all required" en el header del panel

#### 3.6 — Reglas adicionales

`src/core/math/normalizer/rules/TextInMath.ts`  
`src/core/math/normalizer/rules/AlignedSteps.ts`  
`src/core/math/normalizer/rules/DisplayThreshold.ts`  
`src/core/math/normalizer/rules/ForbiddenSyntax.ts`

Implementar según specs. `ForbiddenSyntax` bloquea la serialización — necesita
integrarse con el export flow.

---

## Fase 4 — ManifestEngine, templates y multi-documento

**Duración estimada:** 1.5–2 semanas  
**Criterio de salida:** el usuario puede elegir tipo de documento al inicio; hay múltiples documentos abiertos; el `.tex` exportado usa los paquetes correctos según el perfil.

### Módulos a construir

#### 4.1 — ManifestEngine

`src/core/manifests/ManifestEngine.ts`

```typescript
// buildEffectiveConfig(profileId: string, override?: ExportOverride): EffectiveConfig
// Lee profile.json + manifest.json de src/core/manifests/profiles/<id>/
// Aplica ExportOverride si existe
// Retorna EffectiveConfig (plain serializable object)
```

Conectar al TexSerializer: Phase 1 usaba un wrapper hardcoded. Ahora el serializer
recibe `EffectiveConfig` y genera el preamble dinámicamente según
`manifest.json → packages` + `profile.json → macros` + `profile.json → theoremDefs`.

Los archivos `article-pro/profile.json` y `article-pro/manifest.json` ya están
especificados en `03-engine-specs/`. Crearlos en esta fase.

#### 4.2 — Template selector

`src/features/templates/TemplateSelector.ts`

Pantalla de inicio (si no hay documento en localStorage):

| Template | Profile | Estructura inicial |
|---|---|---|
| Guía de ejercicios | `article-pro` | Heading + 3 TheoremEnv(exercise) |
| Apunte de clase | `article-pro` | Heading + def + example + remark |
| Resolución de TP | `article-pro` | Heading + paragraphs con display math |
| Resumen de teoría | `article-pro` | Heading + lista de defs + tabla de fórmulas |
| Documento en blanco | `article-pro` | Solo heading |

Los contenidos de los templates vienen de `formalia-content-design.md § 5`.

#### 4.3 — Multi-documento

`src/features/documents/DocumentManager.ts`

- Lista de documentos en localStorage (índice: `formalia:docs:index`)
- Cada doc: `formalia:doc:<uuid>` → JSON del estado TipTap + metadata
- UI: sidebar de documentos (panel lateral izquierdo, colapsable)
- Crear / renombrar / duplicar / eliminar documento
- Auto-save cada 30 segundos + en blur

#### 4.4 — ExportOverride UI

`src/features/export/ExportOverridePanel.ts`

Panel colapsable en el modal de export para usuarios intermedios:
- Toggle por paquete (amsmath, mathtools, etc.)
- Campo de macros adicionales
- Ver `03-engine-specs/export-override.md`

---

## Fase 5 — Robustez y producción

**Duración estimada:** 3 semanas  
**Criterio de salida:** producto desplegable, con tests de las reglas críticas, con importación básica de `.tex`.

### Módulos a construir

#### 5.1 — Importación `.tex` (round-trip)

`src/features/documents/TexImporter.ts`

Parser ligero (no un compilador LaTeX completo):
- Reconoce: `\section`, `\subsection`, `$...$`, `\[...\]`, `\begin{theorem}...\end{theorem}`,
  `\begin{equation}`, `\begin{align*}`, párrafos, `\textbf`, `\textit`
- Lo no reconocido → `rawLatex` node con `reason: "imported verbatim"`
- Output: `LtxjDocument` para cargar en TipTap

#### 5.2 — Tests

```
tests/
├── normalizer/
│   ├── AutoDelimiters.test.ts
│   ├── DxSpacing.test.ts
│   ├── MacroExpansion.test.ts
│   ├── TextInMath.test.ts
│   └── ForbiddenSyntax.test.ts
├── serializer/
│   └── TexSerializer.test.ts
├── ast/
│   ├── ASTParser.test.ts
│   └── ASTSerializer.test.ts
└── linter/
    └── SemanticLinter.test.ts
```

Framework: Vitest (integra con Vite sin configuración).

Para cada regla del normalizer, como mínimo:
1. Caso donde `applies()` retorna true y la transformación es correcta
2. Caso donde `applies()` retorna false (falso positivo evitado)
3. Caso con la excepción documentada en la spec

#### 5.3 — SemanticLinter

`src/core/linter/SemanticLinter.ts`

Implementar según `03-engine-specs/semantic-linter.md`.
Se ejecuta al intentar exportar — bloquea si hay errores `E0xx`.

#### 5.4 — IndexedDB para documentos grandes

`src/features/documents/IndexedDBAdapter.ts`

Reemplaza a `LocalStorageAdapter` cuando el documento supera ~500KB.
Misma interface (`IStorageAdapter`), implementación diferente.

#### 5.5 — Deploy

`vercel.json` o GitHub Actions (ya hay `.github/workflows/deploy.yml`).
Revisar el workflow existente y completarlo.

---

## Decisiones de implementación que no están en otros docs

### Lit vs. vanilla TS para componentes

- **NodeViews**: siempre vanilla TS (regla no negociable de system-design)
- **FormulaPanel, SnippetSidebar, CoachPanel, Toolbar**: Lit desde Fase 1
  *Razón:* estos consumen signals; hacerlos vanilla TS en Fase 1 y reescribirlos en Fase 2
  es trabajo duplicado. El costo de aprender Lit es menor que reescribir.
- **TemplateSelector, ExportModal, DocumentSidebar**: Lit

### `@preact/signals-core` binding con Lit

Usar el patrón de `effect()` en `connectedCallback` / `disconnectedCallback`:

```typescript
// En cada Lit component que consume signals:
private _disposes: (() => void)[] = []

connectedCallback() {
  super.connectedCallback()
  this._disposes.push(
    effect(() => { this.requestUpdate() })  // re-render cuando signal cambia
  )
}

disconnectedCallback() {
  super.disconnectedCallback()
  this._disposes.forEach(d => d())
  this._disposes = []
}
```

No usar `@lit-labs/signals` todavía — TC39 Signals sigue en Stage 2.

### Numeración de TheoremEnv

En Phases 1–3: contador global por tipo (`theoremCounter`, `definitionCounter`, etc.)
calculado en el NodeView al momento de render. El NodeView itera todos los nodos
del tipo en el documento para saber su número.

En Phase 4 con ManifestEngine: el perfil define si la numeración es
global (`theorem 1, 2, 3…`) o por sección (`theorem 1.1, 1.2…`).

### LaTeX normalizado vs. LaTeX del usuario en modo Código

En Fase 1–2 (sin normalizer), el LaTeX que el usuario tipea en el textarea
se almacena tal cual en el nodo TipTap. El serializer lo emite sin modificar.

En Fase 3 (con normalizer), la pipeline es:
```
textarea edit → ASTParser → Normalizer → ASTSerializer → nodo TipTap
```
Esto significa que el LaTeX en el nodo puede diferir del que el usuario tipeo.
El CoachPanel explica la diferencia. Esta es la propuesta de valor central de Formalia.

---

## Resumen por fase

| Fase | Entregable clave | Desbloqueado por |
|---|---|---|
| **0** | Proyecto Vite+TS levanta, estructura de directorios | — |
| **1** | Editor funcional modo Código + .tex exportable | Fase 0 |
| **2** | MathLive integrado + TheoremEnv + SnippetSidebar | Fase 1 |
| **3** | Normalizer + CoachPanel (3 reglas → 7 reglas) | Fase 2 |
| **4** | ManifestEngine + templates + multi-doc | Fase 3 |
| **5** | .tex import + tests + SemanticLinter + deploy | Fase 4 |

**MVP demos-able:** fin de Fase 2 (editor completo, sin normalizer todavía).  
**MVP con propuesta de valor diferenciada:** fin de Fase 3 (normalizer + Coach Panel).
