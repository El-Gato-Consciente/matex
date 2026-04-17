# Formalia — Diseño de contenido y taxonomía documental

> Documento curado a partir de investigación en bruto.
> Propósito: informar decisiones de producto concretas —qué bloques construir,
> qué templates ofrecer, qué convenciones enseñar al usuario.
> No es un survey académico; es un mapa de trabajo.

---

## 1. Los tipos de documento que importan para Formalia

Formalia tiene sentido para seis tipos de documento matemático. Cada uno tiene
una estructura predecible y objetos semánticos propios. Esta taxonomía informa
los **templates de arranque** y los **bloques especiales** del editor.

### 1.1 Guía de ejercicios (Problem Set / PSET)

**Quién lo usa:** estudiantes de grado, ayudantes de cátedra.
**Estructura:** encabezado institucional → lista numerada de problemas → (opcional) sección de soluciones.
**Objetos semánticos:**
- **Enunciado de problema**: plantea datos y pide un resultado. Introduce variables con "Sea $n \in \mathbb{N}$..." o "Dada la matriz $A$...".
- **Resolución**: secuencia de pasos con justificaciones intermedias.
- **Respuesta final**: resultado encuadrado o destacado.

**Template mínimo:**
```
Asignatura — Guía N°_  /  Tema: ___  /  Fecha: ___

1. [Enunciado]
   Sea $x \in \mathbb{R}$ tal que...

2. [Enunciado]
   Calcular $\int_a^b f(x)\,\mathrm{d}x$ donde...
```

---

### 1.2 Apunte de clase (Lecture Notes)

**Quién lo usa:** estudiantes que toman notas, docentes que preparan material.
**Estructura:** motivación informal → definición formal → ejemplo → observación → ejercicio propuesto.
**Objetos semánticos:**
- **Motivación/Intuición**: párrafo informal que justifica "por qué" existe el concepto.
- **Definición**: bloque destacado que nombra el objeto matemático. Es el nodo central.
- **Ejemplo ilustrativo**: instancia concreta que "aterriza" la abstracción.
- **Observación (Remark)**: conecta con otros conceptos o advierte errores frecuentes.

**Template mínimo:**
```
## Tema: ___

[Motivación — párrafo informal]
El problema de calcular ___ surge cuando...

**Definición.** Sea $X$ un ___, decimos que...

**Ejemplo.** Consideremos $f(x) = x^2$. Entonces...

**Observación.** Nótese que esta definición no implica...
```

---

### 1.3 Resolución de TP (Student Assignment)

**Quién lo usa:** estudiantes entregando trabajo práctico.
**Estructura:** identificación → réplica del enunciado → desarrollo paso a paso → conclusión.
**Objetos semánticos:**
- **Pasos de resolución**: secuencia de transformaciones de una expresión, cada paso explícitamente numerado o separado.
- **Justificación**: texto que invoca un teorema o propiedad ("por el TVM...", "aplicando Cauchy-Schwarz...").
- **Verificación**: bloque opcional donde se chequea la validez del resultado.

---

### 1.4 Examen / Evaluación

**Quién lo usa:** docentes (generación), estudiantes (resolución).
**Estructura:** header con datos del examinado → instrucciones → preguntas con puntaje → cuadro de notas.
**Objetos semánticos:**
- **Pregunta con peso**: ítem con valor en puntos asociado.
- **Opciones** (en multiple choice): distractores + respuesta correcta.
- **Espacio de respuesta**: área física/digital reservada para el alumno.

---

### 1.5 Resumen de teoría / Formulario

**Quién lo usa:** estudiantes preparando exámenes.
**Estructura:** lista de definiciones clave → teoremas enunciados (sin prueba) → fórmulas de referencia.
**Objetos semánticos:**
- Definiciones condensadas (sin motivación, solo la forma canónica).
- Teoremas sin demostración, con nombre y número si existe.
- Fórmulas listas para aplicar.

> Es el tipo de documento más "flat": poca narrativa, máxima densidad de fórmulas.
> Informa directamente la sidebar de snippets de Formalia: el usuario que hace un
> resumen usa más snippets por minuto que cualquier otro perfil.

---

### 1.6 Artículo / Nota técnica (Research Paper)

**Quién lo usa:** investigadores, estudiantes avanzados de posgrado.
**Estructura:** abstract → introducción → resultados → demostraciones → referencias.
**Objetos semánticos:**
- **Teorema / Lema / Corolario / Proposición**: unidades discretas de verdad demostrada.
- **Definición**: vocabulario nuevo que el paper introduce.
- **Demostración**: el grafo de implicaciones que conecta axiomas con el teorema.
- **Cita**: referencia al corpus externo (`[3]`, `[Rudin, 1976]`).

---

## 2. Bloques especiales que Formalia debería soportar

La taxonomía anterior converge en un conjunto pequeño de **bloques semánticos**
que van más allá de los párrafos y las fórmulas. Estos son candidatos concretos
para nodos de TipTap con estilo visual propio:

