# Diseño — ecuaciones multilínea (filas con identidad)

> **Estado:** decisión tomada (2026-07-03). Reemplaza el `tex` opaco de bloque por un
> **contenedor de filas** (mismo patrón que `table`→rows y `list`→items: estructura de
> Matex, hoja opaca). Habilita numeración y **referencia por línea** de forma robusta.

## Modelo

```ts
interface EquationRow {
  tex: string          // contenido OPACO de la fila (con & para alinear, si aplica)
  numbered?: boolean   // esta fila lleva número
  id?: string          // identidad estable → referenciable (la genera el editor)
  label?: string       // clave LaTeX custom opcional
}
interface MathDisplayNode {
  type: 'mathDisplay'
  aligned?: boolean    // default true (alinear en &); false = centrar. Ver ACTUALIZACIÓN.
  rows: EquationRow[]   // 1..n
}
```

> **ACTUALIZACIÓN (2026-07-03):** se reemplazó `kind: 'plain'|'align'|'gather'` por
> **`aligned?: boolean`** (default true). Motivo (discusión con el usuario): `plain/align/
> gather` eran **nombres de entornos LaTeX** filtrados al modelo. La intención real son dos
> ejes: *cuántas filas* (ya lo da `rows`) y *cómo se disponen* (alinear en `&` vs centrar =
> un booleano). "Simple" no es un modo: es *una fila*. El **compilador** deriva el entorno
> (`equation`/`\[…\]`/`align`/`gather`/`*`) — es una decisión de compilación, no del AST.
> Helper puro compartido `equationPlan(rows, aligned)` en `core/equation.ts` (lo usan el
> compilador y el preview, sin duplicar la bifurcación). Migración `kind→aligned`:
> `gather`→`aligned:false`; `align`/`plain`→default (se omite). UI: un toggle **"Alinear en
> `&`"** en vez de 3 botones (el toggle no descarta filas → se fue el bug de pasar a Simple).

La **fila** es la unidad numerada/referenciable. El `id` se pega a la fila-objeto (no a
un índice del blob) → robusto ante edición/reordenamiento.

## Decisiones cerradas

- **D1 — Filas solo; `&` opaco dentro del `tex` de la fila.** No modelamos columnas
  (es alineación; KaTeX/MathML ya la interpretan). Mismo criterio que "no parseamos la
  matemática".
- **D2 — Unificado:** `plain` = 1 fila. Un solo shape, un solo camino de código.
- **D3 — Entorno derivado de las filas:** alguna fila numerada → `align`/`gather`
  (con `\notag` en las no numeradas); ninguna → `align*`/`gather*`. `plain`: fila
  numerada → `equation`, si no `\[…\]`.
- **D4 — Default de `numbered`:** fila nueva de `align`/`gather` nace **numerada**;
  `plain` nace **sin** número. Guardado explícito por fila.
- **D5 — Fila referenciada ⇒ numerada** (una fila con `\notag` no tiene número; al
  referenciarla se fuerza `numbered=true`).
- **D6 — `multline`/`split` (1 número, varias líneas): fuera de alcance.** Por ahora
  `rawLatex`; futuro `kind:'multline'` de bloque (número del bloque, no por fila).
- **D7 — `MATEX_AST_VERSION = 2` + migración en `parse`** (v1 `{tex}` → `rows:[{tex}]`;
  `align` viejo → split por `\\`; `id`/`label`/`numbered` de bloque → primera fila).
- **D8 — Editor: mini-editor de filas** (input + toggle numerada por fila + agregar/
  quitar/reordenar). **No** textarea + re-split (desalinea ids = frágil).

## Compilación (por fila)

```
plain:  fila numerada → \begin{equation}…\label…\end{equation}; si no \[ … \]
align:  \begin{align} | align* según haya filas numeradas
        por fila: tex [\label{clave}] , y \notag si no numerada, \\ entre filas
gather: idem con gather/gather*
```
La clave `\label` sale de la resolución por identidad (`label` custom o `id`), igual que
el resto de referenciables.

## Impacto (lockstep)

`ast.ts` · `parse.ts` (+migración) · `compile.ts` (render + refs por fila) · `mapping.ts`
· `numbering.ts` (número por fila + `listReferenceables` por fila) · nodo `Ref` (resolver
por id de fila) · node view `mathDisplay` (KaTeX por filas) · **popover → editor de
filas** · barra contextual (numbered/label por fila) · tests + `verify-content`.

## Plan por fases

- **F1 — core+compilador:** AST `rows` + v2 + migración + compilador por fila + tests + PDF. ✅ **HECHO (2026-07-03)** — tsc+oxlint+318 tests+build; PDF real verificado (align (1)/[sin]/(2), gather, plain, `\cref` a la fila).
- **F2 — numeración + refs por fila.** ✅ **HECHO** — `numbering.ts` numera por fila; `listReferenceables` enumera cada fila numerada; `Ref.select` asigna id a `rows[rowIndex]`.
- **F3 — editor de filas.** ✅ **HECHO** — `displayMathView` (input por fila, Nº/quitar/+fila, plain con toggle Numerada); barra contextual = solo Formato + hint.
- **F4 — bordes:** forzar numerada al referenciar ✅ (`Ref.select` fuerza `numbered:true`); filas vacías ✅ (mínimo 1 fila). **Pendiente:** reordenar filas (drag), anotar multline/`\intertext` (por ahora vía rawLatex).

## Riesgos

Preview KaTeX `\tag` por fila (PDF ok igual); corrección de la migración; `\notag`/mixto
(verificar en PDF); `&` opaco (un backend no-LaTeX deberá interpretarlo — KaTeX ya lo hace).
