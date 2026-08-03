# Referencia del modelo Matex — v1 (implementado)

> **Rol:** este documento describe **lo que Matex ES hoy** — el modelo realmente
> implementado y que compila a PDF. Es distinto de [modelo-semantico.md](./modelo-semantico.md),
> que es **visión** (el norte, más ambicioso: `demostracion` estructurada, `grafo`,
> `automata`…). Acá no hay aspiración: solo el catálogo vigente.
>
> **Estado:** vivo. Versionado en lockstep con `MATEX_AST_VERSION` (hoy **1**).
> **Fuente de tipos autoritativa:** [`matex-core/ast.ts`](../../plataforma/src/features/matex/core/ast.ts).
> Este doc **narra, decide y proyecta**; **no** duplica los tipos (eso rota).

## 0. Cómo mantener este documento (disciplina)

1. **No duplicar `ast.ts`.** Si querés la forma exacta de un nodo, mirá el código.
   Acá va el *catálogo*, la *proyección a backends* y las *decisiones*.
2. **Actualizar es parte del "done".** Agregar un nodo o atributo = actualizar esta
   Referencia **en el mismo commit** que el código, los tests y `verify-content`.
3. **Versionado.** Cuando el AST suba a v2, esta Referencia lo refleja y documenta la
   migración (como se hizo con localStorage v1→v2).

## 1. Fuente de verdad y formas en disco

- **Fuente de verdad = el AST** (modelo semántico tipado). Todo lo demás se **deriva**.
- **`.mtex`** = el AST serializado a **JSON**. Es el **archivo real** de un documento
  Matex: portable, importable, reabrible. `serializeMatexDoc` / `parseMatexDoc` (zod).
- **`.tex`** = **export de una sola vía** (proyección a LaTeX para compilar/compartir).
  **No se reconstruye Matex desde un `.tex`.** Por eso el `.mtex` es el que da entidad.

## 2. Catálogo de nodos v1

Raíz: **`doc`** = `{ type:'doc', version:1, meta?, content: BlockNode[] }`.

### Bloques (`BlockNode`)

| Nodo | Atributos | Contiene | Proyección LaTeX |
|------|-----------|----------|------------------|
| `part` | `id?`, `label?` | `InlineNode[]` | `\part{…}` (+ `\label{}`) — la división **por encima** del capítulo (ME-46). Numerada en **romanos** (I, II…), contador propio; **no reinicia** capítulos/secciones. Válida en cualquier clase. No cambia los 3 niveles de `heading`: se *inserta* arriba |
| `heading` | `level: 1\|2\|3`, `label?` | `InlineNode[]` | `\section`/`\subsection`/`\subsubsection{…}` en `article`; `\chapter`/`\section`/`\subsection` en `report`/`book` (+ `\label{}`) |
| `paragraph` | — | `InlineNode[]` | párrafo (texto escapado + marcas) |
| `bulletList` | — | `listItem[]` | `itemize` |
| `orderedList` | — | `listItem[]` | `enumerate` |
| `listItem` | — | `BlockNode[]` | `\item …` |
| `mathDisplay` | `aligned?` (default true), `rows: EquationRow[]` | — | Contenedor de **filas** (`EquationRow = { tex, numbered?, id?, label? }`). El entorno lo **deriva el compilador** (`equationPlan`): 1 fila → `equation`/`\[…\]`; ≥2 → `align`/`gather` (según `aligned`) + `*` si ninguna numerada; `\notag` en filas sin número. `id`/`label` **por fila** → referencia por línea. Ver [ecuaciones-multilinea.md](ecuaciones-multilinea.md) |
| `theorem` | `variant`, `title?`, `label?`, `proves?` | `BlockNode[]` | entorno amsthm (`proof` → `proof`); `[title]` + `\label{}`. `proof` con `proves` → `[\proofname\ del~\cref{proves}]` (proof diferido, número automático) |
| `table` | `align?`, `header?`, `rules?`, `caption?`, `label?` | `tableRow[]` → `tableCell[]` (inline) | `tabular` **booktabs** (sin verticales); flotante `table` si hay caption/label |
| `figure` | `src`, `caption?`, `width?` (fracción de `\textwidth`), `id?`, `label?` | — | Flotante `figure[htbp]` centrado + `\includegraphics[width=…]`; caption **abajo** con `\label` (solo con caption ⇒ referenciable). `src` = imagen del proyecto (base64 en `files`). Dispara `graphicx`. **No es layout** (float) |
| `rawLatex` | `latex` | — | se emite **tal cual** (escape hatch) |

