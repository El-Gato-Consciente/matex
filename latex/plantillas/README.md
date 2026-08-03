# Plantillas

> **Estado:** ✅ **listo** (`article.tex`, `beamer.tex` — ambas compilan) ·
> **Nivel 5 (Recursos)** · [suite](../README.md)

Preámbulos **estándar listos para copiar**, comentados línea por línea. Aplican
la base recomendada del documento [Estándares](../estandares/) y sirven de punto
de partida para cualquier trabajo.

| Archivo | Clase | Para |
|---------|-------|------|
| `article.tex` | `article` | TPs, informes, apuntes de matemática |
| `beamer.tex`  | `beamer`  | presentaciones |

Cada plantilla trae un cuerpo de ejemplo (secciones, matemática, teorema,
figura `pgfplots`, tabla `booktabs`) que se borra y reemplaza por el contenido
propio.

**Uso:** copiá el archivo, renombralo y compilá con `latexmk -pdf <archivo>.tex`.
