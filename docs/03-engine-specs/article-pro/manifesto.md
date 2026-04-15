# Formalia Manifesto — `article-pro`
## Human-readable companion to `profile.json` and `manifest.json`

> **Type:** System specification — not a user guide.
> **Audience:** Developers implementing `ManifestEngine`, `Normalizer`, `TexSerializer`, `SemanticLinter`.
> **Machine-readable equivalents:**
>   - Schema + normalization policy → [`profile.json`](profile.json)
>   - Serialization contract → [`manifest.json`](manifest.json)
> **Version:** 1.0

---

## Conceptual Overview

A document in Formalia has two distinct concerns encoded as two distinct artifacts:

```
profile.json   — "what this document IS"
                 Schema of valid nodes, environments, macros.
                 Normalizer rules and mode.
                 → Used by: ManifestEngine, Normalizer, SemanticLinter

manifest.json  — "how this document BECOMES LaTeX"
                 Package list, load order, geometry, cleveref config.
                 Environment styles (\theoremstyle) for preamble generation.
                 → Used by: ManifestEngine, TexSerializer
```

The `ManifestEngine` resolves both into a single `EffectiveConfig` object that
the pipeline uses at runtime. Neither file is ever modified at runtime.

```
profile.json  ──┐
                ├──  ManifestEngine.buildEffectiveConfig()  ──→  EffectiveConfig
manifest.json ──┘                                                  │
                                                      ┌────────────┴──────────────┐
                                                      ▼                           ▼
                                                  Normalizer               TexSerializer
```

---

# PART A — Profile Specification

> Machine-readable: [`profile.json`](profile.json)

## A.1 Profile Metadata

```json
{
  "id":             "article-pro",
  "displayName":    "Article — Professional",
  "documentClass":  "article",
  "classOptions":   ["12pt", "a4paper"],
  "extends":        "article-base",
  "normalizerMode": "mixed",
  "description":    "University-level mathematical documents: homework, proofs, notes.",
  "tags":           ["mathematics", "university", "exercises", "proofs"]
}
```

**Inheritance:** `article-pro` extends `article-base`. The `ManifestEngine` resolves
the chain and returns a flat `ResolvedProfile`. Fields in `article-pro` override
`article-base` when they conflict.

## A.2 Supported Node Types

The `ManifestEngine` validates every node in the `.ltxj` AST against this list.
Unsupported nodes are wrapped in a `rawLatex` node and passed through unchanged.

### A.2.1 Block nodes

| `.ltxj` type  | LaTeX output                      | Notes |
|---|---|---|
| `paragraph`   | plain text paragraph              | |
| `heading`     | `\section{}` etc.                 | levels 1–3 only |
| `mathDisplay` | `\[…\]` / `equation` / `align*`  | see A.3 |
| `theoremEnv`  | `\begin{theorem}…`                | see A.4 |
| `bulletList`  | `\begin{itemize}…`                | |
| `orderedList` | `\begin{enumerate}…`             | |
| `blockquote`  | `\begin{quote}…`                  | |
| `rawLatex`    | verbatim passthrough              | no normalization applied |

### A.2.2 Inline nodes

| `.ltxj` type | LaTeX output          | Notes |
|---|---|---|
| `mathInline` | `$…$`                 | |
| `crossRef`   | `\cref{}` / `\Cref{}` | auto-case; see §C.6 |
| `text`       | plain text            | marks: bold, italic, code |
| `hardBreak`  | `\\`                  | |

### A.2.3 Unsupported (→ `rawLatex`)

`tikzFigure`, `table`, `figure`, `algorithm`, `listing`, `bibliography`, `citation`.
The serializer wraps them with a comment: `% [formalia:raw — unsupported node type]`.

## A.3 `mathDisplay` Node Schema

```typescript
interface MathDisplayNode {
  type:     "mathDisplay"
  latex:    string       // canonical LaTeX (post-normalization)
  numbered: boolean
  aligned:  boolean
  label:    string       // "" if unnumbered; "eq:name" if numbered
}
```

| `numbered` | `aligned` | Output environment |
|---|---|---|
| false | false | `\[…\]` |
| true  | false | `\begin{equation}\label{eq:X}…\end{equation}` |
| false | true  | `\begin{align*}…\end{align*}` |
| true  | true  | `\begin{align}…\label{eq:X}\end{align}` |

