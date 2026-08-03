# 8 · Documentos largos (informe / tesina)

> **Estado:** ✅ **listo** (`documentos-largos.tex` → `.pdf`, 10 pp) ·
> **Nivel 3 (Tipos de documento)** · clase `report` (autodemostrativo) ·
> [suite](../README.md) · [TEMARIO](../TEMARIO.md)

TPs largos, informes y tesinas con estructura. El documento es un `report` con
**capítulos reales**, así que demuestra en vivo lo que explica.

**Contenido:** jerarquía (`part`→`chapter`→…→`paragraph`, versiones `*`) ·
front/main/back matter y `\pagenumbering` · **numeración** (`secnumdepth`,
`tocdepth`, `\numberwithin` por capítulo, `\setcounter`) · encabezados/pies con
`fancyhdr` (`\leftmark`) · **modularización** (`\input` vs `\include`,
`\includeonly`, `subfiles`) · referencias cruzadas entre archivos con `\cref` ·
apéndices (`\appendix`) · índice analítico (`makeidx`/`\printindex`) ·
`\tableofcontents`/`\listoffigures`/`\listoftables`.

**Compilar:** `latexmk -pdf documentos-largos.tex` (corre `makeindex` solo).
