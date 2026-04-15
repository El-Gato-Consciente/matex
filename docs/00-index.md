# Formalia — Master Index

> This is the executive index of the Formalia documentation.
> It does not contain implementation details — it links to them.
> Read this first; follow links to go deeper.

---

## What Formalia Is

A **mathematical writing environment** — not another LaTeX editor.
The user works from mathematical intention; the system produces canonical,
typographically impeccable LaTeX. Three audiences, one tool:

- **Beginners** — visual editing via MathLive, no syntax friction
- **Intermediates** — mixed mode: type LaTeX, see it render in-situ
- **Experts** — full LaTeX control with the normalizer acting as a linter

---

## Documents by Layer

### Layer 0 — Vision
| File | What it answers |
|---|---|
| [`01-vision/roadmap.md`](01-vision/roadmap.md) | What are we building and in what order? |

### Layer 1 — Architecture
| File | What it answers |
|---|---|
| [`02-architecture/system-design.md`](02-architecture/system-design.md) | How do the pieces connect? What is the stack? |
| [`02-architecture/data-model.md`](02-architecture/data-model.md) | What is the `.ltxj` format? Every node type. |
| [`02-architecture/data-lifecycle.md`](02-architecture/data-lifecycle.md) | What happens between a keystroke and a `.tex` file? |
| [`02-architecture/glossary.md`](02-architecture/glossary.md) | What does each term mean in this codebase? |

### Layer 2 — Engine Specs
| File | What it answers |
|---|---|
| [`03-engine-specs/article-pro/manifesto.md`](03-engine-specs/article-pro/manifesto.md) | What does the system guarantee to produce? (human-readable) |
| [`03-engine-specs/article-pro/profile.json`](03-engine-specs/article-pro/profile.json) | Same contract, machine-readable (loaded at runtime) |
| [`03-engine-specs/normalization.md`](03-engine-specs/normalization.md) | What does each normalizer rule do? |
| [`03-engine-specs/normalization-rules.json`](03-engine-specs/normalization-rules.json) | Same rules, machine-readable |

### Layer 3 — Development
| File | What it answers |
|---|---|
| [`04-development/onboarding.md`](04-development/onboarding.md) | How do I get running? What do I read first? |
| [`04-development/contribution.md`](04-development/contribution.md) | How do I contribute? What are the standards? |

---

## Key Design Decisions (and why)

**`<math-field>` never lives inside ProseMirror's DOM.**
Shadow DOM conflicts with ProseMirror event handling. Formula editing always
happens in the top toolbar, outside the editor canvas.
→ `02-architecture/system-design.md § Key Architectural Constraints`

**The AST, not the LaTeX string, is the source of truth for normalization.**
String manipulation is fragile. The normalizer operates on typed tree nodes.
This makes rules testable, composable, and portable to non-web environments.
→ `03-engine-specs/normalization.md`

**`cleveref` must load last.**
Loading it before `\newtheorem` declarations causes silent mis-labelling.
The serializer enforces the load order defined in `profile.json → packages.loadOrder`.
→ `03-engine-specs/article-pro/manifesto.md § C.1`

**`syncSrc` with three states, not a boolean.**
A boolean lock for MathLive ↔ textarea sync creates race conditions because
`mf.selection = ...` fires `selection-change` synchronously before the lock releases.
Three states with `requestAnimationFrame` release solves this cleanly.
→ `02-architecture/data-lifecycle.md § Stage 1`, `formula_demo.html`

---

## Stack Summary

```
Vite + TypeScript        build
Tiptap v2                rich text editor (ProseMirror-based)
MathLive                 visual math input (<math-field>)
KaTeX                    math rendering (in-situ + output)
CSS custom properties    design tokens, no UI framework
```

---

## Non-Decisions (deliberately deferred)

- **UX copy / Coach Panel tone** — defined after first usability test
- **PDF compilation** — `IPdfService` interface defined; implementation in Phase 4
- **Google Drive sync** — `IStorageAdapter` interface defined; implementation in Phase 4
- **Mobile layout** — Phase 2+ after desktop is stable

---

*If a detail is not here, it is in one of the linked documents.
If a detail is not in any document, it should be added before being implemented.*
