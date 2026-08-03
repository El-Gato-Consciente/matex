# 00 · Histórico (congelado)

> 🔒 **Estos documentos son solo históricos.** Son la **lluvia de ideas original**
> del proyecto Matex. Se conservan como registro del razonamiento, **no como
> fuente de verdad**. No editarlos para reflejar decisiones nuevas: para eso están
> los documentos vivos en [`01-vision/`](../01-vision/),
> [`02-estado-del-arte/`](../02-estado-del-arte/),
> [`03-modelo-semantico/`](../03-modelo-semantico/) y [`04-roadmap/`](../04-roadmap/).

## Qué hay acá

| Documento | Qué aportó |
|-----------|------------|
| [informe_matex_plataforma_y_latex.md](informe_matex_plataforma_y_latex.md) | Primer ordenamiento: capas conceptuales del ecosistema, idea de Matex, plataforma y modelo de desarrollo por etapas. |
| [matex_ideas_documento.md](matex_ideas_documento.md) | Niveles de enseñanza, distinción semántica/carpintería/infraestructura, rol de clases y paquetes, la "pregunta abierta" sobre la frontera semántica. |
| Informe complementario … más allá de LaTeX (PDF) | Visión ampliada: LaTeX como *un* backend, interactividad, objetos semánticos de alto nivel, versiones de documento, IA, "documento como aplicación", ecosistema completo. |

## Cómo se usó este material

Las ideas se depuraron, se confrontaron con el estado del arte y se reorganizaron
en los documentos vivos. Síntesis del cambio respecto de estos borradores:

- **Se conserva:** la ontología de 6 capas, la pedagogía "significado → forma →
  carpintería", el puente didáctico "ver el LaTeX generado", y la semántica de
  dominio (pruebas, grafos, autómatas).
- **Se reordena:** el activo central pasa a ser el **modelo semántico / AST**, no
  el lenguaje. **No se inventa gramática**; la sintaxis de superficie se hereda de
  un anfitrión.
- **Se agrega lo que faltaba:** **estado del arte y diferenciación** (Typst,
  Pandoc, Quarto/MyST, DocBook/DITA…), **no-objetivos**, separación de **tres
  niveles de ambición** y un **vertical slice** como prueba de tesis.
