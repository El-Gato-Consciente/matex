# 7 · Presentaciones con Beamer (a fondo)

> **Estado:** ✅ **listo** (`beamer.tex` → `beamer.pdf`, 6 pp) ·
> **Nivel 3 (Tipos de documento)** · clase **`article`** (guía *sobre* la clase
> `beamer`) · [suite](../README.md) ·
> [TEMARIO](../TEMARIO.md#10-presentaciones-beamer--doc-4)

Guía de referencia de la clase **`beamer`** en profundidad. Es un `article` que
explica cómo hacer presentaciones (no es, en sí mismo, una presentación).

> **No es la [Masterclass](../masterclass-latex/):** esa es una presentación
> *sobre LaTeX en general*. Esta documenta la **clase Beamer**.

**Contenido:** anatomía y opciones de `frame` (`fragile`/`plain`/
`allowframebreaks`) · secciones, índice y `\AtBeginSection` · bloques
(`block`/`alertblock`/`exampleblock`) · columnas · **overlays** (`\pause`,
`<n->`, `\only`/`\uncover`/`\onslide`/`\alt`/`\temporal`, `\alert<>`) · las
cuatro capas de **temas** + personalización (`\setbeamercolor/font/template`) ·
matemática y `pgfplots` animado · notas del orador · `handout` y `pgfpages` ·
buenas prácticas.

**Compilar:** `latexmk -pdf beamer.tex`.
