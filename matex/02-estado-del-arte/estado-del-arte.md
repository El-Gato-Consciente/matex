# 02 · Estado del arte y diferenciación

> Documento **vivo**. Los borradores históricos están escritos como si Matex fuera
> terreno virgen. **No lo es.** Casi cada idea individual ya existe en un sistema
> que se usa hoy. Esto no mata el proyecto: define **dónde está la novedad real** y
> evita reinventar peor algo que ya existe.

## 1. Por qué este documento es obligatorio

Sin un mapa del estado del arte, la propuesta **no se puede evaluar ni priorizar**:
no se sabe qué construir, qué reusar y qué diferenciar. La regla:

> Antes de escribir una línea de "Matex", hay que poder responder: *¿en qué se
> diferencia esto de Typst / Quarto / Pandoc, y por qué no uso directamente uno de
> ellos?*

## 2. Mapa: cada idea de los históricos → dónde ya existe

| Idea en los documentos Matex | Ya existe (maduro) en |
|------------------------------|-----------------------|
| Semántico-first, carpintería en **temas/perfiles**, preview instantáneo, compila a PDF | **Typst** |
| **Fuente semántica → muchos backends** con *fallback* degradado | **Pandoc** (su AST **es** esa filosofía); **DocBook/DITA** |
| Markdown semántico + **directivas/roles**, multi-backend (PDF vía LaTeX, HTML, EPUB), ejercicios, **versión estudiante/docente**, referencias cruzadas, "el documento se conoce a sí mismo" | **Quarto / MyST / Jupyter Book** |
| **Matemática dinámica** / cálculo simbólico durante la compilación | **pythontex / sagetex / Quarto + Jupyter** |
| **Documento como aplicación**, interactivo con *fallback* estático | **Idyll, Distill, Observable, Curvenote** |
| **Versiones** del mismo fuente (con/sin soluciones) = *profiling* condicional | **DITA profiling**; en LaTeX, `comment`/banderas |
| **Demostraciones estructuradas / verificables** | **Lean / Coq / Isabelle**; structured proofs (Lamport) |
| Documento **programable** / como programa | **Scribble (Racket), Pollen, Org-mode** |
| **IA sobre el AST**, navegación semántica | Tendencia activa en Quarto/MyST + LSPs; nada cerrado |

## 3. Los tres sistemas que más se solapan

### Typst
Lenguaje de marcado **semántico-first** moderno, con **scripting**, **temas**,
compilación **casi instantánea** y hoja de ruta multi-formato. Es,
aproximadamente, **el 70 % de lo que los históricos describen como "Matex"**.
*Implicancia:* si el objetivo es "semántico que compila lindo", Typst ya lo es.

### Pandoc
Define un **AST universal de documentos** y lo emite a decenas de formatos, cada
uno con las capacidades que tiene (*fallback*). La "filosofía de los backends" del
informe complementario **es literalmente el diseño de Pandoc**.
*Implicancia:* el "modelo semántico → multi-backend" no hay que inventarlo; se
puede **construir sobre el AST de Pandoc** (un reader + filtros + extensión del
AST) y heredar todos los backends.

### Quarto / MyST
Markdown técnico con **directivas/roles** extensibles, ejecución de código,
referencias cruzadas, salida a PDF/HTML/EPUB/DOCX, **perfiles** (estudiante/
docente) y *cross-refs* semánticas. Es ~**80 % de la "plataforma + multi-backend
+ fallback"**.
*Implicancia:* la sintaxis de superficie de Matex puede ser una **directiva MyST**,
heredando parser, editor y ecosistema.

## 4. Dónde está, entonces, la novedad real

No en los primitivos. En **la combinación**, acotada al wedge:

1. **Semántica de dominio matemático profunda** —sobre todo **demostraciones como
   estructura** (objetivo·hipótesis·casos·lemas·pasos·conclusión), grafos,
   árboles, autómatas— que Typst/Quarto **no** modelan bien de fábrica.
2. **Ruta didáctica integrada en español** para el ecosistema TeX, que hoy está
   dispersa.
3. La **unión** de ambas: aprender, escribir y publicar alrededor de un mismo
   modelo semántico, con el puente "ver el LaTeX generado".

## 5. Consecuencia estratégica

- **No greenfield.** La pregunta de diseño no es "¿qué sintaxis invento?" sino
  **"¿extiendo Typst, monto sobre MyST/Pandoc, o construyo encima?"**.
- La gramática propia es el **peor retorno** del plan: reimplementaría parser,
  editor, errores y ecosistema que ya existen, sin aportar al modelo semántico
  (que es el activo). Ver [03-modelo-semantico](../03-modelo-semantico/).

## 6. Barrido práctico pendiente (acción concreta)

Marco listo; falta la evidencia de primera mano. **Próximo paso del
[04-roadmap](../04-roadmap/):** portar [matematica.tex](../../latex/3-matematica/matematica.tex)
a **Typst** y a **Quarto/MyST**, y anotar:

- qué se expresa **más limpio** que en LaTeX,
- qué objeto matemático **sigue siendo artesanal** en ambos (ahí está el hueco de Matex),
- cuánto preámbulo/carpintería **desaparece** de verdad.

| Sistema | Portado | Notas |
|---------|:------:|-------|
| Typst | ⬜ | — |
| Quarto/MyST | ⬜ | — |
