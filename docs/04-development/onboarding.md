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

## Mental Model: Five Things to Understand First

Before writing any code, read these files in order:

1. **`docs/02-architecture/data-model.md`** — the `.ltxj` format is the central abstraction. Every feature interacts with it.
2. **`docs/02-architecture/system-design.md`** — the data flow from keystroke to `.tex`. The `syncSrc` flag pattern is the most important implementation detail.
3. **`docs/03-engine-specs/article-pro/manifesto.md`** — what the system promises to produce. The machine spec for the serializer and normalizer.
4. **`docs/03-engine-specs/normalization.md`** — how the normalizer rules work. Read before touching `src/core/math/`.
5. **`formula_demo.html`** — the reference implementation for bidirectional MathLive ↔ textarea sync. Open it in a browser before implementing the FormulaPanel.

---

## Architecture Constraint Checklist

Before submitting any PR, verify:

- [ ] `<math-field>` never placed inside ProseMirror's DOM (causes event conflicts)
- [ ] All formula `latex` node attributes contain post-normalization LaTeX only
- [ ] No direct `\ref{}` calls for equations — always `\cref{}` or `\Cref{}`
- [ ] New normalizer rules have unit tests covering the false-positive guard
- [ ] New `.ltxj` node types are documented in `docs/02-architecture/data-model.md`
- [ ] New profile fields are reflected in both `profile.json` and `manifesto.md`

---

## Key Files

```
formula_demo.html              # reference impl: bidirectional sync
src/core/math/ASTParser.ts     # MathJSON → MathAST
src/core/math/ASTSerializer.ts # MathAST → canonical LaTeX
src/core/math/normalizer/      # the normalization engine
src/core/manifests/            # ManifestEngine + profiles
src/features/formula-editor/   # FormulaPanel + SymbolPalette
src/features/coach/            # CoachPanel
```

---

## Testing

```bash
pnpm test              # all unit tests
pnpm test:normalizer   # normalizer rules only
pnpm test:serializer   # TexSerializer only
```

Tests for normalizer rules live in `tests/normalizer/`. Each rule has its own file.
The rule spec in `docs/03-engine-specs/normalization.md` is the source of truth —
if a test fails, check whether the spec or the implementation is wrong.
