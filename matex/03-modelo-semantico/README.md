# Modelo semántico — índice, roles y jerarquía de verdad

> **Por qué existe este índice.** Esta carpeta acumuló ~15 documentos que cubren el modelo desde
> ángulos distintos (referencia, reglas, visión, spec, análisis). Sin un mapa, es fácil no saber
> **cuál manda si dos se contradicen** — que es de donde nace el drift. Este README asigna **un rol
> a cada doc** y declara la **jerarquía de fuente-de-verdad**. Regla de oro: **cada doc tiene un rol;
> si dos dicen cosas distintas sobre lo mismo, gana el de mayor autoridad para *ese* tipo de afirmación
> (ver §3).**

---

## 1 · Los documentos, por rol

### Ⓡ Referencia — lo que YA existe y compila
| Doc | Qué es |
|-----|--------|
| [`referencia-v1.md`](referencia-v1.md) | El AST **real, implementado** (v1). Fuente de verdad de lo que *existe hoy*. |
| [`modelo-semantico.md`](modelo-semantico.md) | Overview del modelo semántico (el activo central) — puerta de entrada conceptual. |

### Ⓒ Constitucional — dónde vive cada decisión y cómo se comporta el sistema
| Doc | Qué es |
|-----|--------|
| [`reglas-del-modelo.md`](reglas-del-modelo.md) | **Las 4 reglas** (AST · política compartida · ocasión de emisión · recursos). El texto constitucional: dónde cae cada decisión. |
| [`computo-y-capas.md`](computo-y-capas.md) | Las **4 capas** (AST→resolución→backends→editor) + el **ciclo de vida** (qué corre cuándo) + el principio "AST=intención, lo derivado se computa". Racional del cómputo; extiende las reglas. |

### Ⓥ Visión / racional — el norte y el porqué (no normativo)
| Doc | Qué es |
|-----|--------|
| [`nodos-ejecutables-propuesta.md`](nodos-ejecutables-propuesta.md) | El espectro de cómputo (Nivel 0→2), el reencuadre de `verify`. La motivación. |
| [`entorno-de-entidades-estudio.md`](entorno-de-entidades-estudio.md) | **Estudio** (futuro/diferido): Matex como entorno de entidades; reactividad, orden de ejecución, la bisagra Python-función-pura, ciclos, dos regiones. Razonamiento de diseño. |

### Ⓝ Normativo — qué debe cumplir la implementación (nodos ejecutables / entorno)
| Doc | Qué es | Estado |
|-----|--------|--------|
| [`spec-nodos-ejecutables-matex-borrador.md`](spec-nodos-ejecutables-matex-borrador.md) | **El spec** — invariantes I1-I9, modelo de datos, contrato `emit_*`, ejecución, errores, verificación. **Fuente de verdad del *qué*** para esta extensión. | 🟡 borrador **auditado** (ver Ⓐ) |
| [`spec-nodos-ejecutables-matex-addendum-01.md`](spec-nodos-ejecutables-matex-addendum-01.md) | Extensiones al spec (`emit_fragment`, clases isomorfas, multipass refinado). **Propuestas, no fusionadas** (su §20 lista el merge). | 🟡 propuesto |
| [`metadocumento-especificacion-diseno.md`](metadocumento-especificacion-diseno.md) | El **esqueleto** con que se escribe el spec. Meta, no decide nada. | — |

### Ⓐ Análisis / soporte — informa, no decide
| Doc | Qué es |
|-----|--------|
| [`matex-analisis-comparativo-estado-del-arte.md`](matex-analisis-comparativo-estado-del-arte.md) | Matex vs. Jupyter/Quarto/Typst/Marimo. **⚠️ claims competitivos sin verificar contra fuente** — tratar como hipótesis. |
| [`gemini-vs-matex-cotejo.md`](gemini-vs-matex-cotejo.md) | Cotejo de una charla con Gemini vs. lo ya decidido. Valida; aporta el multipass. |
| [`../08-auditoria/auditoria-spec-nodos-ejecutables.md`](../08-auditoria/auditoria-spec-nodos-ejecutables.md) | **La auditoría** del spec/addendum/comparativo (venían de afuera del ecosistema). |

