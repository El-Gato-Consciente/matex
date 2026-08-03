# 01 · Tres niveles de ambición (A / B / C)

> Los documentos históricos enredan **tres proyectos de tamaño muy distinto** en
> uno. Separarlos es clave: cada uno tiene su propio valor, costo y **go/no-go**.
> No hace falta comprometerse con C para empezar por A.

## Resumen

| Nivel | Qué es | Costo aprox. | Riesgo | Valor si se queda ahí |
|:-----:|--------|--------------|:------:|-----------------------|
| **A** | **Plataforma de enseñanza** sobre la suite `latex/` ya existente | semanas–meses | bajo | Alto: un recurso didáctico que hoy no existe bien en español |
| **B** | **Matex como capa semántica** para 2–3 dominios (pruebas, grafos) | meses | medio | Medio–alto: resuelve donde LaTeX/Typst son flojos |
| **C** | **Ecosistema completo** (lenguaje + compilador + editor + workspace + multi-backend + IA + colaboración) | años-persona | alto | Endgame; compite con productos financiados |

## Nivel A — Plataforma de enseñanza

**Qué.** Una web para aprender el ecosistema TeX por **niveles** con
preview inmediato, ejercicios autocorregibles y el puente **"ver el LaTeX
generado"**.

**Por qué primero.** El contenido **ya existe**: la suite [`../../latex/`](../../latex/)
(12 docs + `TEMARIO.md`) es un mapa de conocimiento con prerrequisitos. Es el
camino de **menor riesgo y valor inmediato**, y es el **laboratorio** que revela
qué conviene abstraer en la capa semántica.

**Vale por sí solo aunque B y C nunca se hagan.**

## Nivel B — Matex como capa semántica (no como lenguaje)

**Qué.** Un **modelo de objetos** (schema) para unos pocos dominios donde las
herramientas actuales son débiles —**demostraciones estructuradas**, grafos,
árboles, autómatas— con una **sintaxis de superficie heredada** (directiva MyST o
función Typst), que rinde a PDF + HTML.

**Por qué.** Es la parte **genuinamente novedosa** y se puede probar como un
**vertical slice** (un objeto, de punta a punta) en semanas, no años. Ver
[04-roadmap](../04-roadmap/).

**Clave:** B **no** es "diseñar un lenguaje". Es formalizar un modelo y montarlo
sobre un anfitrión. Ver [03-modelo-semantico](../03-modelo-semantico/).

## Nivel C — Ecosistema completo

**Qué.** Lenguaje propio + compilador + editor + workspace/IDE documental +
multi-backend con *fallback* + navegación semántica + versiones (estudiante/
docente/web) + colaboración + IA sobre el AST + "documento como aplicación".

**Realidad.** Es **5–10 años-persona** y compite con **Typst** (con inversión) y
**Quarto** (con Posit detrás). Es un destino, no un plan de arranque.

**Decisión.** **Diferido** hasta que B demuestre tracción real (criterio de éxito
en [vision-y-alcance](vision-y-alcance.md#7)). Las ideas de C se conservan como
norte, no como backlog inmediato.

## Orden recomendado

```
A (plataforma)  →  B (slice semántico)  →  [compuerta: ¿valida la tesis?]  →  C
        \____________ se informan mutuamente ____________/
```

A y B pueden avanzar en paralelo parcial: A genera el laboratorio y los usuarios;
B usa ese contexto para elegir y validar el primer objeto semántico.
