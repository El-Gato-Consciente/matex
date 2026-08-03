# 9 · Programación y automatización

> **Estado:** ✅ **listo** (`programacion.tex` → `.pdf`, 5 pp) ·
> **Nivel 4 (Avanzado)** · clase `article` ·
> [suite](../README.md) · [TEMARIO](../TEMARIO.md#13-programación-automatización-y-compilación-condicional)

LaTeX como **lenguaje de programación** (Turing-completo): meter lógica y
automatizar. Demuestra en vivo lo básico y muestra el resto en código.

**Contenido:** macros (`\newcommand` con args y opcionales, `\renewcommand`/
`\providecommand`, entornos) · contadores y longitudes · **lógica** (`ifthen`,
`etoolbox` toggles, `\ifnum`/`\ifdefined`) · **bucles** (`\foreach`,
`\loop...\repeat`) · **`expl3`** (la capa de programación moderna) · inyectar
otros lenguajes (**Lua** `\directlua`, **Python** `pythontex`, generar+`\input`)
· **compilación condicional** (con/sin soluciones, `comment`) · pseudocódigo
(`algorithm2e`) · buenas prácticas.

**Compilar:** `latexmk -pdf programacion.tex`.