`table.rules` ∈ `horizontal` (booktabs, default) · `none`. `table.align` es por columna
(`left`/`center`/`right`, default `left`). **No hay verticales** (§5).

`theorem.variant` ∈ `theorem · lemma · proposition · corollary · definition ·
example · remark · proof`. Nombres en español y numeración vía el canon (`THEOREMS`).

### En línea (`InlineNode`)

| Nodo | Atributos | Proyección LaTeX |
|------|-----------|------------------|
| `text` | `text`, `marks?: Mark[]` | texto **escapado** + marcas |
| `mathInline` | `tex` | `$…$` (math crudo, no se escapa) |
| `ref` | `target` (= `id` del objeto) | resuelve `id`→`\cref{clave}`; sin resolver → `\textbf{??}` (ref colgada, evita `\cref{}` fatal) |

**Referencias por identidad (modelo B).** Se referencia el **objeto**, no una clave. Los
nodos referenciables (`heading`/`theorem`/`mathDisplay`/`table`) tienen un `id` estable
(lo genera el editor al referenciar por primera vez) + `label` custom **opcional** (clave
legible en el `.tex`). El compilador hace una pasada: cada objeto referenciado o con
`label` emite `\label{clave}` (clave = `label` si existe, si no el `id`); cada `ref`
resuelve `target(id)→\cref{clave}` (compat: un `target` que sea una label directa también
resuelve). En el editor la ref se **inserta con un picker con filtro** (lista los
referenciables con su número en vivo), se **muestra resuelta** ("→ Teorema 1.1"), y las
colgadas se marcan "⚠ referencia rota".

Marcas (`Mark`): `strong` → `\textbf`, `emph` → `\emph`, `code` → `\texttt`
(anidan con negrita como capa externa).

### Metadatos (`meta`, opcional)

`title?`, `author?`, `date?` → `\title/\author/\date` + `\maketitle`.
`titlePage?` → opción de clase `titlepage` (`\maketitle` en página propia).
`toc?` → `\tableofcontents` **después de la portada** (posición convencional; es un
flag de documento, no un nodo suelto — la posición del índice no la decide el autor).
**Diseño del documento (v3, LE-02).** El AST **no** guarda la línea `\documentclass` ni
nombres de temas de paquete: guarda **qué es** el documento y **cómo se ve**, y cada backend
lo traduce.

| Campo | Valores | Qué significa |
|-------|---------|----------------|
| `docKind?` | `article` · `report` · `book` | **Estructura**: secciones vs. capítulos (y partes). Es la única distinción con consecuencia semántica entre las clases clásicas — el backend HTML la usa igual. Default `article`. |
| `style?` | `standard` · `classic` · `modern` | **Familia de diseño**. En LaTeX elige clase KOMA, tema de beamer, estilo de moderncv o tema de tikzposter según la familia del documento; en HTML, tipografía y filetes. |
| `accent?` | `blue` `green` `orange` `red` `purple` `grey` `black` | **Color de acento** → `\usecolortheme` / `\moderncvcolor` / `\usecolorpalette` · variable CSS. |
| `paperSize?` | `a4` · `letter` | Tamaño de página (default `a4`). |
| `baseFontSize?` | `10` · `11` · `12` | Cuerpo base en puntos (default 11). |
| `columns?` | `1` · `2` | **Columnas de página** (FIX-21): el texto fluye en dos columnas estilo paper. Es layout de **salida**, no de edición. PDF → opción `twocolumn` (con el título cruzando vía `\twocolumn[\maketitle]`). **HTML → una columna** reflowable (la web no tiene páginas; dos columnas sobre scroll serían ilegibles) — como arXiv. Default 1. Solo en prosa normal (las familias tienen su layout). |

