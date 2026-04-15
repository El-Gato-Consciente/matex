# Formalia Manifesto — `article-pro`
## Machine Specification for ManifestEngine, Normalizer, and TexSerializer

> **Type:** System specification — not a human guide.  
> **Audience:** `ManifestEngine`, `Normalizer`, `TexSerializer`, `SemanticLinter`.  
> **Format governed:** `.ltxj` (Formalia AST) → `.tex` (LaTeX canonical output).  
> **Corresponds to:** `profile.json` id `"article-pro"`.  
> **Version:** 1.0

---

## 0. Document Contract

This manifesto is the authoritative contract between the Formalia editor and the
LaTeX output pipeline. Every rule here has a deterministic implementation target.
There is no ambiguity resolution layer — the AST is the ground truth.

```
.ltxj document (AST)
      ↓
ManifestEngine.resolve("article-pro")
      ↓
Normalizer.apply(ast, manifest, mode)     ← §B
      ↓
TexSerializer.serialize(ast, manifest)    ← §C
      ↓
.tex (canonical, compilable, idiomatic)
```

---

# PART A — Profile Definition

## A.1 Profile Metadata (`profile.json` schema)

```json
{
  "id":            "article-pro",
  "displayName":   "Article — Professional",
  "documentClass": "article",
  "classOptions":  ["12pt", "a4paper"],
  "extends":       "article-base",
  "normalizerMode": "mixed",
  "description":   "University-level mathematical documents: homework, proofs, notes.",
  "tags":          ["mathematics", "university", "exercises", "proofs"]
}
```

**Inheritance:** `article-pro` extends `article-base`. The `ManifestEngine` resolves
the chain and returns a flat, merged manifest object. Fields in `article-pro`
override `article-base` when they conflict.

## A.2 Supported Node Types

The `ManifestEngine` validates every node in the `.ltxj` AST against this list.
Unsupported nodes are wrapped in a `rawLatex` node (see §C.7) and passed through
unchanged.

### A.2.1 Block nodes (supported)

| `.ltxj` type      | LaTeX output              | Notes |
|---|---|---|
| `paragraph`       | plain text paragraph      | |
| `heading`         | `\section{}` etc.         | levels 1–3 only; level 3 rare |
| `mathDisplay`     | `\[…\]` / `equation` / `align*` | see A.3 |
| `theoremEnv`      | `\begin{theorem}…`        | see A.4 |
| `bulletList`      | `\begin{itemize}…`        | |
| `orderedList`     | `\begin{enumerate}…`      | |
| `blockquote`      | `\begin{quote}…`          | |
| `rawLatex`        | verbatim passthrough       | no normalization applied |

### A.2.2 Inline nodes (supported)

| `.ltxj` type      | LaTeX output              | Notes |
|---|---|---|
| `mathInline`      | `$…$`                     | |
| `crossRef`        | `\cref{}` / `\Cref{}`     | auto-case; see §C.6 |
| `text`            | plain text                | marks: bold, italic, code |
| `hardBreak`       | `\\`                      | |

### A.2.3 Unsupported (→ `rawLatex`)

`tikzFigure`, `table`, `figure`, `algorithm`, `listing`, `bibliography`, `citation`.
These are valid LaTeX but outside this profile's scope. The serializer wraps them
in a `rawLatex` node with a comment: `% [formalia:raw — unsupported node type]`.

## A.3 `mathDisplay` Node Schema

```typescript
interface MathDisplayNode {
  type:     "mathDisplay"
  latex:    string       // canonical LaTeX (post-normalization)
  numbered: boolean      // true → \begin{equation}
  aligned:  boolean      // true → align* or align
  label:    string       // "" if unnumbered; "eq:name" if numbered
}
```

**Serialization rules:**

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
  envTitle: string   // optional; maps to \begin{theorem}[title]
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

The `TexSerializer` generates the `\newtheorem` declarations in this exact order:
`definition` first (establishes the base counter), then all `[definition]`
members, then `exercise` with its own counter.

## A.6 Macro Registry

These macros are **mandatory** in every document using this profile.
The serializer injects them into the preamble unconditionally and uses them
in the body — never the expanded form.

