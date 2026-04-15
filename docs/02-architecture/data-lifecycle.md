# Data Lifecycle — From Keystroke to `.tex`

> A complete trace of what happens to a piece of mathematics from the moment
> the user interacts with it until it appears as LaTeX in the exported file.
> This document is the authoritative source for understanding where state lives
> and which module owns each transformation.

---

## Overview

```
USER INPUT
    │
    ├─ [A] Types in LaTeX textarea
    │       ↓
    │   textarea.value  (raw LaTeX string)
    │
    └─ [B] Interacts with MathLive field (Visual Mode)
            ↓
        mf.getValue('math-json')  (MathJSON AST)

            ↓ (both paths converge here)
    ─────────────────────────────────────────────────
    ASTParser.parse()
            ↓
    MathAST  (Formalia's typed AST)
            ↓
    Normalizer.apply(ast, manifest, mode)
            ↓
    { ast: MathAST, changes: NormalizerChange[] }
            ↓
    ASTSerializer.serialize(ast)
            ↓
    canonical LaTeX string
    ─────────────────────────────────────────────────
            ↓
    EditorStore.setActiveFormula(canonicalLatex, changes)
            ↓
    ┌───────────────────┐   ┌─────────────────────┐
    │  Tiptap dispatch   │   │   CoachPanel update  │
    │  setNodeMarkup     │   │   (NormalizerChange[])│
    └────────┬──────────┘   └─────────────────────┘
             ↓
    NodeView.update()
             ↓
    KaTeX.render(canonicalLatex, domEl)  — in-situ in document
             ↓
    Formula renders at cursor position
```

---

## Stage 1 — User Input

Two entry points. Both are valid; both converge at the same pipeline.

### Path A: LaTeX Textarea (Codex Mode)

The user types LaTeX directly in the Formula Panel textarea.

```typescript
// FormulaPanel.ts
textarea.addEventListener('input', () => {
  syncSrc = 'text'
  // Raw value goes to pipeline immediately
  pipeline.process(textarea.value, 'latex')
  requestAnimationFrame(() => { syncSrc = null })
})
```

**State owner at this point:** the textarea DOM element.  
**Format:** raw LaTeX string (may be non-canonical, may have forbidden syntax).

### Path B: MathLive Field (Visual Mode)

The user interacts with the `<math-field>` custom element.

```typescript
// FormulaPanel.ts
globalMF.addEventListener('input', () => {
  // MathJSON is the structured representation — more reliable than getValue('latex')
  const mathJson = globalMF.getValue('math-json')
  pipeline.process(mathJson, 'math-json')
})
```

**State owner at this point:** MathLive's internal representation.  
**Format:** MathJSON (structured AST, not text).

### Sync between the two paths

When Path B is active, the textarea mirrors the result for readability.  
When Path A is active, MathLive mirrors the value for visual feedback.  
The `syncSrc` flag prevents feedback loops. See `formula_demo.html`.

---

## Stage 2 — ASTParser

**Module:** `src/core/math/ASTParser.ts`  
**Input:** raw LaTeX string OR MathJSON object  
**Output:** `MathAST`

```typescript
class ASTParser {
  parseLatex(latex: string): MathAST
  parseMathJson(json: MathJsonExpression): MathAST
}
```

For Path A (LaTeX string), the parser uses MathLive internally:
```typescript
parseLatex(latex: string): MathAST {
  // Temporarily set a hidden math-field's value and extract MathJSON
  this._hidden.value = latex
  return this.parseMathJson(this._hidden.getValue('math-json'))
}
```

This ensures both paths produce identical `MathAST` structures for the same
mathematical expression, regardless of entry point.

**State owner after this stage:** `MathAST` object in memory.

---

## Stage 3 — Normalizer

**Module:** `src/core/math/normalizer/Normalizer.ts`  
**Input:** `MathAST`, `ResolvedManifest`, `NormalizerMode`  
**Output:** `{ ast: MathAST, changes: NormalizerChange[] }`

Rules run in this fixed order (order matters — `MacroExpansion` must run before
`AutoDelimiters` so that `\mathbb{R}` is already `\R` when delimiter checking occurs):

```
1. ForbiddenSyntax    (blocks pipeline if triggered)
2. MacroExpansion     (required)
3. AutoDelimiters     (required)
4. DxSpacing          (required)
5. TextInMath         (preferred)
6. AlignedSteps       (preferred — suggestion only in mixed mode)
7. DisplayThreshold   (opinionated — suggestion only in mixed mode)
```