El costo aceptado: **no se puede pedir un tema concreto** (`Warsaw` vs `Madrid`). Se pide una
familia de diseño y el backend elige por su cuenta. A cambio, el mismo documento se ve
coherente en PDF y en HTML, que es la tesis del proyecto.

**Familia del documento (v4, AR-09).** `meta.family` es una **unión discriminada** por `kind`:
`{ kind: 'presentation' }` · `{ kind: 'letter', letter }` · `{ kind: 'exam', exam }` ·
`{ kind: 'cv', cv }` · `{ kind: 'poster', poster }`. Sin `family`, es un texto normal
(article/report/book según `docKind`). Reemplaza a los cinco flags sueltos de ME-23, que
permitían estados imposibles (`{letter, presentation}` a la vez): con la unión, **un documento
pertenece a una sola familia por construcción**. La elección **versión del alumno vs. del
docente** de un examen **no** vive acá: es `opts.showSolutions` (ocasión de emisión, Regla 2 §③).

## 3. Proyección a backends

Hoy hay **un** backend real (LaTeX). La tabla deja explícito el hueco multi-backend:
todo nodo debe poder proyectarse a varios, o no entra (§5).

| Concepto | LaTeX (implementado) | HTML (pendiente) | Typst (pendiente) |
|----------|----------------------|------------------|-------------------|
| heading | `\section…` | `<h1…>` | `= …` |
| math | `$…$` / `equation` | MathML/KaTeX | `$…$` |
| listas | itemize/enumerate | `<ul>`/`<ol>` | `- ` / `+ ` |
| teorema | amsthm | `<div class=theorem>` | show-rule |
| ref | `\cref` | `<a href=#…>` | `@label` |
| tabla | `tabular` booktabs | `<table>` | `table()` |
| toc | `\tableofcontents` | índice generado | `outline()` |

**Preámbulo composicional** (se **infiere del contenido**, cumpliendo el canon
PISO+EXTRA): hay math → `amsmath,amssymb` + **macros Matex**; hay teoremas → `amsthm`
+ declaraciones; hay `ref` con destino → `hyperref`+`cleveref`.

**Macros Matex** (fuente única: [`macros.ts`](../../plataforma/src/features/matex/core/macros.ts)):
`\R \N \Z \Q \C \sen \abs \norm`. Se inyectan como `\providecommand` en el preámbulo
**y** alimentan el preview de KaTeX — así **lo que se ve compila igual** (si vivieran
solo en KaTeX, `\R` rompería el PDF).

## 4. Decisiones de compilación (lo que el compilador completa)

El compilador es **opinado por defecto**: a partir de un AST **ralo** rellena un
andamiaje completo de documento. Muchas cosas del PDF **no están en el AST** — las
elige el compilador. Esta tabla las hace **explícitas y auditables** (antes vivían
implícitas en el código). Su hogar natural es el **canon** (`canon.ts`, que espeja
`estandares.tex`); lo que todavía vive en `compile.ts` está marcado.

**Regla (litmus):** *todo lo que el compilador emita y **no** derive 1:1 de un nodo del
AST es una "decisión de completado" y **debe** figurar en esta tabla.*

> **Nota (2026-07).** La columna **«Configurable»** es ambigua y hay que leerla con la Regla 2
> de [`reglas-del-modelo.md`](reglas-del-modelo.md): *«configurable»* puede significar **por el
> autor** (lugar ①, existe un campo en `meta`) o **por quien edita el código** (lugar ②, es
> política del producto y no hay interfaz). No son lo mismo. Donde dice *«Configurable: sí»* sin
> nombrar un campo de `meta`, léase **«política del producto»**, no «el autor puede tocarlo».
> Además: esta tabla es **LaTeX-específica**; las filas cuya política es **agnóstica** (numeración,
> reglas de tabla, índice, macros) son en realidad **política compartida** (Regla 3) y su hogar
> definitivo es `core/policy/`, no el canon de LaTeX.

