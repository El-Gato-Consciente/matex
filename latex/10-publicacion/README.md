# 10 · Publicación e interoperabilidad

> **Estado:** ✅ **listo** (`publicacion.tex` → `.pdf`, 4 pp) ·
> **Nivel 4 (Avanzado)** · clase `article` ·
> [suite](../README.md) · [TEMARIO](../TEMARIO.md#18-publicación-conversión-e-interoperabilidad)

La capa de **salida** y los puentes hacia afuera: llevar LaTeX a/desde otros
formatos y dejar el documento listo para publicar.

**Contenido:** **`pandoc`** (LaTeX ↔ Word ↔ Markdown ↔ HTML) · LaTeX a HTML con
matemática (`make4ht`/`tex4ht`, **LaTeXML**, MathJax/KaTeX) · calidad del PDF
(metadatos, **PDF/A** con `pdfx`, accesibilidad/`tagpdf`) · preparar un envío
(arXiv/revista: `latexpand`, incluir el `.bbl`) · **mail merge**
(`csvsimple`/`datatool` desde un CSV) · compartir (Overleaf, git, `latexdiff`) ·
buenas prácticas.

**Compilar:** `latexmk -pdf publicacion.tex`.
