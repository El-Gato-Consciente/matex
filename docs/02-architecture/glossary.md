# Glossary — Formalia Terms

> Canonical definitions for every term used across the codebase and documentation.
> When a term appears in specs, code comments, or commit messages, it refers to
> the definition here — not to any external meaning it might carry.

---

## Core Concepts

### AST (Abstract Syntax Tree)
The internal representation of a mathematical expression as a tree of typed nodes.
In Formalia, the AST is produced by `ASTParser` from MathLive's MathJSON output.
It is the **source of truth** for all normalization and serialization.
Distinct from the Tiptap document tree, which represents the full document structure.

### Canonical LaTeX
The LaTeX string that results from running the `ASTSerializer` on a post-normalized
`MathAST`. Canonical LaTeX satisfies all invariants defined in Part D of the manifesto:
no `\mathbb{R}` in the body, `\,dx` before all differentials, `\left(\right)` around
fractions, etc. The `latex` attribute of every `.ltxj` math node contains canonical LaTeX.

### Coach Panel
The UI component (right sidebar) that surfaces `NormalizerChange` objects to the user
as suggestion cards with Accept / Revert actions. The Coach Panel is the *interface*
to the Normalizer — it never modifies the AST directly.

### CrossRef node
A `.ltxj` inline node representing a cross-reference. Carries `refId` and `position`
(`"mid"` | `"start"`). Serialized as `\cref{id}` or `\Cref{id}`. The user sees
a chip `[→ label]`; they never write `\cref` manually.

### Formula Panel
The always-visible top bar component containing the LaTeX textarea and (in visual mode)
the MathLive field. One Formula Panel instance exists for the entire editor; it
reflects the currently active formula node.

### `.ltxj`
The Formalia document format — a JSON serialization of the full document AST.
"ltxj" = LaTeX JSON. Full schema in `docs/02-architecture/data-model.md`.

### MathAST
Formalia's internal AST type for a single mathematical expression. Produced by
`ASTParser` from MathJSON. Distinct from the full `.ltxj` document tree.
Defined in `src/core/math/MathAST.ts`.

### MathJSON
The AST format produced by MathLive via `mf.getValue('math-json')`.
An open standard by CortexJS. `ASTParser` converts MathJSON → `MathAST`.
Reference: https://cortexjs.io/math-json

### Manifest / Profile
A machine-readable contract (`profile.json`) that specifies which packages,
macros, theorem environments, and normalization rules apply to a document class.
Loaded at runtime by `ManifestEngine`. Human-readable companion: `manifesto.md`.
See `docs/03-engine-specs/article-pro/`.

### ManifestEngine
The module (`src/core/manifests/ManifestEngine.ts`) that resolves a profile's
inheritance chain and returns a flat `ResolvedManifest` object used by the
Normalizer and TexSerializer.

### NodeView
A Tiptap / ProseMirror concept: a custom DOM rendering for a node type. In Formalia,
`MathInline`, `MathDisplay`, and `TheoremEnv` each have a NodeView. NodeViews are
**read-only projections** of node state — they never write to the editor store.

### Normalizer
The module (`src/core/math/normalizer/Normalizer.ts`) that applies a set of
`NormalizerRule` instances to a `MathAST` and returns a new `MathAST` plus a list
of `NormalizerChange` objects. Operates on AST structure — never on raw LaTeX strings.

### NormalizerChange
A record `{ ruleId, description, justification, before, after, reversible }`
produced by a `NormalizerRule` when it transforms a node. Fed to the Coach Panel
for display. The `before`/`after` fields are canonical LaTeX strings.

### NormalizerMode
Global setting controlling how aggressively the Normalizer applies rules:
`'strict'` (all rules auto-apply), `'mixed'` (required + preferred auto-apply,
opinionated suggest only), `'suggestion'` (all rules suggest only).
Default: `'mixed'`. Stored in `localStorage` and optionally overridden per profile.

