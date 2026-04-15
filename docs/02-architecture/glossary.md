# Glossary — Formalia Terms

> Canonical definitions for every term used across the codebase and documentation.
> When a term appears in specs, code comments, or commit messages, it refers to
> the definition here — not to any external meaning it might carry.

---

## Core Concepts

### AST (Abstract Syntax Tree)
The internal representation of a mathematical expression as a tree of typed nodes.
In Formalia, the AST is produced by `ASTParser` from MathLive's MathJSON output.
It is the source of truth for normalization and serialization of a single formula.
Distinct from the Tiptap document tree (which represents the full document) and from
`.ltxj` (which is the persistence format).

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

### EditorStore
The mediator module (`src/core/editor/EditorStore.ts`) that is the **only bridge**
between the Tiptap editor and the rest of the application.

Responsibilities:
- Exposes signals (`activeFormula`, `coachChanges`, `activeNodePos`) that Lit components subscribe to.
- Translates Lit component actions (e.g. "user accepted a suggestion") into Tiptap transactions.
- Subscribes to ProseMirror's `'update'` event and updates signals accordingly.

**No Lit component ever imports the Tiptap `editor` object directly.**
**No Tiptap NodeView ever reads a signal from EditorStore.**
This unidirectional discipline prevents update loops between the two reactive systems.

### EffectiveConfig
The runtime object used by the `TexSerializer` when producing `.tex` output.
Built by `ManifestEngine.buildEffectiveConfig(profile, manifest, override?)`.
It is the result of merging the `ResolvedProfile`, the `Manifest`, and any
`ExportOverride`. It is never persisted — computed fresh per export.

### ExportOverride
An ephemeral, per-export patch applied on top of a resolved manifest.
Used for minor cosmetic or mode-level changes (margins, paper size, disabled rules)
that do not justify a new profile or manifest. Never persisted.
Full spec: `docs/03-engine-specs/export-override.md`.

### Formula Panel
The always-visible top bar component containing the LaTeX textarea and (in visual mode)
the MathLive field. One Formula Panel instance exists for the entire editor; it
reflects the currently active formula node.

### `.ltxj`
The Formalia document **persistence format** — a JSON serialization of the full document.
"ltxj" = LaTeX JSON. Full schema in `docs/02-architecture/data-model.md`.

`.ltxj` is **not** the runtime state. During editing, the source of truth is ProseMirror's
internal state (accessed via Tiptap). `.ltxj` is produced from ProseMirror on save, and
loaded into ProseMirror on open. No component should read `.ltxj` in a hot path or
subscribe to it reactively — use `EditorStore` signals instead.

### Manifest
The serialization contract for a document family targeting a specific output format.
Defines: package list and load order, environment styles (`\theoremstyle`), geometry,
`cleveref` locale config. Machine-readable: `manifest.json`. Human-readable companion:
`manifesto.md § Part C`.
**Distinct from Profile:** the manifest knows nothing about which nodes are valid or
how to normalize them. It only knows how to convert an already-valid `.ltxj` into LaTeX.
See also: `Profile`, `ManifestEngine`.

### ManifestEngine
The module (`src/core/manifests/ManifestEngine.ts`) that:
1. Resolves a profile's inheritance chain → `ResolvedProfile`
2. Loads the corresponding manifest → `Manifest`
3. Merges them with any `ExportOverride` → `EffectiveConfig`

What the `Normalizer` receives: `ResolvedProfile`.
What the `TexSerializer` receives: `EffectiveConfig`.

### MathAST
Formalia's internal AST type for a single mathematical expression. Produced by
`ASTParser` from MathJSON. Distinct from the full `.ltxj` document tree.
Defined in `src/core/math/MathAST.ts`.

### MathJSON
The AST format produced by MathLive via `mf.getValue('math-json')`.
An open standard by CortexJS. `ASTParser` converts MathJSON → `MathAST`.
Reference: https://cortexjs.io/math-json

### NodeView
A Tiptap / ProseMirror concept: a custom DOM rendering for a node type. In Formalia,
`MathInline`, `MathDisplay`, and `TheoremEnv` each have a NodeView. NodeViews are
**read-only projections** of node state — they never write to the editor store.

