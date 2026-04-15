# Formalia — Roadmap

> **What this is:** The product vision and phased growth plan for Formalia.  
> **What this is not:** Implementation details (see `03-engine-specs/`) or architecture decisions (see `02-architecture/`).

---

## The Vision

Formalia is not another LaTeX editor. It is a **mathematical writing environment** — a compiler of mathematical intent. The user never thinks "I am writing code"; they work from mathematical intention, and the system produces canonical, typographically impeccable LaTeX.

The four pillars:

1. **MathLive as primary input** — structured visual editing, no syntax friction.
2. **AST as source of truth** — not raw LaTeX text, but a semantic tree that enables normalization, validation, and consistent serialization.
3. **Typographic normalization engine** — an intelligent math formatter analogous to Prettier for JS: opinionated, transparent, reversible.
4. **Templates as semantic structures** — not layout presets, but mathematical intention patterns (proof, derivation, exercise set) with composition rules built in.

---

## Phase 1 — Core & Mathematical Pipeline

**Goal:** Functional editor for rich text + basic formulas, with the AST pipeline operational from day one.

- Setup: Vite + TypeScript + directory structure (includes `core/math/`)
- Design tokens CSS
- Dual-row toolbar (format + structure/math + mode toggle)
- FormulaPanel: always-visible textarea in toolbar, left symbol palette
- Tiptap nodes: `MathInline`, `MathDisplay`, `TheoremEnv`
- NodeViews: KaTeX render + click activation → sync with FormulaPanel
- Codex mode (default): textarea → reactive in-situ KaTeX
- `ASTParser` basic: `mf.getValue('math-json')` → `MathAST`
- `ASTSerializer`: `MathAST` → canonical LaTeX
- `Normalizer` with 3 rules: `AutoDelimiters`, `DxSpacing`, `MacroExpansion`
- `CoachPanel` minimal: displays `NormalizerChange[]` as read-only cards
- Input rules: `$$` → MathDisplay, `/thm` → theorem, etc.
- `.tex` serializer (article-pro manifest)
- Export modal: .tex preview + copy + download
- LocalStorage adapter: auto-save + load on startup
- Heading outline sidebar

## Phase 2 — Visual Mode, Full Normalization & Templates

**Goal:** MathLive as primary input, complete normalizer, template system.

- Visual mode global toggle; MathLive ↔ textarea ↔ Tiptap bidirectional sync
- Full Normalizer: `TextInMath`, `AlignedSteps`, `DisplayThreshold`
- Three normalizer modes: strict / suggestion / mixed (global + per template)
- Full CoachPanel: Accept/Revert cards + contextual env hints
- Template selector (welcome screen)
- Semantic templates: Homework, Notes, Article, Step-by-step Derivation, Thesis
- ManifestEngine: inheritance + resolution + `normalizerRules` field
- `CrossRef` node + numbered equations + `\eqref{}`
- Document metadata panel (collapsible)
- Multi-document management (sidebar + LocalStorageAdapter)
- Editor visual themes

## Phase 3 — Round-Trip, Robustness & Tests

**Goal:** `.tex` import, scale readiness, test coverage.

- `.tex` parser → Tiptap JSON (round-trip) + `RawLatex` node
- IndexedDB adapter for large documents
- LaTeX syntax validation in textarea (lightweight parser)
- Command autocomplete in textarea
- Accessibility (a11y): keyboard navigation, ARIA
- Unit tests: each `Normalizer` rule, `ASTSerializer`, `ManifestEngine`, `.tex` serializer

## Phase 4 — Collaboration & PDF (Roadmap)

**Goal:** Production release.

- `IPdfService` with Docker backend + pdfLaTeX
- Inline PDF preview (PDF.js)
- `GoogleDriveAdapter`
- Basic auth (OAuth Google)
- Read-only document sharing (unique URL)