| Decisión | Default | Dónde vive | Tipo | Configurable |
|----------|---------|-----------|------|--------------|
| Preámbulo PISO | fontenc T1 + lmodern + babel(es-noshorthands) + microtype, **siempre** | canon `PISO_ES` | política | no (es el piso) |
| EXTRA por inferencia | math→`amsmath,amssymb`; teoremas→`amsthm`+decls; `ref` con destino→`hyperref+cleveref` | trigger en `compile.ts` (`collectRequirements`) + paquetes en canon | política | — |
| Clase por defecto | **derivada** del diseño semántico: `article` 11pt a4 (+`titlepage` si `meta.titlePage`) | `compile.ts` `documentclassLine` | política | sí (`docKind`/`style`/`paperSize`/`baseFontSize`) |
| Macros de la casa | `\R \N \Z \Q \C \sen \abs \norm`, inyectadas si hay math | `macros.ts` | política **compartida** | **política del producto** (no hay campo; se edita el set) |
| Numeración de teoremas | por sección, contador compartido, `proof`/`remark` sin número | **compartida** → `core/policy` (AR-08) | **política del producto** (hoy divergía en HTML: FIX-18) |
| Opciones de cleveref | `spanish,capitalise,nameinlink` | canon `NAV` | política | — |
| Heading nivel→sección | 1→`\section`… en `article`; 1→`\chapter` en `report`/`book` | `compile.ts` `headingCmdsFor(docKind)` | política | sí (`meta.docKind`) |
| Escape de reservados | `\{}$&#%_~^` escapados | `compile.ts` `escapeLatex` | fiel | no |
| Anidado de marcas | strong (afuera) › emph › `\texttt` | `compile.ts` `applyMarks` | política | no |
| Ecuación en bloque (entorno) | `equationPlan(rows, aligned)`: 1 fila → `equation` (si lleva número/label) o `\[…\]`; ≥2 → `align`/`gather` (según `aligned`) + `*` si ninguna numerada; `\notag` en filas sin número | `compile.ts` `mathDisplayToLatex` + `core/equation.ts` | política | — |
| `ref` sin destino | `\textbf{??}` (evita el `\cref{}` fatal) | `compile.ts` | política (fallback) | — |
| `\maketitle` | solo si hay `meta.title` | `compile.ts` | política | — |
| Tabla | booktabs (sin verticales), encabezado con `\midrule` (**sin negrita**), **caption abajo** (más aire por `\abovecaptionskip`), flotante `table[htbp]` si hay caption/label | `compile.ts` `tableToLatex` | política | parcial (`rules`/`align`) |
| Índice | tras la portada, **en página propia** (`\clearpage`) | `compile.ts` (+`meta.toc`) | política (capa 3, §5) | sí (inline vs ownPage) |
| Márgenes | **por omisión** (no se carga `geometry`) → defaults de LaTeX | — (decisión por omisión) | política | sí (`geometry`) |
| Orden del preámbulo | clase→PISO→idioma→diseño→math→teoremas→tablas→gráficos→extras→nav (último) | canon `buildPreamble` | política | no |
| Documento sin páginas | doc sin contenido imprimible → el backend avisa "sin páginas" (no PDF mudo) | `LatexmkCompiler` | infra | — |