| Bloque | Estilo visual sugerido | Tipo de uso |
|---|---|---|
| `theorem` | Borde izquierdo acento, fondo leve, título "Teorema N°" | Investigación, apuntes avanzados |
| `lemma` | Similar a theorem, variante menor | Investigación |
| `corollary` | Similar a theorem, indentado | Investigación, apuntes |
| `definition` | Fondo diferenciado, título "Definición" | Apuntes, papers |
| `proof` | Sin fondo especial, cierre con ∎ | Papers, TPs |
| `example` | Borde izquierdo suave, título "Ejemplo" | Apuntes, guías |
| `remark` | Sutil, título "Observación" o "Nota" | Apuntes, papers |
| `problem` | Numerado automáticamente | Guías, exámenes |
| `solution` | Colapsable (modo socrático) | Guías con soluciones |

**Prioridad para MVP:** `definition`, `theorem`, `example`, `remark`, `problem`.
Los demás pueden venir en Fase 2.

**Modo socrático** (Fase 2): cada bloque `solution` puede tener un flag
"visible solo para el autor" que genera una versión del documento con huecos
—lista para imprimir y distribuir a alumnos.

---

## 3. Objetos matemáticos frecuentes por tipo de documento

Esta tabla informa directamente los **snippets de la sidebar** y el **orden de
presentación** en los templates. Los snippets más usados deben estar más arriba.

| Tipo de documento | Fórmulas más frecuentes | Símbolos más frecuentes |
|---|---|---|
| Guía de ejercicios | `\frac`, `\int`, `\sum`, `\lim`, `\sqrt` | $\in$, $\forall$, $\exists$, $\mathbb{R}$, $\mathbb{N}$ |
| Apunte de clase | `\frac`, matrices, `\to`, `\implies` | $\equiv$, $\subset$, $\approx$, $\leq$ |
| TP / Resolución | `align` (derivaciones), `\therefore` | $\Rightarrow$, $\square$ (QED) |
| Examen | `\frac`, `\int`, enunciados con datos | $\leq$, $\geq$, $\pm$, $\neq$ |
| Resumen de teoría | Todo — alta densidad | Todos |
| Paper | `align`, matrices, `\operatorname{}` | $\forall$, $\exists$, $\square$ |

---

## 4. Reglas tipográficas que Formalia debería enseñar

Estas son reglas estándar (ISO 80000-2 + IUPAC) que la mayoría de los usuarios
desconoce. Son correcciones reales a hábitos frecuentes. Formalia puede surfacearlas
como tooltips, hints o guías de onboarding.

### 4.1 Variables → cursiva (comportamiento default de LaTeX/KaTeX)

```
✓  $x$, $f(x)$, $A$, $\alpha$
```

Esta es la razón de ser del modo math inline. Ya es el default; no requiere acción.

### 4.2 Funciones y operadores → romano

```
✓  $\sin x$    ✗  $sin x$    (sin cursiva implica producto s·i·n·x)
✓  $\ln x$     ✗  $ln x$
✓  $\det A$    ✗  $det A$
✓  $\max$, $\min$, $\lim$, $\sup$, $\inf$
```

Impacto directo: los snippets de Formalia deben usar `\sin`, `\ln`, etc., nunca texto plano dentro de fórmulas.

### 4.3 Diferencial → romano

```
✓  $\int f(x)\,\mathrm{d}x$
✗  $\int f(x)\,dx$           (dx con d cursiva es notación imprecisa)
```

La `d` de diferencial es un operador, no una variable. Convención estándar: `\mathrm{d}` o `\,d` si se acepta la d cursiva por simplificación.

**Decisión para Formalia:** incluir en los snippets de integral la versión `\,\mathrm{d}x` como default para usuarios rigurosos, y `\,dx` como alternativa.

### 4.4 Constantes matemáticas → romano (convención formal)

```
✓  $\mathrm{e}^x$   (número de Euler como constante)
✓  $\mathrm{i}$     (unidad imaginaria)
✗  $e^x$            (e cursiva sugiere variable)
```

En la práctica, $e$ cursiva es aceptada en la mayoría de contextos educativos. Mencionarlo como convención avanzada, no como regla que bloquee al usuario.

### 4.5 Conjuntos numéricos → blackboard bold

```
✓  $\mathbb{R}$, $\mathbb{N}$, $\mathbb{Z}$, $\mathbb{Q}$, $\mathbb{C}$
✗  $R$, $N$ (ambiguo — podría ser una variable)
```

Estos ya están en los snippets de Formalia (RR, NN, ZZ shortcuts en MathLive).

---

## 5. Templates concretos para arranque rápido

Los templates de Formalia no deben ser documentos en blanco con nombre. Deben
proporcionar la **estructura con fórmulas de ejemplo editables**, para que el
usuario entienda el patrón inmediatamente.

### Template A: Guía de ejercicios