```json
{
  "macros": {
    "\\R":     "\\mathbb{R}",
    "\\Q":     "\\mathbb{Q}",
    "\\Z":     "\\mathbb{Z}",
    "\\N":     "\\mathbb{N}",
    "\\C":     "\\mathbb{C}",
    "\\K":     "\\mathbb{K}",
    "\\abs":   "\\left\\lvert #1 \\right\\rvert",
    "\\norm":  "\\left\\lVert #1 \\right\\rVert",
    "\\inner": "\\left\\langle #1, #2 \\right\\rangle"
  },
  "mathOperators": {
    "\\rk":     "rk",
    "\\tr":     "tr",
    "\\im":     "Im",
    "\\Ker":    "Ker"
  }
}
```

**Normalization contract:** if the AST contains `\mathbb{R}` in a `mathInline`
or `mathDisplay` node, the `MacroExpansion` normalizer rule replaces it with `\R`
before serialization. Same for all other registered macros.

---

# PART B — Normalization Engine

The `Normalizer` operates on the `MathAST` (derived from `mf.getValue('math-json')`)
before serialization. Every rule has a defined `severity` that controls behavior
under each global mode.

## B.1 Global Normalization Mode

Configured per profile (default: `"mixed"`). User can override globally.

| Mode | `required` rules | `preferred` rules | `opinionated` rules |
|---|---|---|---|
| `strict` | auto-apply | auto-apply | auto-apply |
| `mixed` | auto-apply | auto-apply | suggest only |
| `suggestion` | suggest only | suggest only | suggest only |

## B.2 Rule: `AutoDelimiters`

| Property | Value |
|---|---|
| **Severity** | `required` |
| **Trigger** | Delimiter `(`, `[`, `\|` directly wrapping a node that contains `\frac`, `\sum`, `\prod`, or `\int` with limits |
| **Action** | Wrap with `\left(…\right)` / `\left[…\right]` / `\left\|…\right\|` |
| **Example** | `(\frac{a}{b})^2` → `\left(\frac{a}{b}\right)^2` |
| **Exception** | If a manual `\big`, `\Big`, `\bigg`, or `\Bigg` is already present → do not override |
| **Coach message** | "Delimiters adjusted — parentheses scale to match the fraction height." |

## B.3 Rule: `DxSpacing`

| Property | Value |
|---|---|
| **Severity** | `required` |
| **Trigger** | Integral node (`\int`, `\iint`, `\iiint`, `\oint`) where the differential `d` is not preceded by `\,` |
| **Action** | Insert `\,` before `dx`, `dy`, `dz`, `dt`, `d\mu`, `d\theta`, and any `d` + variable combination |
| **Example** | `\int f(x) dx` → `\int f(x)\,dx` |
| **Coach message** | "Thin space added before differential (typographic convention)." |

## B.4 Rule: `TextInMath`

| Property | Value |
|---|---|
| **Severity** | `preferred` |
| **Trigger** | Sequence of two or more alphabetic characters inside math mode that does not match a known command (`\sin`, `\cos`, `\log`, etc.), a registered macro, or a single-letter variable |
| **Action** | Wrap with `\text{…}` |
| **Example** | `f(x) \quad para\ todo\ x` → `f(x) \quad \text{para todo } x` |
| **False-positive guard** | Single letters are variables, not text. `f`, `x`, `n` are never wrapped. |
| **Coach message** | "Word detected in math mode — wrapped in \\text{} for correct font rendering." |

## B.5 Rule: `MacroExpansion`

| Property | Value |
|---|---|
| **Severity** | `required` |
| **Trigger** | Any occurrence of an expanded form that has a registered macro (e.g. `\mathbb{R}` when `\R` is defined) |
| **Action** | Replace with the macro shorthand |
| **Scope** | Applied to all `mathInline` and `mathDisplay` nodes |
| **Coach message** | "Macro \\R used instead of \\mathbb{R} for consistency (manifesto rule)." |

## B.6 Rule: `AlignedSteps`

| Property | Value |
|---|---|
| **Severity** | `preferred` |
| **Trigger** | A `mathDisplay` node (unnumbered, non-aligned) whose LaTeX contains two or more `=` signs on separate lines, indicating a multi-step derivation |
| **Action** | Suggest converting to `align*` with `&` alignment point before each `=` |
| **Note** | Does not auto-apply in `mixed` mode — always a Coach suggestion |
| **Coach message** | "Multiple equality signs detected. Consider align* for step-by-step derivations." |