**Nota multi-backend:** hoy estas políticas son **LaTeX-específicas** y viven en el
compilador Matex→LaTeX. Cuando llegue un 2º backend (HTML/Typst), lo **agnóstico** de
cada decisión (p. ej. "teoremas numerados por sección", "índice en página propia", "las
macros de la casa") debería subir a una **capa de política compartida**, y solo la
*proyección* ser por-backend — para no re-decidir distinto en cada uno.

## 5. Lo extra-semántico: las 4 capas (decisión)

**Posición:** *Matex modela **intención**, no **apariencia**. La "intención de
presentación" es contenido legítimo y va en el AST — como vocabulario **cerrado,
enumerado y agnóstico**, con default = el canon. Lo demás es `rawLatex`.*
En una frase: **opinado por defecto, configurable por excepción, crudo por escape.**

| Capa | Qué es | Ejemplo | Cómo se modela |
|------|--------|---------|----------------|
| **1 · Semántica** | *qué es* la cosa | teorema, celdas de una tabla, colspan | nodo del AST |
| **2 · Intención de presentación** | decisión de autoría, agnóstica, sobre *ese* elemento | líneas de tabla, alineación de columna, ancho de imagen | **atributo enum opcional** con default |
| **3 · Estilo del documento** | look global | márgenes, interlineado, fuente base | bloque `meta`/`style` (enum, no dimensiones crudas) |
| **4 · Escape** | micromanagement solo-LaTeX | `\vspace{3.2pt}`, `\cline{2-3}` | `rawLatex` |

### El test decisivo (para clasificar cualquier caso nuevo)

1. **¿Significado/estructura o look global?** Estructura → capa 1/2. Global → capa 3.
2. **¿Se expresa como vocabulario cerrado que *otro* backend (HTML/Typst/Word) también
   honraría?** Sí → atributo enum. Solo tiene sentido en LaTeX → capa 4 (raw).
3. **¿El 90% querría el default?** Sí → modelalo con default, escondido en "avanzado".
   One-off raro → raw.

> **Regla dura (del usuario): si no mapea a varios backends distintos, NO entra al
> modelo** — va a `rawLatex`. Preferimos enums cerrados (se mapean a N backends y se
> renderizan como dropdown) a un bolso abierto de key-values estilo Pandoc `Attr`.

### Ejemplo trabajado — tablas (core implementado)

En vez de exponer `\hline`/`|c|c|`, el nodo lleva enums con default = canon:
`rules: none|horizontal` (default `horizontal`, booktabs) · `align: left|center|right`
por columna. `rules:'horizontal'` proyecta a booktabs, a `border-bottom` en HTML, a
reglas horizontales en Typst.

**Decisión sobre las verticales** (aplicando el test §5 al caso que motivó todo esto):
las **líneas verticales son un anti-patrón del canon** (`canonLint` marca `\hline` y
`|` en el column spec) — no una preferencia neutral. Por eso **no** tienen atributo en
el modelo (no existe `rules:'all'`): una grilla con verticales se hace con `rawLatex`.
Es el mismo criterio que con `eqnarray`/`$$`: los anti-patrones se ofrecen solo por el
escape hatch, no por el modelo. Así la salida del modelo **siempre pasa el lint**.

## 6. Reglas de diseño (guardrails)

- **Enums cerrados, no valores libres** (dropdown, no input de texto).
- **Default = el canon** (el atributo existe para *desviarse* de la buena práctica).
- **Aditivo y versionado**: cada atributo es opcional con default → nunca rompe docs
  viejos (ver los 5 principios de escalabilidad en
  [spec-editor-visual.md](../05-plataforma/spec-editor-visual.md#escalabilidad-y-cobertura)).
- **Esconder en "avanzado"**: el editor muestra el default; lo demás en un disclosure.
- **Riesgo a vigilar:** *muerte por mil opciones*. El guardrail es el test §5.2.

## 7. Pendientes (próximos nodos / atributos)

Ver [roadmap](../04-roadmap/) y [backlog](../06-backlog/backlog.md). En cola:
`codeBlock`, `include` (multi-archivo), `cite`+`.bib`. Cada uno: nodo en el core
(`toLatex` + preámbulo) + UI en el editor + **actualizar esta Referencia**. *(`table` y
`figure` ya tienen editor visual; las **ecuaciones multilínea** también —filas +
`aligned`—, ver [[editor-visual-spec]] y [ecuaciones-multilinea.md](ecuaciones-multilinea.md).)*