```
# Guía N° ___ — [Asignatura]
**Tema:** ___   |   **Fecha entrega:** ___

---

**1.** Sea $f : \mathbb{R} \to \mathbb{R}$ definida por $f(x) = x^2 + 1$.
Calcular $\lim_{x \to 2} f(x)$ y justificar.

**2.** Probar que para todo $n \in \mathbb{N}$:
$$\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$$

**3.** [Enunciado]
```

### Template B: Apunte con definición-ejemplo-observación

```
# [Tema]

[Motivación — 2-3 oraciones informales sobre por qué existe este concepto]

**Definición.** Sea $X$ un espacio métrico. Decimos que $A \subseteq X$
es **compacto** si toda cubierta abierta de $A$ admite una subcubierta finita.

**Ejemplo.** El intervalo $[0, 1] \subset \mathbb{R}$ es compacto
(Teorema de Heine-Borel). En cambio, $(0, 1)$ no lo es.

**Observación.** La compacidad no implica completitud en general, pero
en espacios de Banach la relación se hace más estrecha.

**Ejercicio.** Demostrar que la unión finita de compactos es compacta.
```

### Template C: Resolución de TP

```
# TP N° ___ — [Asignatura]
**Alumno:** ___   |   **Fecha:** ___

---

## Problema 1

**Enunciado.** [Copiar enunciado aquí]

**Resolución.**

Por definición de ___, tenemos:
$$[paso 1]$$

Aplicando el Teorema de ___, se sigue que:
$$[paso 2] = [resultado intermedio]$$

Por lo tanto:
$$\boxed{[resultado final]}$$
```

### Template D: Resumen de teoría

```
# Resumen — [Asignatura / Unidad]

## Definiciones clave

- **Continuidad:** $f$ es continua en $x_0$ si $\lim_{x \to x_0} f(x) = f(x_0)$.
- **Derivada:** $f'(x_0) = \lim_{h \to 0} \dfrac{f(x_0+h)-f(x_0)}{h}$

## Teoremas principales

**T1 (Valor Medio).** Si $f$ es continua en $[a,b]$ y derivable en $(a,b)$,
existe $c \in (a,b)$ tal que $f'(c) = \dfrac{f(b)-f(a)}{b-a}$.

## Fórmulas de referencia

| Fórmula | Descripción |
|---|---|
| $\int x^n\,\mathrm{d}x = \dfrac{x^{n+1}}{n+1} + C$ | Potencias |
| $\int e^x\,\mathrm{d}x = e^x + C$ | Exponencial |
```

---

## 6. Perfiles de usuario y sus necesidades en Formalia

| Perfil | Tipo de documento más frecuente | Feature clave para ellos |
|---|---|---|
| **Estudiante de grado** | Guías, TPs, resúmenes | Snippets rápidos, templates de PSET, modo "respuesta" |
| **Docente universitario** | Apuntes, exámenes, guías | Modo socrático, bloques theorem/example, exportación |
| **Estudiante avanzado / posgrado** | TFG, apuntes, papers parciales | Bloques proof/theorem, align, referencias cruzadas |
| **Investigador** | Papers, notas técnicas | Entornos AMS completos, citas, exportación LaTeX limpio |

**El perfil con mayor retención probable en MVP es el estudiante de grado**:
necesita urgentemente escribir bien, no conoce LaTeX, y la barrera de entrada
de otros editores es alta. Formalia resuelve exactamente ese problema.

---

## 7. Lo que queda fuera del MVP (con justificación)

| Feature | Por qué no MVP |
|---|---|
| Semántica computacional (sTeX/OMDoc) | Requiere que el autor codifique significado manualmente. Demasiado fricción. |
| Ontología OntoMathPro | Útil para búsqueda y grafos de conocimiento. Ningún usuario de MVP lo pide. |
| Exportación JATS XML / integración arXiv | Segmento investigador avanzado, pequeño en MVP. |
| MathML 4.0 con `intent` | Accesibilidad real, pero no bloquea MVP. Fase 2. |
| Linting semántico (símbolo antes de definir) | Feature de calidad de alto valor pero costoso. Fase 2. |
| Documentos modulares (\include, multi-archivo) | Solo relevante para tesis largas. Fase 3. |
| Citas bibliográficas (BibTeX, \cite) | Fuera del alcance actual. Fase 3. |

---

## Fuentes y decisiones editoriales

- `deep-research-report.md`: **descartado**. Información útil pero completamente redundante con las otras fuentes, orientada a audiencia académica, no a producto.
- `Investigación-Textos-Matemáticos-y-Semántica.md`: **recortado fuerte**. Incorporado: perfiles de usuario, entornos AMS, taxonomía semántica. Descartado: sTeX, OMDoc, JATS, OAI-PMH, OntoMathPro en detalle.
- `otro.research.md`: **incorporado casi completo**. Es la síntesis más limpia. La capa 4 (productividad de autoría) es el norte correcto.
- `mas.research.md`: **recortado fuerte**. Incorporado: reglas tipográficas ISO/IUPAC. Descartado: metrología, historia del SI, Unicode técnico, JATS detallado.
