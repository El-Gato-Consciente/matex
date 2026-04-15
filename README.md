# Formalia

> **A mathematical writing environment — not another LaTeX editor.**

Formalia is a **compiler of mathematical intent**. Instead of treating LaTeX as the primary interface, Formalia lets users express structure and meaning first, then produces **canonical, typographically clean LaTeX** as output.

It is designed for people who already work with mathematical writing and want a more semantic, consistent, and fluid workflow.

---

## What Formalia Is

Formalia is not a generic rich-text editor and not a cloud LaTeX IDE.

It is a **mathematical writing system** built around four core ideas:

1. **MathLive as the primary input surface**  
   Structured visual math editing with minimal syntax friction.

2. **AST as the source of truth**  
   Documents are modeled as semantic trees, not raw strings.

3. **Typographic normalization**  
   A deterministic formatter cleans and standardizes math and document structure.

4. **Templates as semantic structures**  
   Templates capture writing intent: proof, derivation, homework, notes, article, and more.

---

## Why This Exists

Most LaTeX tools focus on one of two extremes:

- pure code editing, which is powerful but fragile and syntactically heavy
- visual editors, which are more approachable but often lose semantic precision

Formalia aims to bridge that gap.

The goal is simple:

> Users should think about mathematics, not syntax.

---

## Core Principles

### 1. Semantic-first
The document is represented as structured data.  
This makes normalization, validation, export, and future expansion possible without relying on fragile string manipulation.

### 2. LaTeX-first
The initial scope is deliberately LaTeX-centered.  
That keeps the system grounded in a real academic workflow and avoids expanding too early into formats that would dilute the core problem.

### 3. STEM-first
Formalia currently targets mathematics, physics, computer science, and economics.  
This is a focused constraint, not a permanent limitation.

### 4. Transparent automation
Normalization should feel helpful, not hidden.  
Users should be able to understand what changed and why.

---

## Product Vision

Formalia is a **mathematical writing environment** that works from intention to output.

The workflow is:

```text
User intent
→ structured editing
→ AST
→ normalization
→ semantic validation
→ canonical LaTeX
```

The long-term vision is to make mathematical writing feel closer to thinking and less like hand-authoring code.

---

## Project Roadmap

### Phase 1 — Core & Mathematical Pipeline
- Vite + TypeScript setup
- MathLive-based formula input
- Tiptap nodes for text and math
- AST parser and serializer
- Basic normalization rules
- `.tex` export
- Local persistence

### Phase 2 — Visual Mode, Normalization & Templates
- Bidirectional sync between MathLive, textarea, and editor
- Full normalization engine
- Coach panel with suggestions
- Template system
- Manifest/profile resolution
- Cross references and numbering

### Phase 3 — Round-Trip & Robustness
- `.tex` import
- Semantic linter
- Accessibility improvements
- Large-document support
- Unit tests for core subsystems

### Phase 4 — Production & Expansion
- PDF preview and export
- Authentication and sharing
- Cloud storage integration
- Possible expansion into:
  - more STEM domains
  - non-LaTeX outputs such as HTML or DOCX

---

## Architecture Overview

```text
Input surfaces
(MathLive / textarea / editor)
        ↓
Semantic document model (AST)
        ↓
Normalization engine
        ↓
Semantic linter
        ↓
Serializer
        ↓
Canonical LaTeX output
```

### Key Architectural Ideas

- **Profile** defines what a document is
- **Manifest** defines how it is exported
- **AST** is the source of truth
- **Normalization** operates on typed nodes, not on raw text
- **MathLive** stays outside the editor DOM to avoid ProseMirror conflicts

---

## Tech Stack

- **Vite**
- **TypeScript**
- **Tiptap / ProseMirror**
- **MathLive**
- **KaTeX**
- **CSS custom properties** for design tokens

---

## Repository Structure

```text
.
├── 00-index.md
├── 01-vision/
├── 02-architecture/
├── 03-engine-specs/
├── 04-development/
├── demos-mockups-ux-ui/
└── README.md
```

### Start Here
- `00-index.md` — master navigation
- `01-vision/roadmap.md` — product direction
- `02-architecture/system-design.md` — architecture decisions
- `03-engine-specs/` — engine-level specifications

---

## Who This Is For

### Beginners
Users who want visual math editing without learning LaTeX syntax first.

### Intermediate users
Users who want a mixed workflow: type, render, inspect, and normalize.

### Advanced users
Users who want full LaTeX control, but with semantic validation and formatting assistance.

---

## Current Focus

The project is currently centered on:

- defining the document model
- validating the normalization pipeline
- refining the semantic template system
- keeping the architecture clean enough to scale later

---

## Non-Goals for Now

These are intentionally deferred:

- Word or HTML export before the LaTeX core is stable
- Mobile-first optimization before desktop workflows are validated
- Broad humanities expansion before non-LaTeX output is justified
- Overly early feature sprawl

---

## Design Decisions Worth Keeping

- **The AST, not the string, is the truth**
- **Normalization should be deterministic**
- **Templates should encode intent, not just layout**
- **Export should be reproducible**
- **The system should reward structure instead of hiding it**

---

## Contributing

This project is still in a design-heavy stage.  
When contributing, prefer:

- semantic clarity over ad hoc behavior
- small, testable rules over large opaque transformations
- explicit architecture over implicit coupling

If you are adding a new feature, start by checking whether it belongs in:
- the document model
- the normalization layer
- the serializer
- the template/profile/manifest system

---

## Future Directions

Possible future directions include:

- PDF generation
- collaborative editing
- plugin architecture
- domain-specific templates
- expansion to more document types
- non-LaTeX serialization targets

These should be added only when the core math-writing experience is proven strong.

---

## License

To be decided.

---

## Short Version

Formalia is a semantic writing environment for mathematics and STEM documents.

It helps users write from intent, normalizes structure, and exports high-quality LaTeX.

---

## Acknowledgements

This project is being built around a simple idea:

> mathematical writing should feel structured, precise, and natural.

