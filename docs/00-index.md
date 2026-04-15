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

### Layer -1 — UX / UI Demos
| File | What it shows |
|---|---|
| [`demos-mockups-ux-ui/formalia_mockup.html`](demos-mockups-ux-ui/formalia_mockup.html) | Full editor layout mockup (v1) |
| [`demos-mockups-ux-ui/formalia_workspace.html`](demos-mockups-ux-ui/formalia_workspace.html) | Editor workspace mockup |
| [`demos-mockups-ux-ui/formalia_onboarding.html`](demos-mockups-ux-ui/formalia_onboarding.html) | Onboarding flow mockup |
| [`demos-mockups-ux-ui/formalia_doc_switcher.html`](demos-mockups-ux-ui/formalia_doc_switcher.html) | Document switcher UI mockup |

Open in browser. These are static HTML prototypes — no build step required.

### Layer 0 — Vision
| File | What it answers |
|---|---|
| [`01-vision/roadmap.md`](01-vision/roadmap.md) | What are we building and in what order? |

### Layer 1 — Architecture
| File | What it answers |
|---|---|
| [`02-architecture/system-design.md`](02-architecture/system-design.md) | How do the pieces connect? What is the stack? What is the Profile/Manifest split? |
| [`02-architecture/data-model.md`](02-architecture/data-model.md) | What is the `.ltxj` format? Every node type. |
| [`02-architecture/data-lifecycle.md`](02-architecture/data-lifecycle.md) | What happens between a keystroke and a `.tex` file? |
| [`02-architecture/glossary.md`](02-architecture/glossary.md) | What does each term mean in this codebase? |

### Layer 2 — Engine Specs
| File | What it answers |
|---|---|
| [`03-engine-specs/article-pro/manifesto.md`](03-engine-specs/article-pro/manifesto.md) | Full human-readable spec for the article-pro family (profile + manifest) |
| [`03-engine-specs/article-pro/profile.json`](03-engine-specs/article-pro/profile.json) | Document schema + normalization policy (machine-readable) |
| [`03-engine-specs/article-pro/manifest.json`](03-engine-specs/article-pro/manifest.json) | Serialization contract: packages, geometry, styles (machine-readable) |
| [`03-engine-specs/article-base/profile.json`](03-engine-specs/article-base/profile.json) | Base profile that article-pro extends |
| [`03-engine-specs/normalization.md`](03-engine-specs/normalization.md) | What does each normalizer rule do? |
| [`03-engine-specs/normalization-rules.json`](03-engine-specs/normalization-rules.json) | Same rules, machine-readable |
| [`03-engine-specs/semantic-linter.md`](03-engine-specs/semantic-linter.md) | What does the SemanticLinter validate? All error and warning codes. |
| [`03-engine-specs/export-override.md`](03-engine-specs/export-override.md) | How to patch a manifest for a single export without creating a new profile. |

### Layer 3 — Development
| File | What it answers |
|---|---|
| [`04-development/onboarding.md`](04-development/onboarding.md) | How do I get running? What do I read first? |
| [`04-development/contribution.md`](04-development/contribution.md) | How do I contribute? What are the standards? |

---

## Key Design Decisions (and why)

**Profile and Manifest are two distinct artifacts.**
The `profile.json` defines what a `.ltxj` document *is* (schema, normalizer rules, macros).
The `manifest.json` defines how it *becomes* `.tex` (packages, geometry, environment styles).
`ManifestEngine` merges them into an `EffectiveConfig` at export time.
→ `02-architecture/system-design.md § Profile vs Manifest`

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
The serializer enforces the load order defined in `manifest.json → packages.loadOrder`.
→ `03-engine-specs/article-pro/manifesto.md § C.1`

**`syncSrc` with three states, not a boolean.**
A boolean lock for MathLive ↔ textarea sync creates race conditions because
`mf.selection = ...` fires `selection-change` synchronously before the lock releases.
Three states with `requestAnimationFrame` release solves this cleanly.
→ `02-architecture/data-lifecycle.md § Stage 1`, `formula_demo.html`

**`AlignedSteps` severity is `opinionated`, not `preferred`.**
`preferred` rules auto-apply in `mixed` mode. `AlignedSteps` never auto-applies
in `mixed` mode — it is always a suggestion. The `opinionated` severity is consistent
with this behavior. Any rule that never auto-applies in `mixed` mode must be `opinionated`.
→ `03-engine-specs/normalization.md § AlignedSteps`

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

## Scope: LaTeX-First, STEM-First

Formalia currently targets academics who use LaTeX: mathematics, physics, CS, economics.
This is a deliberate constraint documented in the roadmap.

The `.ltxj` format and the Profile/Manifest split are designed to support non-LaTeX
output and non-math domains in the future — but no non-LaTeX manifest will be built
until the math LaTeX core is mature.

Two expansion directions are possible after Phase 4; neither is pre-committed:
- **Direction A** — more domains, same LaTeX output (new profiles + domain nodes)
- **Direction B** — same domain, more output formats (new manifests, non-LaTeX serializers)

→ `01-vision/roadmap.md § Scope Decision`

---

## Non-Decisions (deliberately deferred)

- **UX copy / Coach Panel tone** — defined after first usability test
- **PDF compilation** — `IPdfService` interface defined; implementation in Phase 4
- **Google Drive sync** — `IStorageAdapter` interface defined; implementation in Phase 4
- **Mobile layout** — Phase 2+ after desktop is stable
- **Direction A vs B** — decided based on observed user demand after Phase 3

---

*If a detail is not here, it is in one of the linked documents.
If a detail is not in any document, it should be added before being implemented.*
