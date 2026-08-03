# 6 · Referencias, índices y bibliografía

> **Estado:** ✅ **listo** (`referencias-biblio.tex` → `.pdf`, 5 pp + `refs.bib`) ·
> **Nivel 2 (Capacidades)** · clase `article` ·
> [suite](../README.md) · [TEMARIO](../TEMARIO.md)

El **aparato** que conecta el documento. Trae un `refs.bib` real, así la
bibliografía se demuestra en vivo (biblatex + biber).

**Contenido:** referencias cruzadas (`\label`/`\ref`/`\pageref`, **`\cref`** vs
`\eqref`/`\autoref`, convención de claves) · `hyperref` (enlaces, marcadores,
metadatos, `\url`/`\href`, `unicode`) · notas e índices (`\footnote`,
`\tableofcontents`, `\listoffigures`, `\addcontentsline`, `tocdepth`, glosarios)
· **bibliografía moderna** (`biblatex`+biber: `.bib`, `\cite`/`\parencite`/
`\textcite`/`\footcite`, estilos, `\printbibliography`) · enfoque clásico
(BibTeX+`natbib`) · buenas prácticas.

**Compilar:** `latexmk -pdf referencias-biblio.tex` (corre `biber` solo).
