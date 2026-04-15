# System Design

> How the pieces connect at a high level.
> Implementation details live in `03-engine-specs/`.

---

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Build | Vite + TypeScript | Fast HMR, strict typing from day one |
| Document editor | Tiptap v2 (ProseMirror) | Extensible custom nodes, well-typed schema, transaction-based state |
| UI components | Lit 3 | Lightweight Web Components (~5 KB), no VDOM, integrates cleanly with ProseMirror's DOM model |
| Reactive state | `@preact/signals` | Stable signals library; decouples Tiptap state from Lit components without framework lock-in |
| Math rendering | KaTeX | Synchronous, fast, clean HTML/SVG output |
| Visual math editor | MathLive | `<math-field>` custom element, built-in virtual keyboard, native LaTeX output |
| Styles | CSS custom properties + CSS modules | No UI framework; full control over design tokens |
| Fonts | Source Serif 4 (doc), Inter (UI), JetBrains Mono (code) | |

---

## Runtime State vs Persistence

`.ltxj` is **not** the runtime state. This distinction is critical.

```
RUNTIME (in memory, frame by frame)
  ProseMirror state     ← source of truth for the DOCUMENT during editing
                           (node tree, selection, marks, history)
  EditorStore signals   ← source of truth for UI STATE
                           (active formula, active node, normalizer changes)
  MathAST               ← transient; lives only inside the math pipeline

PERSISTENCE (written to disk / sent over the wire)
  .ltxj                 ← serialized form of the document (LocalStorage, future API)

EXPORT (produced on demand)
  .tex string           ← TexSerializer output; never stored, computed fresh
  EffectiveConfig       ← ManifestEngine output; never stored, computed fresh
```

`.ltxj` is serialized **from** ProseMirror state on save, and deserialized **to** ProseMirror
state on load. It is never polled or diffed in hot paths. Any component that needs
to react to document changes subscribes to `EditorStore` signals — not to `.ltxj`.

---

## Profile vs Manifest — The Core Distinction

Every document in Formalia is governed by two artifacts that answer different questions:

```
profile.json   "what this document IS"
               ├─ which node types are valid in the .ltxj
               ├─ which theorem environment types exist
               ├─ what macros are registered (used by Normalizer)
               ├─ which normalizer rules apply and with what severity
               └─ document class and options

manifest.json  "how this document BECOMES LaTeX"
               ├─ package list and load order
               ├─ \theoremstyle for each environment
               ├─ geometry settings
               └─ cleveref locale config
```

`ManifestEngine` resolves both into a single `EffectiveConfig` at export time.
The `Normalizer` receives only the `ResolvedProfile`; the `TexSerializer` receives
the full `EffectiveConfig`.

An optional `ExportOverride` can patch the `EffectiveConfig` for a single export
without modifying either the profile or the manifest.

---

## Tiptap / Lit Boundary

Tiptap (ProseMirror) and Lit are two reactive systems running in the same page.
Mixing them without clear rules creates update loops and unpredictable DOM state.
The following rules are **non-negotiable**:

### Rule 1 — NodeViews are vanilla TypeScript, never Lit components

ProseMirror NodeViews live inside the editor's managed DOM. Lit components use Shadow
DOM by default. Shadow DOM inside ProseMirror's DOM causes the same event-handling
conflicts documented for `<math-field>`.

NodeViews for `MathInline`, `MathDisplay`, and `TheoremEnv` are plain TypeScript
classes that implement the ProseMirror `NodeView` interface directly. They may use
KaTeX or other rendering utilities, but they are not Lit elements.

```typescript
// CORRECT
class MathDisplayView implements NodeView {
  dom: HTMLElement
  constructor(node: Node) {
    this.dom = document.createElement('div')
    katex.render(node.attrs.latex, this.dom, { displayMode: true })
  }
  update(node: Node) { /* ... */ return true }
}

// WRONG — do not do this
@customElement('math-display-view')
class MathDisplayView extends LitElement { /* Shadow DOM conflict */ }
```

### Rule 2 — `EditorStore` is the only bridge between Tiptap and Lit

Lit components never import the Tiptap `editor` object or any ProseMirror type.
They only read signals from `EditorStore` and call methods on `EditorStore`.
`EditorStore` translates those calls into Tiptap transactions internally.

```
Lit component
    │  reads signal          EditorStore              Tiptap
    ├─────────────────────→  activeFormula.get()
    │                                │
    │  calls method                  │  view.dispatch(tr)
    └─────────────────────→  setActiveFormula()  ──────────────→  ProseMirror
                                     │
                             ←────────────────────────────────────  'update' event
                             activeFormula.set(canonicalLatex)
                                     │
    ←────────────────────────────────  signal notifies Lit
```

### Rule 3 — Signals via `@preact/signals`, not `@lit-labs/signals`

`@lit-labs/signals` implements the TC39 Signals proposal, which is still at Stage 2.
Its API may change before Stage 4. `@preact/signals` is stable, battle-tested, and
works with Lit without modifications. When TC39 Signals reaches Stage 4 and browsers
implement it natively, migration is a one-line import swap.

```typescript
import { signal, computed, effect } from '@preact/signals-core'

// EditorStore.ts
export const activeFormula  = signal<string>('')
export const coachChanges   = signal<NormalizerChange[]>([])
export const activeNodePos  = signal<number | null>(null)
```

Lit components consume these via a thin integration:

