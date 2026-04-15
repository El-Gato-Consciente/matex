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

## Scope Decision: LaTeX-First, STEM-First

Formalia targets **academics who already use LaTeX**: mathematics, physics, CS, economics.
This is a deliberate constraint, not a temporary limitation.

**Why LaTeX-first:**
- The math normalization value proposition only makes sense in a LaTeX context.
- LaTeX users are underserved by existing editors (Overleaf is a cloud IDE, not a semantic editor).
- Expanding to Word/HTML output before the LaTeX core is proven adds complexity without validating the core idea.

**What this means in practice:**
- All serialization targets in Phases 1–4 are LaTeX.
- The `.ltxj` format is designed to support non-LaTeX manifests in the future (the Profile/Manifest split exists precisely for this), but no non-LaTeX manifest will be built until the math LaTeX core is mature.
- Expansion to humanities (philosophy, literature) only makes sense alongside non-LaTeX output; it is deferred accordingly.

**The expansion model when the time comes:**
There are two distinct directions Formalia can grow, and they should not be conflated:

```
Direction A — More domains, same output (LaTeX)
  e.g. physics thesis, CS paper, economics working paper
  Cost: new profiles + domain node types
  Benefit: same audience, higher coverage

Direction B — Same domain, more output formats
  e.g. article-pro → HTML, article-pro → DOCX
  Cost: new manifests + non-LaTeX serialization infrastructure
  Benefit: new audience (non-LaTeX academics)
```

Phase 4 should decide which direction to pursue first, based on observed user demand.
Both directions are architecturally supported; neither is pre-committed.

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
- Full Normalizer: `TextInMath`, `AlignedSteps`, `DisplayThreshold`, `ForbiddenSyntax`
- Three normalizer modes: strict / suggestion / mixed (global + per template)
- Full CoachPanel: Accept/Revert cards + contextual env hints
- Template selector (welcome screen)
- Semantic templates: Homework, Notes, Article, Step-by-step Derivation
- ManifestEngine: profile + manifest resolution + inheritance chain
- `CrossRef` node + numbered equations
- Document metadata panel (collapsible)
- Multi-document management (sidebar + LocalStorageAdapter)
- Editor visual themes

## Phase 3 — Round-Trip, Robustness & Tests

**Goal:** `.tex` import, scale readiness, test coverage.

- `.tex` parser → Tiptap JSON (round-trip) + `RawLatex` node
- SemanticLinter: full E001–E005 + W001–W005 coverage
- ExportOverride UI (intermediate user level)
- IndexedDB adapter for large documents
- LaTeX syntax validation in textarea (lightweight parser)
- Command autocomplete in textarea
- Accessibility (a11y): keyboard navigation, ARIA
- Unit tests: each `Normalizer` rule, `ASTSerializer`, `ManifestEngine`, `.tex` serializer, `SemanticLinter`

## Phase 4 — Production & Expansion (Roadmap)

**Goal:** Production release. Direction A or B chosen based on user demand.

**Core:**
- `IPdfService` with Docker backend + pdfLaTeX
- Inline PDF preview (PDF.js)
- `GoogleDriveAdapter`
- Basic auth (OAuth Google)
- Read-only document sharing (unique URL)

**Direction A (more domains, LaTeX output):**
- New profiles: `physics-paper`, `cs-paper`, `economics-working-paper`
- Domain node types as needed (e.g. `algorithm`, `codeBlock`)
- New manifests pairing each profile with a LaTeX target

**Direction B (same domain, more output):**
- Non-LaTeX manifests: `article-pro-html`, `article-pro-md`
- Serialization infrastructure for non-LaTeX targets
- `rawLatex` nodes drop gracefully with warning in non-LaTeX output