## A.4 `theoremEnv` Node Schema

```typescript
interface TheoremEnvNode {
  type:     "theoremEnv"
  envType:  TheoremEnvType
  envTitle: string   // optional; → \begin{theorem}[title]
  label:    string   // "" if unreferenced; "thm:name" if labelled
  content:  BlockNode[]
}

type TheoremEnvType =
  | "theorem" | "lemma" | "proposition" | "corollary"
  | "definition" | "remark" | "example" | "note"
  | "exercise" | "proof"
```

## A.5 Environment Counter Configuration

```json
{
  "sharedCounter": {
    "base": "definition",
    "members": ["theorem", "lemma", "proposition", "corollary",
                "remark", "example", "note"]
  },
  "independentCounters": {
    "definition": { "resetBy": "section" },
    "exercise":   { "resetBy": "section" }
  }
}
```

`definition` establishes the base counter. All members share it. `exercise` has
its own counter. This structure drives the `\newtheorem` declaration order in the
serializer (see §C.5).

## A.6 Macro Registry

The following macros are registered in `profile.json → macros`. They serve two roles:

1. **Normalization:** The `MacroExpansion` rule scans for expanded forms (e.g. `\mathbb{R}`)
   and replaces them with the shorthand (`\R`). This mapping is read from the profile.
2. **Serialization:** The `TexSerializer` injects `\newcommand` definitions in the preamble
   (see §C.4). The same map is used — no duplication between profile and manifest.

```json
{
  "\\R":     "\\mathbb{R}",
  "\\Q":     "\\mathbb{Q}",
  "\\Z":     "\\mathbb{Z}",
  "\\N":     "\\mathbb{N}",
  "\\C":     "\\mathbb{C}",
  "\\K":     "\\mathbb{K}",
  "\\abs":   "\\left\\lvert #1 \\right\\rvert",
  "\\norm":  "\\left\\lVert #1 \\right\\rVert",
  "\\inner": "\\left\\langle #1, #2 \\right\\rangle"
}
```

Math operators (`\rk`, `\tr`, `\im`, `\Ker`) are in `profile.json → mathOperators`.

---

# PART B — Normalization Engine

> Full rule specification: [`../normalization.md`](../normalization.md)
> Machine-readable: [`../normalization-rules.json`](../normalization-rules.json)

## B.1 Global Normalization Mode

Default for this profile: `"mixed"`. User can override globally or per export.

| Mode | `required` rules | `preferred` rules | `opinionated` rules |
|---|---|---|---|
| `strict`     | auto-apply | auto-apply | auto-apply |
| `mixed`      | auto-apply | auto-apply | suggest only |
| `suggestion` | suggest only | suggest only | suggest only |

## B.2 Rule Execution Order

Rules run in this fixed order. `MacroExpansion` must precede `AutoDelimiters`
so that `\mathbb{R}` is already `\R` when delimiter checking occurs.

```
1. ForbiddenSyntax    required    — blocks pipeline if E001/E002/E003 found
2. MacroExpansion     required    — \mathbb{R} → \R
3. AutoDelimiters     required    — (\frac{}{}) → \left(\right)
4. DxSpacing          required    — integral dx → \,dx
5. TextInMath         preferred   — plain text in math → \text{}
6. AlignedSteps       opinionated — suggest align* for multi-step derivations
7. DisplayThreshold   opinionated — suggest display for complex inline formulas
```

## B.3 Rule Summaries

| Rule | Severity | Trigger | Example |
|---|---|---|---|
| `ForbiddenSyntax` | required | `$$`, `{\bf}`, `\eqnarray` | → linter errors E001–E003 |
| `MacroExpansion` | required | `\mathbb{R}` when `\R` is registered | `\mathbb{R}` → `\R` |
| `AutoDelimiters` | required | `(` around `\frac`, `\sum` with limits, etc. | `(\frac{a}{b})` → `\left(\frac{a}{b}\right)` |
| `DxSpacing` | required | integral differential without `\,` | `\int f dx` → `\int f\,dx` |
| `TextInMath` | preferred | multi-char alphabetic sequence in math | `para todo` → `\text{para todo}` |
| `AlignedSteps` | opinionated | non-aligned display with multiple `=` lines | suggests `align*` |
| `DisplayThreshold` | opinionated | inline `\int`/`\sum` with limits | suggests display mode |