### Normalizer
The module (`src/core/math/normalizer/Normalizer.ts`) that applies a set of
`NormalizerRule` instances to a `MathAST` and returns a new `MathAST` plus a list
of `NormalizerChange` objects. Operates on AST structure — never on raw LaTeX strings.
The Normalizer receives a `ResolvedProfile` (not the full `EffectiveConfig`) because
normalization is a profile-level concern, independent of the serialization target.

### NormalizerChange
A record `{ ruleId, description, justification, before, after, reversible }`
produced by a `NormalizerRule` when it transforms a node. Fed to the Coach Panel
for display. The `before`/`after` fields are canonical LaTeX strings.

### NormalizerMode
Global setting controlling how aggressively the Normalizer applies rules:
`'strict'` (all rules auto-apply), `'mixed'` (required + preferred auto-apply,
opinionated suggest only), `'suggestion'` (all rules suggest only).
Default: `'mixed'`. Stored in `localStorage` and optionally overridden per profile or
per `ExportOverride`.

### NormalizerRule
An interface with `applies()` + `transform()` methods. Each rule has a `severity`
(`'required'` | `'preferred'` | `'opinionated'`) that interacts with `NormalizerMode`.
Rules in `src/core/math/normalizer/rules/`.

### Profile
The document schema and normalization policy for a document family.
Defines: supported node types, supported environment types, macro registry,
normalizer rules and severities, document class and options.
Machine-readable: `profile.json`. Human-readable companion: `manifesto.md § Part A`.
**Distinct from Manifest:** the profile knows what can exist in a `.ltxj` and how to
normalize it. It knows nothing about packages, geometry, or `\theoremstyle`.
Profiles can inherit from other profiles via the `extends` field.
See also: `Manifest`, `ManifestEngine`.

### RawLatex node
A `.ltxj` block node for LaTeX content that cannot be represented as a typed node
(e.g. `tikzFigure`, `algorithm`). Passed through verbatim by the serializer with
no normalization. Displayed in the editor as a non-editable code block.

### ResolvedProfile
The flat object returned by `ManifestEngine.resolveProfile(profileId)` after applying
inheritance. What the `Normalizer` and `SemanticLinter` actually receive — no need
to traverse parent profiles.

### SemanticLinter
The validation module (`src/core/linter/SemanticLinter.ts`) that runs between the
`Normalizer` and `TexSerializer`. Validates the post-normalization AST for structural
problems that would cause broken `.tex`. Produces `LinterError[]` (blocking) and
`LinterWarning[]` (non-blocking). Full spec: `docs/03-engine-specs/semantic-linter.md`.

### Signals
The reactive primitive used to connect `EditorStore` state to Lit components.
Implemented via `@preact/signals-core` (not `@lit-labs/signals`, which depends on
the TC39 Signals proposal still at Stage 2).

A signal is a value container that notifies subscribers when it changes:

```typescript
import { signal, computed } from '@preact/signals-core'

export const activeFormula = signal<string>('')
export const hasChanges    = computed(() => coachChanges.value.length > 0)
```

Lit components read signals in their `render()` method; the signal library schedules
a re-render automatically when a signal's value changes. This replaces manual
`addEventListener` / `removeEventListener` patterns for cross-component state.

**Scope:** signals live in `EditorStore`, `CoachStore`, and `FormulaStore`.
They are never used inside Tiptap NodeViews or inside the math pipeline.

### syncSrc
A three-state flag (`null | 'text' | 'text-cursor'`) in the FormulaPanel that
prevents feedback loops during bidirectional sync between the MathLive field and
the LaTeX textarea. Released via `requestAnimationFrame`. Reference implementation
in `formula_demo.html`.

### TexSerializer
The module (`src/core/serializer/TexSerializer.ts`) that walks a `.ltxj` document
and produces a `.tex` string. Takes an `EffectiveConfig` as parameter for preamble
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
| `ForbiddenSyntax` | required | `$$`, `{\bf}`, `\eqnarray` → linter errors (blocks serialization) |
| `MacroExpansion` | required | `\mathbb{R}` → `\R` |
| `AutoDelimiters` | required | `(\frac{}{})` → `\left(\right)` |
| `DxSpacing` | required | `dx` → `\,dx` after integrals |
| `TextInMath` | preferred | plain text in math → `\text{}` |
| `AlignedSteps` | opinionated | multi-`=` display → suggest `align*` |
| `DisplayThreshold` | opinionated | inline `\int`/`\sum` → suggest display |

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