## B.7 Rule: `DisplayThreshold`

| Property | Value |
|---|---|
| **Severity** | `opinionated` |
| **Trigger** | A `mathInline` node whose LaTeX contains `\frac` with limits, `\sum` with limits, or `\int` with limits |
| **Action** | Suggest promoting to `mathDisplay` |
| **Coach message** | "Expression with fraction/integral may be hard to read inline. Consider display mode." |

## B.8 Rule: `ForbiddenSyntax`

| Property | Value |
|---|---|
| **Severity** | `required` — blocks serialization |
| **Trigger** | Presence of `$$…$$`, `{\bf …}`, `{\it …}`, `\eqnarray`, `\begin{eqnarray}` anywhere in the AST |
| **Action** | Linter error — document cannot be serialized until resolved |
| **Replacements** | `$$…$$` → `\[…\]`; `{\bf …}` → `\textbf{…}`; `\eqnarray` → `align*` |
| **Coach message** | "Obsolete syntax detected. See Formalia docs for canonical replacements." |

---

# PART C — Output Serializer

## C.1 Package Load Order (mandatory, deterministic)

The `TexSerializer` injects packages in this exact sequence. Deviating from this
order causes known compilation failures (particularly with `cleveref`).

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
  pdftitle          = {TITLE},      % from document metadata
  pdfauthor         = {AUTHOR},
  pdfsubject        = {SUBJECT},
  pdfkeywords       = {LaTeX, mathematics}
}
```

## C.3 `\geometry` Block

```latex
\geometry{left=2.5cm, right=2.5cm, top=2.5cm, bottom=2.5cm}
```

## C.4 Macro and Operator Injection

```latex
% ── Number set shortcuts ───────────────────────────────────────
\newcommand{\R}{\mathbb{R}}
\newcommand{\Q}{\mathbb{Q}}
\newcommand{\Z}{\mathbb{Z}}
\newcommand{\N}{\mathbb{N}}
\newcommand{\C}{\mathbb{C}}
\newcommand{\K}{\mathbb{K}}

