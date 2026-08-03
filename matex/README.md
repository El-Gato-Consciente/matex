# Proyecto Matex

**Matex** parte de una hipótesis: el autor de un documento técnico debería describir
*qué* quiere expresar (definiciones, teoremas, demostraciones, derivaciones, gráficos)
y el sistema decidir *cómo* construirlo, delegando la carpintería tipográfica y usando
**LaTeX como uno de los backends de salida**, no como el lenguaje de autoría.

> Este README es el **hub** de la documentación. Para el detalle, entrá a cada carpeta.
> Para orientarte en el **código**, ver [`../CLAUDE.md`](../CLAUDE.md).

---

## Estado: la tesis está probada (2026-07)

El **mismo AST** (`matex-core`) compila hoy a **PDF** (`compileToLatex`), **HTML**
(`compileToHtml`) y **SVG** — un modelo semántico, tres salidas de calidad. Encima del AST
hay un **editor visual** (TipTap) completo, con módulo de gráficos maduro, y una cobertura
exhaustiva: **11/11 ejemplares** de la galería y **12/12 plantillas** tienen versión Matex,
sobre **6 modos de documento** (artículo · presentación · carta · examen · CV · póster).

### El reencuadre que hay que entender

La versión original de este proyecto se preguntaba qué **sintaxis** debía tener el lenguaje
Matex, y contemplaba tomarla prestada de un anfitrión (MyST/Markdown o Typst). **Eso quedó
descartado.**

> **Matex no necesita un lenguaje con sintaxis propia.** La superficie de autoría es el
> **editor visual**; el "lenguaje" **ES el AST**. No competimos con Typst *como lenguaje*:
> somos AST + editor + varios backends.

Por eso la vieja compuerta "¿plataforma o lenguaje?" se disolvió, y el trabajo de "nivel B"
pasó a ser **que el AST sea bueno** (semántico, agnóstico del backend) y probarlo con un
segundo backend real — lo que ya ocurrió.

---

## Mapa de la documentación

| # | Carpeta | Qué contiene | Estado |
|:-:|---------|--------------|:------:|
| 00 | [`00-historico/`](00-historico/) | Los documentos originales de lluvia de ideas. **Solo histórico** (insumo, no fuente de verdad). | 🔒 congelado |
| 01 | [`01-vision/`](01-vision/) | Visión, alcance, **no-objetivos** y los tres niveles de ambición (A/B/C). | ✅ · ⚠️ anterior al reencuadre |
| 02 | [`02-estado-del-arte/`](02-estado-del-arte/) | Prior art y diferenciación (Typst, Pandoc, Quarto/MyST, DocBook/DITA…). | ✅ marco · ⬜ barrido práctico (LE-01, opcional) |
| 03 | [`03-modelo-semantico/`](03-modelo-semantico/) | **El activo central**: ontología de 6 capas, cartografía de gráficos, multi-archivo, nodos ejecutables. | ✅ implementado en `matex-core` |
| 04 | [`04-roadmap/`](04-roadmap/) | Orden de trabajo y compuertas de decisión originales. | ⚠️ superado por el backlog |
| 05 | [`05-plataforma/`](05-plataforma/) | Spec de la plataforma de enseñanza (nivel A) y spec del editor visual (nivel C). | ✅ construido |
| 06 | [`06-backlog/`](06-backlog/) | **[`backlog.md`](06-backlog/backlog.md) — la fuente de verdad operativa**: inventario de lo hecho y lo pendiente, con IDs, prioridad y esfuerzo, más la bitácora de decisiones y gotchas. | ✅ vivo |
| 07 | [`07-informes/`](07-informes/) | Informes de investigación que **alimentaron** decisiones (gráficos, implícitas, nodos ejecutables). Insumo, no fuente de verdad. | 📚 referencia |
| 08 | [`08-auditoria/`](08-auditoria/) | **Auditorías del estado real** + el plan que sale de ellas. [Auditoría](08-auditoria/auditoria-2026-07-21.md) → [contra-informe](08-auditoria/contra-informe-2026-07-21.md) (la revisa **ejecutando** lo que ella solo contó; el segundo corrige al primero) → **[plan de acción](08-auditoria/plan-de-accion-2026-07.md)**, ordenado por qué habilita qué. | 🔎 diagnóstico |

> **Leyenda:** ✅ listo · 🟡 en proceso · ⬜ pendiente · 🔒 congelado · 📚 referencia ·
> 🔎 diagnóstico · ⚠️ leer con fecha en mano.
>
> Los documentos marcados ⚠️ **no están mal, están fechados**: describen decisiones previas
> al reencuadre de julio. Cuando contradigan al backlog, **manda el backlog**.

---

## Qué leer según lo que necesites

- **"¿Dónde estamos y qué sigue?"** → [`06-backlog/backlog.md`](06-backlog/backlog.md),
  directo a la sección final **"Cómo decidir qué sigue"**.
- **"¿Por qué el modelo es así?"** → [`03-modelo-semantico/`](03-modelo-semantico/)
  (`modelo-semantico.md` para la ontología, `graficos-cartografia-semantica.md` para la
  clasificación de gráficos por intención).
- **"¿Dónde va esta configuración / debería agregar este campo?"** →
  [`03-modelo-semantico/reglas-del-modelo.md`](03-modelo-semantico/reglas-del-modelo.md): las 4
  reglas (alcance · los 4 lugares · política compartida · admisión de campos).
- **"¿Cómo corro esto?"** → [`../CLAUDE.md`](../CLAUDE.md).
- **"¿Por qué no hicimos X?"** → los **anti-ítems** del backlog (ME-19, LE-01) y los
  no-objetivos de [`01-vision/`](01-vision/).
- **"¿Qué está mal hoy?"** → la [auditoría](08-auditoria/auditoria-2026-07-21.md): hallazgos
  ponderados, separando lo **medido** de lo que es **juicio de diseño**.

---

## Relación con la suite `latex/`

La carpeta hermana [`../latex/`](../latex/) es una **suite de documentos *sobre* LaTeX**
(12 docs + `TEMARIO.md`). Es **insumo y laboratorio**: alimentó las 51 lecciones del curso
y sus ejemplos sirven para probar el modelo semántico. Matex es otra cosa: no documenta
LaTeX, propone una capa por encima.

---

## Los tres frentes vivos

1. **Consolidar la calidad** — lo que salió de la [auditoría](08-auditoria/auditoria-2026-07-21.md):
   unificar la numeración (hoy implementada 3×), modelar las familias de documento como unión
   discriminada, y partir los tres archivos gigantes del editor.
2. **Hacerlo desplegable** — hoy el producto solo existe en la máquina del autor
   (`localStorage`, backend sin sandbox): RB-02 → RB-03 → RB-05 → FE-01.
3. **Profundizar Matex** — LE-06 (cómputo declarativo), con una decisión previa pendiente:
   qué hacer con las **dos representaciones de la matemática** (§F-3 de la auditoría).
4. **Contenido y pulido** — CO-01, PL-01 y la espiral pedagógica (CO-07).

> LE-02 (agnosticismo del AST) quedó **cerrado** el 2026-07-21.

El detalle y el orden recomendado, en la sección **"Cómo decidir qué sigue"** del backlog.