```typescript
import { SignalWatcher } from '@lit-labs/signals' // bridge only; no TC39 dep
// or: manually call effect() in connectedCallback / disconnectedCallback
```

---

## Data Flow: Keystroke → `.tex`

```
User edits (MathLive field or textarea)
        ↓
    raw LaTeX or MathJSON  ←  mf.getValue('math-json')
        ↓
  ASTParser  →  MathAST
        ↓
  Normalizer.apply(ast, resolvedProfile, mode)
        ↓  produces { ast, changes: NormalizerChange[] }
  ASTSerializer  →  canonical LaTeX string
        ↓
  EditorStore.setActiveFormula(canonicalLatex, changes)
     ├──→ Tiptap dispatch → node.attrs.latex          (permanent)
     │         └──→ NodeView.update() → KaTeX → DOM   (visual)
     ├──→ activeFormula.set(canonicalLatex)            (signal → FormulaPanel)
     └──→ coachChanges.set(changes)                   (signal → CoachPanel)

                        (on Export trigger)
                        ↓
  SemanticLinter.validate(doc, resolvedProfile)
        ↓  if errors → block; surface in UI
  ManifestEngine.buildEffectiveConfig(profile, manifest, override?)
  TexSerializer.serialize(doc, effectiveConfig)
        ↓
  .tex string → download / copy
```

**Critical invariant:** the LaTeX stored in every Tiptap node is always the canonical
post-normalizer form. NodeViews are read-only projections of document state — they
never write back to the store.

---

## Key Architectural Constraints

**`<math-field>` must never live inside ProseMirror's DOM.**
MathLive's shadow DOM conflicts with ProseMirror event handling. The FormulaPanel
lives outside the editor canvas, in the top toolbar. Same reason NodeViews are not
Lit components.

**KaTeX, not MathJax.**
MathJax is asynchronous and heavy. KaTeX renders synchronously and covers 99% of
university-level mathematics.

**No React, No Vue.**
Lit + vanilla Web Components. Keeps the bundle small and avoids unnecessary
abstraction layers over ProseMirror's DOM.

**`syncSrc` with three states, not a boolean.**
The bidirectional sync between MathLive and the textarea uses a three-state flag
(`null | 'text' | 'text-cursor'`) with `requestAnimationFrame` release to prevent
feedback loops. See `formula_demo.html`.

**`ResolvedProfile` and `EffectiveConfig` must be plain serializable objects.**
No methods. These objects must be passable to a Web Worker for background `.tex`
generation without serialization failures.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TOOLBAR ROW 1: text format · lists · undo/redo · [Export .tex] │  ← Lit
│  TOOLBAR ROW 2: §1 §2 §3 · $ [ ] · Thm Def Lem … · [⬡ Visual] │  ← Lit
├─────────────────────────────────────────────────────────────────┤
│  FORMULA PANEL  (always visible)                                │  ← Lit
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ \int_a^b \frac{ \cdot }{ 1+e^{\cdot} } \,dx  ← textarea  │  │
│  └───────────────────────────────────────────────────────────┘  │
├──────────────┬──────────────────────────────────┬───────────────┤
│  SYMBOL      │   DOCUMENT (Tiptap canvas)       │  COACH PANEL  │
│  PALETTE     │                                  │               │  ← Lit
│  (collaps.)  │   NodeViews: vanilla TS          │  signals →    │
│  ← Lit       │   KaTeX renders in-situ          │  reactive     │
│              │                                  │  cards        │
└──────────────┴──────────────────────────────────┴───────────────┘
                 ↑ Tiptap/ProseMirror owns this column
```

---

## Source Directory Structure

```
src/
├── core/
│   ├── editor/
│   │   ├── extensions/          # MathInline, MathDisplay, TheoremEnv, CrossRef
│   │   │   └── *.ts             # Tiptap extensions (Node definitions)
│   │   ├── nodeviews/           # Vanilla TS NodeView implementations (NOT Lit)
│   │   │   ├── MathInlineView.ts
│   │   │   ├── MathDisplayView.ts
│   │   │   └── TheoremEnvView.ts
│   │   └── EditorStore.ts       # Bridge: Tiptap ↔ signals; single point of contact
│   ├── math/
│   │   ├── MathAST.ts
│   │   ├── ASTParser.ts
│   │   ├── ASTSerializer.ts
│   │   └── normalizer/
│   │       ├── Normalizer.ts
│   │       ├── NormalizerRule.ts
│   │       └── rules/
│   ├── linter/
│   │   └── SemanticLinter.ts
│   ├── manifests/
│   │   ├── ManifestEngine.ts
│   │   └── profiles/
│   │       ├── article-base/
│   │       └── article-pro/
│   │           ├── profile.json
│   │           └── manifest.json
│   └── serializer/
│       └── TexSerializer.ts
│
├── features/
│   ├── formula-editor/          # FormulaPanel (Lit) + SymbolPalette (Lit) + FormulaStore (signals)
│   ├── coach/                   # CoachPanel (Lit) + CoachStore (signals)
│   ├── templates/               # TemplateSelector (Lit)
│   ├── documents/               # DocumentManager + storage adapters
│   └── export/                  # TexExporter + ExportOverride
│
├── ui/                          # All Lit components
│   ├── toolbar/
│   ├── sidebar/
│   └── components/
│
├── design/
│   ├── tokens.css
│   └── themes/
│
└── main.ts
```