### Ⓕ Diseño de subsistemas — features concretas
| Doc | Qué es |
|-----|--------|
| [`graficos-cartografia-semantica.md`](graficos-cartografia-semantica.md) · [`graficos-funciones.md`](graficos-funciones.md) | El módulo de gráficos (cartografía por intención; figuras/funciones). |
| [`ecuaciones-multilinea.md`](ecuaciones-multilinea.md) | Ecuaciones multilínea (filas con identidad). |
| [`proyecto-multiarchivo.md`](proyecto-multiarchivo.md) | Proyecto multi-archivo (ME-12). |

---

## 2 · Orden de lectura (para alguien nuevo)

1. [`modelo-semantico.md`](modelo-semantico.md) — de qué va todo.
2. [`reglas-del-modelo.md`](reglas-del-modelo.md) — el marco (dónde vive cada decisión).
3. [`computo-y-capas.md`](computo-y-capas.md) — las capas + el ciclo de vida.
4. [`referencia-v1.md`](referencia-v1.md) — lo que hay hoy, concreto.
5. Para el **futuro** (cómputo en el documento): [`nodos-ejecutables-propuesta.md`](nodos-ejecutables-propuesta.md) (por qué) → [`entorno-de-entidades-estudio.md`](entorno-de-entidades-estudio.md) (racional) → [`spec-nodos-ejecutables-matex-borrador.md`](spec-nodos-ejecutables-matex-borrador.md) (qué debe cumplir).

---

## 3 · Jerarquía de verdad — quién gana si dos docs se contradicen

Según **el tipo de afirmación**:

| Sobre... | Manda | Por qué |
|----------|-------|---------|
| **Lo que existe/compila hoy** | Ⓡ [`referencia-v1.md`](referencia-v1.md) | Es la realidad implementada; si un spec la contradice, la realidad gana. |
| **Dónde vive una decisión / la filosofía del modelo** | Ⓒ [`reglas-del-modelo.md`](reglas-del-modelo.md) | El texto constitucional. `computo-y-capas` lo extiende, no lo contradice. |
| **El *qué* normativo de nodos ejecutables / entorno** | Ⓝ [`spec-borrador`](spec-nodos-ejecutables-matex-borrador.md) (auditado) | Es el contrato veteado; los docs Ⓥ (visión) son el *porqué*, no el *qué*. |
| **El *porqué* / la motivación / el norte** | Ⓥ visión | Explican la dirección; para una decisión concreta, defieren a Ⓒ y Ⓝ. |
| **Datos sobre la competencia** | *nadie todavía* | Ⓐ comparativo está **sin verificar**; son hipótesis hasta confirmar fuente. |

**Reglas anti-drift:**
- Un doc Ⓥ (visión/racional) que repita una decisión normativa **apunta al spec/reglas para el *qué***
  y se queda con el *porqué* — no duplica la decisión (así no pueden separarse en silencio).
- Nada `🟡` (propuesto) se cita como "verdad": es candidato hasta ratificarse.
- Lo que viene **de afuera del ecosistema** (spec-borrador, addendum, comparativo) **no entra por
  confianza; entra por auditoría** — ver Ⓐ.
- Un nodo/campo nuevo se decide con la **Regla 4** de `reglas-del-modelo.md`, no por conveniencia.

---

## 4 · Estado (2026-07-22)

- **Implementado (Ⓡ):** `referencia-v1` + el módulo de gráficos + ecuaciones + multi-archivo.
- **Constitucional (Ⓒ):** cerrado y vigente.
- **Futuro (Ⓥ/Ⓝ):** **diferido, estratégico.** El spec es borrador *auditado*; nada de esto compila
  aún (`referencia-v1` no tiene ningún nodo ejecutable). Madura **con la implementación real**, no
  llenando secciones en abstracto (ver el propio spec, §13 preguntas abiertas).
- **Pendiente de orden:** reconciliación fina (los Ⓥ apuntan al spec para el *qué*) y el merge del
  addendum al spec (su §20) — cuando el spec pase de borrador a v1.