Each rule calls `applies(ast, manifest)` before `transform()`. If `applies()`
returns false, the rule is skipped with no `NormalizerChange` generated.

In `strict` mode, all 7 rules auto-apply.  
In `mixed` mode, rules 1–5 auto-apply; rules 6–7 produce suggestion-only changes.  
In `suggestion` mode, all rules produce suggestion-only changes.

**State owner after this stage:** new `MathAST` (immutable transform — original
is preserved for Revert), plus `NormalizerChange[]`.

---

## Stage 4 — ASTSerializer

**Module:** `src/core/math/ASTSerializer.ts`  
**Input:** post-normalization `MathAST`  
**Output:** canonical LaTeX string

```typescript
class ASTSerializer {
  toLatex(ast: MathAST): string
}
```

This is a pure tree-walk. No string manipulation, no regex. Every node type in
`MathAST` has a corresponding serialization handler.

**State owner after this stage:** canonical LaTeX string in memory.

---

## Stage 5 — EditorStore Dispatch

**Module:** `src/core/editor/EditorStore.ts`

```typescript
EditorStore.setActiveFormula(canonicalLatex, changes)
```

This method does two things in parallel:

**5a. Tiptap transaction:**
```typescript
view.dispatch(
  view.state.tr.setNodeMarkup(activeNodePos, null, { latex: canonicalLatex })
)
```
The canonical LaTeX is written into the node's `latex` attribute. This is the
**permanent state** — every other representation (KaTeX render, textarea, MathLive)
is derived from this.

**5b. CoachStore update:**
```typescript
CoachStore.setChanges(changes)
```
The `NormalizerChange[]` array is pushed to the Coach Panel for display.

---

## Stage 6 — NodeView Render

**Modules:** `src/core/editor/extensions/MathInline.ts`, `MathDisplay.ts`

Tiptap calls `NodeView.update(node)` after the transaction.

```typescript
update(node: Node) {
  if (node.type.name !== this.nodeName) return false
  katex.render(node.attrs.latex, this.katexContainer, {
    throwOnError: false,
    displayMode: this.isDisplay
  })
  return true
}
```

**State owner at this point:** the KaTeX-rendered DOM.  
**This is the visual representation the user sees in the document.**

---

## Stage 7 — Formula Panel Sync (back-channel)

After the Tiptap transaction completes, `EditorStore` notifies `FormulaPanel`:

```typescript
FormulaPanel.syncFromNode(canonicalLatex)
```

This updates the textarea to show the canonical LaTeX (which may differ from what
the user originally typed, if normalization changed something). The `syncSrc` flag
is `null` at this point, so no feedback loop is triggered.

---

## Stage 8 — Export to `.tex`

**Module:** `src/core/serializer/TexSerializer.ts`  
**Triggered by:** user clicking "Export .tex"  
**Input:** full `.ltxj` document JSON + `ResolvedManifest`  
**Output:** complete `.tex` string

```typescript
function serializeToTex(doc: LtxjDocument, manifest: ResolvedManifest): string
```

The serializer walks the document tree and maps each node to its LaTeX equivalent.
Because all `latex` attributes are already canonical (written in Stage 5a),
the serializer performs **no normalization** — only structural mapping.

Preamble is generated once from the manifest, then the body is walked.

```
preamble (from manifest)
  → \documentclass
  → \usepackage list (in load order from profile.json)
  → \hypersetup
  → \geometry
  → macro injection (\newcommand, \DeclareMathOperator)
  → \newtheorem declarations (in counter-dependency order)
  → \title, \author, \date

body (from document tree)
  → each BlockNode → LaTeX block
  → each InlineNode within paragraphs → LaTeX inline
  → crossRef nodes → \cref{} or \Cref{} (based on position attr)
```

---

## State Ownership Summary

| What | Where it lives | Format |
|---|---|---|
| Permanent formula content | Tiptap node `.attrs.latex` | Canonical LaTeX string |
| Visual render in document | KaTeX DOM (NodeView) | HTML/SVG |
| Active edit buffer | Formula Panel textarea | Raw LaTeX (pre-normalization) |
| Active visual edit | MathLive `<math-field>` | MathJSON + visual |
| Coach suggestions | CoachStore | `NormalizerChange[]` |
| Full document | `.ltxj` / Tiptap JSON | JSON |
| Exported file | `.tex` string | LaTeX |

**The only permanent, authoritative state is the `latex` attribute in each Tiptap
node.** Everything else is derived.
