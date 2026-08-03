# 01 · Visión, alcance y no-objetivos

> Documento **vivo**. Resume *qué es* Matex, *para quién*, *qué problema resuelve*
> y —tan importante— *qué no es*. Insumo histórico: [`../00-historico/`](../00-historico/).

## 1. Visión

Un **autor de documentos técnicos y matemáticos** debería poder escribir
**significado** (una definición, un teorema, una demostración por inducción, un
grafo, un autómata) sin pelear desde el primer minuto con preámbulos, paquetes y
ajustes de espaciado. **Matex** es la hipótesis de una **capa semántica** que:

- captura el documento como **estructura abstracta** (un modelo de objetos), y
- la **renderiza** con calidad tipográfica delegando la presentación a **temas y
  perfiles**, usando **LaTeX como motor de salida** (y, eventualmente, otros
  backends: HTML, EPUB).

La frase que ordena todo el proyecto:

> Expresar primero el **significado**, delegar la **carpintería** al sistema, y
> usar LaTeX como **motor tipográfico** de alta calidad.

## 2. Para quién (wedge)

El proyecto no apunta a "todos los que escriben documentos". El **wedge** —el
punto de entrada angosto y defendible— es:

- **Estudiantes y docentes de matemática en español**, que
- escriben **objetos donde LaTeX es artesanal** (demostraciones estructuradas,
  grafos/árboles/autómatas), y
- hoy no tienen una **ruta didáctica integrada** para aprender el ecosistema.

El "ecosistema completo" (editor, workspace, multi-backend, IA) es **endgame**, no
el punto de entrada. Ver [niveles de ambición](niveles-de-ambicion.md).

## 3. El problema, en concreto

LaTeX mezcla **significado y presentación**, y obliga a aprender demasiada
carpintería demasiado pronto:

- el principiante empieza ajustando márgenes y eligiendo paquetes antes de
  entender la estructura del documento;
- objetos con estructura lógica clara (una demostración, un grafo) se escriben
  como **dibujo manual** (coordenadas, líneas), perdiendo la estructura;
- no hay un **mapa conceptual** de dependencias entre temas.

## 4. Qué conserva de LaTeX

- Su **calidad tipográfica** (sigue siendo el motor).
- Su **ecosistema** y su fortaleza en **matemática**.
- Su salida a **PDF** (y vía otros backends, a más formatos).

## 5. Qué simplifica

- Preámbulos largos y selección manual de paquetes en los casos típicos.
- Manipulación de espaciados/tamaños que puede **derivarse** del tema.
- El esfuerzo sintáctico que hoy distrae del contenido.

## 6. No-objetivos (qué Matex **no** es)

Declararlos es lo que mantiene el alcance manejable:

- ❌ **No** es un motor de composición tipográfica nuevo. **LaTeX/Typst siguen
  siendo el backend.** No competimos con TeX en typesetting.
- ❌ **No** empieza por **inventar una sintaxis/gramática propia**. La superficie
  se hereda de un anfitrión (MyST/Markdown o Typst). Ver
  [03-modelo-semantico](../03-modelo-semantico/).
- ❌ **No** apunta (todavía) a ser un editor/IDE/workspace ni una plataforma SaaS.
  Eso es el nivel C, diferido.
- ⚠️ **Reencuadrado (2026-07).** Este punto decía *«cartas, CVs y pósters quedan fuera del
  wedge»*, pero ME-23 los construyó y funcionan. La regla vigente está en
  [`../03-modelo-semantico/reglas-del-modelo.md`](../03-modelo-semantico/reglas-del-modelo.md)
  §1: **son ciudadanos de primera en su estructura**, pero el **corazón que se profundiza** es
  el razonamiento matemático. Matex cubre documentos técnicos con jerarquía de profundidad, no
  "todo tipo de documento" por igual.
- ❌ **No** reemplaza a Typst/Quarto si ellos ya resuelven el caso. El valor está
  en lo que ellos **no** cubren bien (semántica de pruebas/estructuras + ruta
  didáctica en español). Ver [02-estado-del-arte](../02-estado-del-arte/).

## 7. Cómo sabremos que vale la pena (criterio de éxito)

La tesis se valida —o no— con evidencia, no con teoría:

1. Un **vertical slice** (demostraciones estructuradas) se escribe en la capa
   semántica y rinde a PDF y HTML con calidad aceptable. *(Prueba técnica.)*
2. Un autor real **prefiere** escribir ese objeto en la capa semántica antes que
   en LaTeX/Typst crudo. *(Prueba de valor.)*

Si (1) y (2) se cumplen, hay proyecto. Si no, se replantea el alcance (pivot a
"plataforma de enseñanza" pura, que vale por sí sola).
