# 4 · Gráficos y figuras

> **Estado:** ✅ **listo** (`graficos.tex` → `graficos.pdf`, 7 pp) ·
> **Nivel 2 (Capacidades)** · clase `article` ·
> [suite](../README.md) · [TEMARIO](../TEMARIO.md#4-gráficos-y-figuras)

Insertar imágenes y, sobre todo, **graficar funciones y datos** con `pgfplots`,
sin salir de LaTeX. Formato código → resultado.

**Contenido:** vectorial vs raster · imágenes externas (`graphicx`) · entorno
`figure` (caption/label/posición) · subfiguras · TikZ básico · **graficar
funciones** con `pgfplots` (dominio, samples, varias curvas, leyenda) · recursos
de análisis (marcar puntos, asíntotas, **área bajo la curva** con `fillbetween`)
· graficar datos (coordenadas/tablas/archivo) · **diagramas conmutativos**
(`tikz-cd`) · externalización para velocidad · buenas prácticas.

**Compilar:** `latexmk -pdf graficos.tex`.