Full spec for each rule: [`../normalization.md`](../normalization.md).

---

# PART C — Manifest / Serialization Contract

> Machine-readable: [`manifest.json`](manifest.json)

## C.1 Package Load Order (mandatory, deterministic)

Defined in `manifest.json → packages.loadOrder`. The `TexSerializer` follows this
order exactly. Deviating causes known compilation failures.

```latex
% ── Group 1: encoding & language ──────────────────────────────
\usepackage[utf8]{inputenc}       % pdfLaTeX only
\usepackage[T1]{fontenc}          % pdfLaTeX only
\usepackage{lmodern}
\usepackage[LANG]{babel}          % LANG from document metadata
\usepackage{csquotes}             % MUST follow babel

% ── Group 2: mathematics ───────────────────────────────────────
\usepackage{amsmath, amssymb, amsthm, mathtools}

% ── Group 3: layout & typography ───────────────────────────────
\usepackage{geometry}
\usepackage{microtype}
\usepackage{fancyhdr}             % if header metadata present
\usepackage{enumitem}
\usepackage{booktabs}

% ── Group 4: color & graphics (optional) ───────────────────────
\usepackage{xcolor}
\usepackage{graphicx}             % only if document contains figures
\usepackage{tikz}                 % only if document contains tikz nodes

% ── Group 5: links & PDF metadata ──────────────────────────────
\usepackage{xurl}                 % MUST precede hyperref
\usepackage{hyperref}
\usepackage{bookmark}             % MUST follow hyperref

% ── Group 6: cross-references ──────────────────────────────────
\usepackage{cleveref}             % MUST be LAST — after hyperref, bookmark,
                                  % and ALL \newtheorem declarations
```

## C.2 `\hypersetup` Block

```latex
\hypersetup{
  colorlinks        = true,
  linkcolor         = blue!70!black,
  urlcolor          = blue!70!black,
  citecolor         = green!50!black,
  bookmarks         = true,
  bookmarksnumbered = true,
  pdftitle          = {TITLE},
  pdfauthor         = {AUTHOR},
  pdfsubject        = {SUBJECT},
  pdfkeywords       = {LaTeX, mathematics}
}
```

## C.3 `\geometry` Block

Defined in `manifest.json → geometry`:

```latex
\geometry{left=2.5cm, right=2.5cm, top=2.5cm, bottom=2.5cm}
```

Override per-export via `ExportOverride.geometry`. See [`../export-override.md`](../export-override.md).

## C.4 Macro and Operator Injection

Read from `profile.json → macros` and `profile.json → mathOperators`.
The serializer reads these from the profile, not from the manifest.

```latex
\newcommand{\R}{\mathbb{R}}
\newcommand{\Q}{\mathbb{Q}}
\newcommand{\Z}{\mathbb{Z}}
\newcommand{\N}{\mathbb{N}}
\newcommand{\C}{\mathbb{C}}
\newcommand{\K}{\mathbb{K}}
\newcommand{\abs}[1]{\left\lvert #1 \right\rvert}
\newcommand{\norm}[1]{\left\lVert #1 \right\rVert}
\newcommand{\inner}[2]{\left\langle #1, #2 \right\rangle}

\DeclareMathOperator{\rk}{rk}
\DeclareMathOperator{\tr}{tr}
\DeclareMathOperator{\im}{Im}
\DeclareMathOperator{\Ker}{Ker}
```

## C.5 `\newtheorem` Injection (order-sensitive)

Driven by `profile.json → environments` (counter config) and
`manifest.json → environmentStyles` (LaTeX style per environment).
`definition` must be declared first as the base counter.

```latex
\theoremstyle{definition}
\newtheorem{definition}{Definition}[section]

\theoremstyle{plain}
\newtheorem{theorem}[definition]{Theorem}
\newtheorem{lemma}[definition]{Lemma}
\newtheorem{proposition}[definition]{Proposition}
\newtheorem{corollary}[definition]{Corollary}

\theoremstyle{remark}
\newtheorem{remark}[definition]{Remark}
\newtheorem{example}[definition]{Example}
\newtheorem{note}[definition]{Note}

\newtheorem{exercise}{Exercise}[section]

% cleveref is loaded AFTER this block (see C.1)
```