### NormalizerRule
An interface with `applies()` + `transform()` methods. Each rule has a `severity`
(`'required'` | `'preferred'` | `'opinionated'`) that interacts with `NormalizerMode`.
Rules in `src/core/math/normalizer/rules/`.

### RawLatex node
A `.ltxj` block node for LaTeX content that cannot be represented as a typed node
(e.g. `tikzFigure`, `algorithm`). Passed through verbatim by the serializer with
no normalization. Displayed in the editor as a non-editable code block.

### Resolved Manifest
The flat object returned by `ManifestEngine.resolve(profileId)` after applying
inheritance. What the Normalizer and TexSerializer actually receive — no need
to traverse parent profiles.

### SemanticLinter
The validation layer that runs before serialization and surfaces `LinterError`
objects (codes `E001`–`E005`) as blocking errors in the UI. Prevents the serializer
from producing invalid `.tex`. Defined in Part D of `manifesto.md`.

### syncSrc
A three-state flag (`null | 'text' | 'text-cursor'`) in the FormulaPanel that
prevents feedback loops during bidirectional sync between the MathLive field and
the LaTeX textarea. Released via `requestAnimationFrame`. Reference implementation
in `formula_demo.html`.

### TexSerializer
The module (`src/core/serializer/TexSerializer.ts`) that walks a `.ltxj` document
and produces a `.tex` string. Takes a `ResolvedManifest` as parameter for preamble
generation and macro injection. Assumes all `latex` node attributes are already
canonical (post-Normalizer).

### TheoremEnv node
A `.ltxj` block node representing a theorem-like environment (theorem, lemma,
definition, proof, exercise, etc.). Has `envType`, `envTitle`, `label`, and
`content` (editable block children). Rendered in the editor with a colored left
border; serialized as `\begin{envType}[title]\label{lbl}…\end{envType}`.

### Visual Mode
The global editor mode in which the active formula is displayed as a live
`<math-field>` MathLive element in-situ in the document (instead of KaTeX static
rendering). Toggled by the mode button in toolbar row 2. Persisted in `localStorage`.

---

## Label Prefix Convention

| Prefix | Used for | Example |
|---|---|---|
| `sec:` | headings / sections | `sec:introduction` |
| `eq:` | `mathDisplay` equations | `eq:euler` |
| `thm:` | theorem environments | `thm:bolzano` |
| `def:` | definition environments | `def:continuity` |
| `lem:` | lemma environments | `lem:gronwall` |
| `prop:` | proposition environments | `prop:density` |
| `cor:` | corollary environments | `cor:roots` |
| `ex:` | exercise environments | `ex:1` |
| `fig:` | figures (rawLatex) | `fig:diagram` |
| `tab:` | tables (rawLatex) | `tab:results` |

---

## Normalizer Rule IDs

| ID | Severity | What it does |
|---|---|---|
| `AutoDelimiters` | required | `(\frac{}{})` → `\left(\right)` |
| `DxSpacing` | required | `dx` → `\,dx` after integrals |
| `TextInMath` | preferred | plain text in math → `\text{}` |
| `MacroExpansion` | required | `\mathbb{R}` → `\R` |
| `AlignedSteps` | preferred | multi-`=` display → suggest `align*` |
| `DisplayThreshold` | opinionated | inline `\int`/`\sum` → suggest display |
| `ForbiddenSyntax` | required | `$$`, `{\bf}`, `\eqnarray` → linter error |

---

## Linter Error Codes

| Code | Trigger |
|---|---|
| `E001` | `$$…$$` in AST math content |
| `E002` | `{\bf …}` or `{\it …}` |
| `E003` | `\eqnarray` |
| `E004` | `crossRef` node with no matching `\label` in document |
| `E005` | `proof` environment with no preceding theorem in scope |

## Warning Codes

| Code | Trigger |
|---|---|
| `W001` | Multi-word text in math without `\text{}` |
| `W002` | `mathDisplay` with multiple `=` without `align*` |
| `W003` | `mathInline` with `\int`/`\sum` with limits |
| `W004` | Heading level 3 used |
| `W005` | Document > 2 pages without `\tableofcontents` |
