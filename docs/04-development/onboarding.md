# Onboarding

> How to get from zero to running code.

---

## Prerequisites

- Node.js ≥ 18
- pnpm (preferred) or npm
- A browser with good DevTools (Chrome or Firefox)

## Setup

```bash
git clone https://github.com/El-Gato-Consciente/matex.git
cd matex
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

---

## Mental Model: Six Things to Understand First

Before writing any code, read these in order:

1. **`docs/02-architecture/data-model.md`**
   The `.ltxj` format is the persistence format. Every feature interacts with it.
   Note: `.ltxj` is not the runtime state — that lives in ProseMirror + EditorStore signals.

2. **`docs/02-architecture/system-design.md`**
   Three sections are essential before writing any code:
   - **Runtime State vs Persistence** — clarifies where state actually lives at runtime.
   - **Profile vs Manifest** — the most important architectural decision.
   - **Tiptap / Lit Boundary** — the three rules that prevent update loops between the
     two reactive systems. Read this before touching any UI code.

3. **`docs/02-architecture/data-lifecycle.md`**
   The data flow from keystroke to `.tex`. Stage 1 (syncSrc pattern) and Stage 3
   (normalizer receives ResolvedProfile, not EffectiveConfig) are the most important.

4. **`docs/03-engine-specs/article-pro/manifesto.md`**
   The contract the serializer must satisfy. Part A covers the profile; Part C the manifest.

5. **`docs/03-engine-specs/normalization.md`**
   How the normalizer rules work. Read before touching `src/core/math/`.
   `AlignedSteps` and `DisplayThreshold` are `opinionated` — they never auto-apply in
   `mixed` mode.

6. **`formula_demo.html`** (project root)
   The reference implementation for bidirectional MathLive ↔ textarea sync.
   Open in a browser before implementing FormulaPanel. The `syncSrc` pattern here
   is the canonical solution to the feedback loop problem.

---

## Architecture Constraint Checklist

Before submitting any PR, verify:

**Editor / DOM**
- [ ] `<math-field>` never placed inside ProseMirror's DOM (shadow DOM conflict)
- [ ] NodeViews (`MathInlineView`, `MathDisplayView`, `TheoremEnvView`) are vanilla TS — not Lit elements
- [ ] No Lit component imports the Tiptap `editor` object directly — only via `EditorStore`
- [ ] All formula `latex` node attributes contain post-normalization LaTeX only

**Reactive state**
- [ ] New cross-component state is a signal in `EditorStore`, `CoachStore`, or `FormulaStore`
- [ ] No signal reads inside Tiptap NodeViews or inside the math pipeline
- [ ] `.ltxj` is never polled or subscribed to reactively — it is only read on load and written on save

**Serialization**
- [ ] No direct `\ref{}` calls for equations — always `\cref{}` or `\Cref{}`
- [ ] `ResolvedProfile` and `EffectiveConfig` remain plain serializable objects (no methods)

**Specs**
- [ ] New normalizer rules have unit tests covering the false-positive guard
- [ ] New `.ltxj` node types are documented in `docs/02-architecture/data-model.md`
- [ ] New profile fields go in `profile.json`; new output-config fields go in `manifest.json`
- [ ] New profile fields reflected in `profile.json` and `manifesto.md § Part A`
- [ ] New manifest fields reflected in `manifest.json` and `manifesto.md § Part C`

---

## Key Files

```
formula_demo.html                       # reference impl: bidirectional sync
src/core/math/ASTParser.ts              # MathJSON → MathAST
src/core/math/ASTSerializer.ts          # MathAST → canonical LaTeX
src/core/math/normalizer/               # the normalization engine
src/core/linter/SemanticLinter.ts       # post-normalization structural validation
src/core/manifests/ManifestEngine.ts    # resolves profile + manifest → EffectiveConfig
src/core/manifests/profiles/            # profile.json and manifest.json per family
src/core/serializer/TexSerializer.ts    # .ltxj + EffectiveConfig → .tex
src/features/formula-editor/            # FormulaPanel + SymbolPalette
src/features/coach/                     # CoachPanel
src/features/export/                    # TexExporter + ExportOverride
```

---

## Testing

```bash
pnpm test              # all unit tests
pnpm test:normalizer   # normalizer rules only
pnpm test:serializer   # TexSerializer only
pnpm test:linter       # SemanticLinter only
```

Tests for normalizer rules live in `tests/normalizer/`. Each rule has its own file.
The rule spec in `docs/03-engine-specs/normalization.md` is the source of truth —
if a test fails, check whether the spec or the implementation is wrong.