## C.6 `crossRef` Node → LaTeX

The serializer chooses `\cref{}` or `\Cref{}` based on `position`:

```
crossRef { refId: "thm:bolzano", position: "mid"   } → \cref{thm:bolzano}
crossRef { refId: "thm:bolzano", position: "start" } → \Cref{thm:bolzano}
```

> **Why `\cref` for equations (not `\eqref`):** `cleveref` subsumes `\eqref`.
> `\cref{eq:X}` produces "equation (3)" — equivalent output, single API.

**Spanish-locale `cleveref` config** (injected when `babel` lang is `spanish`):

```latex
\crefname{theorem}{Teorema}{Teoremas}
\crefname{definition}{Definición}{Definiciones}
\crefname{lemma}{Lema}{Lemas}
\crefname{proposition}{Proposición}{Proposiciones}
\crefname{corollary}{Corolario}{Corolarios}
\crefname{exercise}{Ejercicio}{Ejercicios}
\crefname{equation}{ecuación}{ecuaciones}
\Crefname{theorem}{Teorema}{Teoremas}
\Crefname{equation}{Ecuación}{Ecuaciones}
```

Locale config is defined in `manifest.json → cleveref`.

## C.7 AST Node → LaTeX Mapping

### Block nodes

```
paragraph          → inline content + blank line
heading level 1    → %==…==\n\section{CONTENT}\n%==…==
heading level 2    → \subsection{CONTENT}
heading level 3    → \subsubsection{CONTENT}   % rare
mathDisplay        → see A.3 table
theoremEnv         → \begin{ENV}[TITLE]\n  \label{LBL}\n  CONTENT\n\end{ENV}
bulletList         → \begin{itemize}\n  \item …\n\end{itemize}
orderedList        → \begin{enumerate}[label=\arabic*.]\n  \item …\n\end{enumerate}
blockquote         → \begin{quote}\n  CONTENT\n\end{quote}
rawLatex           → CONTENT  % verbatim, no normalization
```

### Inline nodes

```
mathInline         → $LATEX$
crossRef           → \cref{ID} or \Cref{ID}  (see C.6)
text (bold)        → \textbf{CONTENT}
text (italic)      → \textit{CONTENT}
text (code)        → \texttt{CONTENT}
text (quote)       → \enquote{CONTENT}        % via csquotes
hardBreak          → \\
```

### Special content patterns

**Piecewise function** (within `mathDisplay`):
```latex
f(x) = \begin{cases}
  \dfrac{\sin(x)}{x} & \text{if } x \neq 0 \\[0.3cm]
  1                  & \text{if } x = 0
\end{cases}
```
Rule: `\dfrac` (not `\frac`) inside `cases`. `\\[0.3cm]` between rows with fractions.

**Aligned derivation** (within `mathDisplay` with `aligned: true`):
```latex
\begin{align*}
  expression &= step 1 \\
             &= step 2 && \text{(justification)} \\
             &= result
\end{align*}
```
Rule: no `\\` on the last line. `&&` for marginal justifications.

## C.8 Output Formatter Rules

1. **Indent** 2 spaces inside every `\begin{}`/`\end{}` pair.
2. **Section separators:** inject `%==…==` comment blocks above every `\section{}`.
3. **Blank line** before and after every display environment.
4. **No trailing `\\`** on the last line of `align*`, `cases`, or table rows.
5. **Comment non-obvious decisions** with `% [formalia: reason]` annotations.

---

# PART D — System Guarantees

> Full spec: [`../semantic-linter.md`](../semantic-linter.md)

## D.1 Serializer Invariants (hard blocks)

The `SemanticLinter` surfaces these as blocking errors. The `TexSerializer` refuses
to produce output if any of them hold.

| Invariant | Linter error |
|---|---|
| `$$…$$` in AST math content | `E001: forbidden-display-syntax` |
| `{\bf …}` or `{\it …}` | `E002: obsolete-font-command` |
| `\eqnarray` | `E003: forbidden-environment` |
| `crossRef` with no matching `\label` in document | `E004: orphan-cross-reference` |
| `proof` with no preceding theorem in scope | `E005: proof-without-theorem` |

## D.2 Normalizer Guarantees (post-pipeline)

After the Normalizer runs in any mode, the output AST is guaranteed to satisfy:

| Guarantee | Enforced by |
|---|---|
| All `\mathbb{X}` replaced by registered macros | `MacroExpansion` |
| All integral differentials preceded by `\,` | `DxSpacing` |
| All delimiters around `\frac`/`\sum`/`\int` are `\left…\right` | `AutoDelimiters` |
| No bare `\ref{}` for equations — always `\cref{}` | Output Formatter |

## D.3 Warnings (non-blocking)

| Condition | Warning |
|---|---|
| Multi-word text in math without `\text{}` | `W001` |
| `mathDisplay` with multiple `=` without `align*` | `W002` |
| `mathInline` with `\int`/`\sum` with limits | `W003` |
| Heading level 3 used | `W004` |
| Document > 2 pages without `\tableofcontents` | `W005` |

---

# APPENDIX — Reference Templates

## E.1 Homework Template Output

```latex
\documentclass[12pt, a4paper]{article}

\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[english]{babel}
\usepackage{csquotes}
\usepackage{amsmath, amssymb, amsthm, mathtools}
\usepackage{geometry}
\usepackage{fancyhdr}
\usepackage{enumitem}
\usepackage{booktabs}
\usepackage{microtype}
\usepackage{xurl}
\usepackage{hyperref}
\usepackage{bookmark}
\usepackage{cleveref}

\geometry{left=2.5cm, right=2.5cm, top=2.5cm, bottom=2.5cm}
\pagestyle{fancy}
\fancyhf{}
\lhead{Subject}
\rhead{Homework \#X}
\cfoot{\thepage}
\renewcommand{\headrulewidth}{0.4pt}

\hypersetup{
  colorlinks=true, linkcolor=blue!70!black,
  urlcolor=blue!70!black, bookmarksnumbered=true,
  pdftitle={Subject --- Homework \#X}, pdfauthor={Name}
}

\newcommand{\R}{\mathbb{R}}
\newcommand{\Q}{\mathbb{Q}}
\newcommand{\Z}{\mathbb{Z}}
\newcommand{\N}{\mathbb{N}}
\newcommand{\C}{\mathbb{C}}
\newcommand{\abs}[1]{\left\lvert #1 \right\rvert}
\newcommand{\norm}[1]{\left\lVert #1 \right\rVert}

\theoremstyle{definition}
\newtheorem{exercise}{Exercise}[section]

\title{\textbf{Subject --- Homework \#X}\\[0.2cm]\large Topic}
\author{Name --- Student ID: XXXXX}
\date{\today}

\begin{document}
\maketitle

%==============================================================
\section{Exercise 1}
%==============================================================

\begin{exercise}
  \label{ex:1}
  Statement.
\end{exercise}

\subsection*{Solution}
Development\ldots

\end{document}
```

## E.2 Proof Submission Template Output

```latex
% [formalia: same preamble as E.1 — full theorem suite]

\theoremstyle{definition}
\newtheorem{definition}{Definition}[section]

\theoremstyle{plain}
\newtheorem{theorem}[definition]{Theorem}
\newtheorem{lemma}[definition]{Lemma}
\newtheorem{proposition}[definition]{Proposition}
\newtheorem{corollary}[definition]{Corollary}

\theoremstyle{remark}
\newtheorem{remark}[definition]{Remark}
\newtheorem{example}[definition]{Example}

% cleveref already loaded last in preamble (see C.1)

\begin{theorem}[Bolzano]
  \label{thm:bolzano}
  Let $f \in C([a,b])$ with $f(a) \cdot f(b) < 0$.
  Then there exists $c \in (a,b)$ such that $f(c) = 0$.
\end{theorem}

\begin{proof}
  By the intermediate value theorem applied to $f$ on $[a,b]$.
  \begin{align*}
    f(a) &< 0 \\
    f(b) &> 0 && \text{(hypothesis)}
  \end{align*}
  Therefore \cref{thm:bolzano} holds.
\end{proof}

\begin{corollary}
  \label{cor:roots}
  As a consequence of \cref{thm:bolzano}, every odd-degree polynomial
  has at least one real root.
\end{corollary}
```

---

*This manifesto is the human-readable companion to `profile.json` and `manifest.json`
for the `article-pro` document family. If a detail here contradicts those JSON files,
the JSON files are authoritative. If a detail is missing from both, add it to the JSON
first, then update this document.*