% ── Delimited expressions ──────────────────────────────────────
\newcommand{\abs}[1]{\left\lvert #1 \right\rvert}
\newcommand{\norm}[1]{\left\lVert #1 \right\rVert}
\newcommand{\inner}[2]{\left\langle #1, #2 \right\rangle}

% ── Math operators ─────────────────────────────────────────────
\DeclareMathOperator{\rk}{rk}
\DeclareMathOperator{\tr}{tr}
\DeclareMathOperator{\im}{Im}
\DeclareMathOperator{\Ker}{Ker}
```

## C.5 `\newtheorem` Injection (order-sensitive)

```latex
% ── Base counter (must be first) ───────────────────────────────
\theoremstyle{definition}
\newtheorem{definition}{Definition}[section]

% ── Shared-counter group ───────────────────────────────────────
\theoremstyle{plain}
\newtheorem{theorem}[definition]{Theorem}
\newtheorem{lemma}[definition]{Lemma}
\newtheorem{proposition}[definition]{Proposition}
\newtheorem{corollary}[definition]{Corollary}

\theoremstyle{remark}
\newtheorem{remark}[definition]{Remark}
\newtheorem{example}[definition]{Example}
\newtheorem{note}[definition]{Note}

% ── Independent counter ────────────────────────────────────────
\newtheorem{exercise}{Exercise}[section]

% cleveref is loaded AFTER this block (see C.1)
```

## C.6 `crossRef` Node → LaTeX

The `crossRef` node carries a `refId` and a `position` attribute. The serializer
uses `position` to choose between `\cref{}` (mid-sentence) and `\Cref{}`
(sentence-start) automatically. The user never writes `\cref` or `\Cref` manually.

```typescript
interface CrossRefNode {
  type:      "crossRef"
  refId:     string            // e.g. "thm:bolzano", "eq:euler"
  position:  "mid" | "start"  // determined by parser from text context
}
```

Serialization:

```
crossRef { refId: "thm:bolzano", position: "mid"   } → \cref{thm:bolzano}
crossRef { refId: "thm:bolzano", position: "start" } → \Cref{thm:bolzano}
crossRef { refId: "eq:euler",    position: "mid"   } → \cref{eq:euler}
```

> **Why `\cref` for equations (not `\eqref`):** `cleveref` subsumes `\eqref`.
> Using `\cref{eq:X}` produces "equation (3)" — equivalent output, single API.
> `\eqref` is permitted in `rawLatex` nodes but never generated by the serializer.

**Spanish-locale `cleveref` configuration** (injected when `babel` lang is `spanish`):

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

## C.7 AST Node → LaTeX Mapping

### Block nodes

```
paragraph          → inline content + blank line
heading level 1    → %==…==\n\section{CONTENT}\n%==…==
heading level 2    → \subsection{CONTENT}
heading level 3    → \subsubsection{CONTENT}   % (rare)
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

**Piecewise function** (within `mathDisplay` with `\begin{cases}`):
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

**Matrix environments:**
```latex
\begin{pmatrix} a & b \\ c & d \end{pmatrix}   % round
\begin{bmatrix} a & b \\ c & d \end{bmatrix}   % square
\begin{vmatrix} a & b \\ c & d \end{vmatrix}   % determinant
```

**Augmented matrix** (linear systems):
```latex
\left(\begin{array}{ccc|c}
  1 & 0 & 2 & 3 \\
  0 & 1 & -1 & 5
\end{array}\right)
```

**Row operations:**
```latex
\xrightarrow{R_2 \leftarrow R_2 - 3R_1}
```

## C.8 Output Formatter Rules

These rules govern the formatting of the `.tex` file itself (whitespace, indentation,
comments). They do not affect the compiled PDF.

1. **Indent** 2 spaces inside every `\begin{}`/`\end{}` pair.
2. **Section separators:** inject `%==…==` comment blocks above every `\section{}`.
3. **Blank line** before and after every display environment (`\[…\]`, `align*`,
   `equation`).
4. **No trailing `\\`** on the last line of `align*`, `cases`, or table rows.
5. **Comment non-obvious decisions** with `% [formalia: reason]` annotations
   (e.g. `% [formalia: \dfrac used — fraction inside cases]`).

---

# PART D — System Guarantees

> These are not checklist items for a human to verify.
> They are invariants that the system **enforces** before producing output.

## D.1 Serializer Invariants (hard blocks)

The `TexSerializer` refuses to produce output if any of these conditions hold.
The `SemanticLinter` surfaces these as blocking errors in the UI.

| Invariant | Linter error |
|---|---|
| `$$…$$` present anywhere in AST math content | `E001: forbidden-display-syntax` |
| `{\bf …}` or `{\it …}` present | `E002: obsolete-font-command` |
| `\eqnarray` present | `E003: forbidden-environment` |
| `crossRef` node whose `refId` has no matching `\label` in the document | `E004: orphan-cross-reference` |
| `theoremEnv` of type `proof` directly after a `rawLatex` node with no preceding theorem | `E005: proof-without-theorem` |

## D.2 Normalizer Guarantees (post-pipeline)

After the `Normalizer` runs in any mode, the output AST is guaranteed to satisfy:

| Guarantee | Enforced by rule |
|---|---|
| All `\mathbb{X}` replaced by registered macros | `MacroExpansion` |
| All integral differentials preceded by `\,` | `DxSpacing` |
| All delimiters around `\frac`/`\sum`/`\int` are `\left…\right` | `AutoDelimiters` |
| No bare `\ref{}` for equations — always `\cref{}` | Output Formatter |

## D.3 Warnings (non-blocking)

These conditions produce Coach panel suggestions but do not block serialization.

| Condition | Warning |
|---|---|
| Multi-word text sequence in math mode without `\text{}` | `W001: text-in-math` |
| `mathDisplay` with multiple `=` signs on separate lines without `align*` | `W002: consider-align` |
| `mathInline` containing `\int` or `\sum` with limits | `W003: consider-display` |
| Heading level 3 (`\subsubsection`) used | `W004: deep-nesting` |
| Document longer than 2 pages without `\tableofcontents` | `W005: missing-toc` |

---

# APPENDIX — Reference Templates

> These templates are **test fixtures** for the serializer and **reference output**
> for debugging. They show what the `TexSerializer` should produce for a standard
> document.

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

% Usage in body:
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

*This manifesto is the machine specification for `article-pro` in the Formalia
system. Human-readable documentation is derived from this file — not the reverse.*
