# 07 · Informes e insumos

Informes de investigación y estudios previos que **alimentaron** decisiones de diseño.
Estaban sueltos en la raíz del repo; viven acá para que la raíz quede limpia y para que se
vea de dónde salió cada cosa.

> **No son fuente de verdad.** Son el insumo; lo que se decidió y construyó a partir de
> ellos está en [`../06-backlog/backlog.md`](../06-backlog/backlog.md) y en
> [`../03-modelo-semantico/`](../03-modelo-semantico/). Cuando un informe contradiga al
> backlog, manda el backlog.

| Archivo | Qué es | Qué produjo |
|---------|--------|-------------|
| `cartografia_semantica_graficos_latex.md` | Taxonomía de gráficos **por intención** (no por paquete). | `03-modelo-semantico/graficos-cartografia-semantica.md` → todo el módulo de gráficos (ME-25..28). |
| `informe_graficos_latex_v2.pdf` | Taxonomía de gráficos **por paquete** LaTeX. | Insumo de la cartografía, junto al anterior. |
| `matex-graficador-2d-informe.md` | Roadmap del graficador 2D (roles semánticos, rasgos, regiones, cónicas, interacción). | ME-38..45 (§ citados ítem por ítem en el backlog). |
| `metodos_graficar_implicitas.md` | Métodos para trazar `F(x,y)=0`. | ME-18 (implícitas) — citado desde `core/graphics/implicit.ts`. |
| `informe-intersecciones-geometricas.md` | Intersecciones de curvas y bases de coordenadas. | ME-31 (intersecciones) y FIX-06. |
| `matex_with_python.md` | Primer borrador de código ejecutable embebido. | Consolidado en `03-modelo-semantico/nodos-ejecutables-propuesta.md`; backlog **LE-05** (en el tintero). |
| `matex-nodos-ejecutables-informe.md` | Segundo informe sobre nodos ejecutables. | Idem anterior; derivó también en **LE-06** (cómputo declarativo). |
| `matex-curricula-python-matematico.md` | Currícula para enseñar Python a través de la matemática, sobre documentos Matex. | Nada todavía — idea abierta, dependiente de LE-05. |
| `demo-pyodide.html` | Demo standalone de ejecución Python en el navegador (Pyodide). | Prueba de concepto de LE-05. |
| `fractales.md` | Estudio de generación de fractales con el motor de LaTeX. | Nada todavía — investigación suelta. |
