# System Design

> How the pieces connect at a high level.  
> Implementation details live in `03-engine-specs/`.

---

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Build | Vite + TypeScript | Fast HMR, strict typing from day one |
| Rich text editor | Tiptap v2 | Extensible custom nodes, ProseMirror schema |
| Math rendering | KaTeX | Synchronous, fast, clean HTML/SVG output |
| Visual math editor | MathLive | `<math-field>` custom element, built-in virtual keyboard, native LaTeX output |
| Styles | CSS custom properties + CSS modules | No UI framework; full control over design tokens |
| Fonts | Source Serif 4 (doc), Inter (UI), JetBrains Mono (code) | |

---

## Data Flow: Keystroke → `.tex`

```
User edits (MathLive field or textarea)
        ↓
    raw LaTeX or MathJSON  ←  mf.getValue('math-json')
        ↓
  ASTParser  →  MathAST
        ↓
  Normalizer.apply(ast, manifest, mode)
        ↓  produces { ast, changes: NormalizerChange[] }
  ASTSerializer  →  canonical LaTeX string
        ↓
  EditorStore.setActiveFormula(canonicalLatex, changes)
        ↓
  Tiptap transaction  →  setNodeMarkup({ latex: canonicalLatex })
        ↓  NodeView.update()
  KaTeX renders in-situ in the document
        ↓
  FormulaPanel  ←  synced with canonicalLatex
  CoachPanel    ←  displays `changes` as suggestion cards
```

**Critical invariant:** the LaTeX stored in every Tiptap node is always the canonical
post-normalizer form. NodeViews are read-only projections of document state — they
never write back to the store.

---

## Key Architectural Constraints

**`<math-field>` must never live inside ProseMirror's DOM.**  
MathLive's shadow DOM conflicts with ProseMirror event handling. The formula editor
(either the textarea or the MathLive field) always lives outside the editor —
in the top toolbar panel.

**KaTeX, not MathJax.**  
MathJax is asynchronous and heavy. KaTeX renders synchronously and covers 99% of
university-level mathematics.

**No React, No Vue.**  
Native Web Components + Tiptap. Keeps the bundle small and avoids unnecessary
abstraction layers over ProseMirror's DOM.

**Sync source flag (`syncSrc`).**  
The bidirectional sync between MathLive and the textarea uses a three-state flag
(`null | 'text' | 'text-cursor'`) with `requestAnimationFrame` release to prevent
feedback loops without race conditions. See `formula_demo.html` for the reference
implementation.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TOOLBAR ROW 1: text format · lists · undo/redo · [Export .tex] │
│  TOOLBAR ROW 2: §1 §2 §3 · $ [ ] · Thm Def Lem … · [⬡ Visual] │
├─────────────────────────────────────────────────────────────────┤
│  FORMULA PANEL  (always visible)                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ \int_a^b \frac{ \cdot }{ 1+e^{\cdot} } \,dx  ← textarea  │  │
│  └───────────────────────────────────────────────────────────┘  │
├──────────────┬──────────────────────────────────┬───────────────┤
│  SYMBOL      │   DOCUMENT (Tiptap canvas)       │  COACH PANEL  │
│  PALETTE     │                                  │               │
│  (collaps.)  │   formula renders in-situ here   │  suggestions  │
│              │   ↑ KaTeX / MathLive field       │  + Accept     │
│              │                                  │  + Revert     │
└──────────────┴──────────────────────────────────┴───────────────┘
```

---

## Source Directory Structure

```
src/
├── core/
│   ├── editor/           # Tiptap config and extensions
│   │   ├── extensions/   # MathInline, MathDisplay, TheoremEnv, CrossRef
│   │   └── EditorStore.ts
│   ├── math/             # Mathematical pipeline
│   │   ├── MathAST.ts    # AST types (MathJSON + Formalia extensions)
│   │   ├── ASTParser.ts  # mf.getValue('math-json') → MathAST
│   │   ├── ASTSerializer.ts  # MathAST → canonical LaTeX
│   │   └── normalizer/
│   │       ├── Normalizer.ts
│   │       ├── NormalizerRule.ts
│   │       ├── NormalizerResult.ts
│   │       └── rules/
│   │           ├── AutoDelimiters.ts
│   │           ├── DxSpacing.ts
│   │           ├── TextInMath.ts
│   │           ├── MacroExpansion.ts
│   │           ├── AlignedSteps.ts
│   │           └── DisplayThreshold.ts
│   ├── manifests/
│   │   ├── ManifestEngine.ts
│   │   └── profiles/     # article-pro.json, report-base.json, …
│   └── serializer/
│       └── TexSerializer.ts
│
├── features/
│   ├── formula-editor/   # FormulaPanel + SymbolPalette + FormulaStore
│   ├── coach/            # CoachPanel + CoachStore
│   ├── templates/        # TemplateSelector + templates/*.json
│   ├── documents/        # DocumentManager + storage adapters
│   └── export/           # TexExporter + IPdfService stub
│
├── ui/
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
