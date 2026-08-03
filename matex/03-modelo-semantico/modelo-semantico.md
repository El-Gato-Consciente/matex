# 03 · Modelo semántico (el activo central)

> Documento **vivo**, en **borrador**. Es el corazón del proyecto: lo que hay que
> formalizar **primero**. No es una gramática; es el **modelo de objetos** del
> documento (su AST / schema). La sintaxis de superficie viene después y se
> hereda.
>
> ⚠️ **Este documento es VISIÓN** (el norte, ambicioso: `demostracion` estructurada,
> `grafo`, `automata`…). Lo **realmente implementado y que compila** —el catálogo de
> nodos v1, la proyección a backends y las decisiones de diseño— vive en la
> **[Referencia del modelo v1](./referencia-v1.md)** (versionada con el AST). No
> confundir *lo que queremos* (acá) con *lo que es* (la Referencia).
>
> 📐 **Cómo se decide qué va acá:** las cuatro reglas de
> **[`reglas-del-modelo.md`](./reglas-del-modelo.md)** — alcance, los cuatro lugares donde puede
> vivir una configuración, la política compartida entre backends, y la regla de admisión de
> campos. Es la respuesta operativa a la "pregunta abierta" del §5 de este documento.

## 1. Tesis de diseño

> **Se formaliza el modelo, no el lenguaje.** El orden correcto es:
> **(1) modelo de objetos → (2) sintaxis de superficie heredada → (3) gramática
> propia solo si hace falta y el modelo ya es estable.**

Por qué, en una línea: el valor del proyecto es **representar conocimiento de
forma estructurada e independiente del medio**. Eso vive en el modelo. La sintaxis
es una **serialización** de ese modelo y es intercambiable; inventarla primero es
gastar en lexer/parser/editor/errores sin tocar el activo.

## 2. Las 6 capas (heredadas de los históricos) como organización del modelo

La ontología de los borradores es buena y se convierte en los **espacios de
nombres** del modelo. Cada nodo del documento pertenece a una capa:

| # | Capa | Pregunta | Ejemplos de nodos |
|:-:|------|----------|-------------------|
| 1 | **Semántica de contenido** | ¿qué estoy diciendo? | `definicion`, `teorema`, `demostracion`, `ejemplo`, `observacion`, `ecuacion`, `grafo`, `arbol`, `automata`, `tabla-datos` |
| 2 | **Semántica de documento** | ¿qué clase de documento? | `articulo`, `libro`, `tesis`, `apunte`, `presentacion` |
| 3 | **Especialización de dominio** | ¿de qué área? | vocabularios: matemática, lógica, algoritmos, química |
| 4 | **Carpintería tipográfica** | ¿cómo se ve? | **no son nodos del autor**: viven en el **tema/perfil** |
| 5 | **Infraestructura técnica** | ¿con qué se produce? | motor, paquetes, build — **derivado**, no escrito a mano |
| 6 | **Backend de salida** | ¿a qué formato? | LaTeX, PDF, HTML, EPUB — destino del render |

**Regla de oro:** el autor escribe en las capas **1–3** (significado). Las capas
**4–6** se **derivan** del tema, el perfil y el backend. Esa es exactamente la
separación "significado vs. carpintería".

## 3. Qué hay que especificar (forma del schema)

Para cada **tipo de nodo**:

- **atributos** (p. ej. `teorema`: `nombre?`, `etiqueta?`, `enunciado`);
- **reglas de contención** (qué puede contener; p. ej. `demostracion` contiene
  `hipotesis`, `caso*`, `paso*`, `conclusion`);
- **referencias cruzadas** (un `paso` puede citar un `lema`; un `teorema` puede
  referenciar una `definicion`);
- **proyección a cada backend** (cómo se renderiza en LaTeX, en HTML…), incluido
  el ***fallback*** cuando un backend no puede representarlo plenamente.

Formato sugerido: **tipos algebraicos / JSON Schema**, no BNF. Candidato fuerte:
**extender el AST de Pandoc** para heredar backends (ver
[02-estado-del-arte](../02-estado-del-arte/#3-los-tres-sistemas-que-más-se-solapan)).

## 4. Ejemplo: el nodo `demostracion` (el primer objeto a modelar)

Es el objeto más valioso para empezar (donde LaTeX es más artesanal). Esbozo
**ilustrativo** del modelo (no es sintaxis final):

```yaml
demostracion:
  de: <ref a teorema>          # qué demuestra
  estrategia: induccion | directa | contradiccion | casos | ...
  hipotesis: [ <enunciado>... ]
  cuerpo:
    - caso: { condicion, pasos: [...] }      # 0..n
    - paso: { afirmacion, justifica: <ref a lema|def|paso> }   # 0..n
  conclusion: <enunciado>
```

Proyecciones:

- **LaTeX** → entorno `proof` (amsthm) + estructura visible (lista de pasos,
  `\qedhere`), referencias vía `\cref`.
- **HTML** → bloques plegables, pasos navegables, *hover* sobre `justifica`.
- ***Fallback* PDF** → demostración lineal completa, sin interacción.

Esto habilita lo que los históricos pedían: **visualizar la estructura lógica de
la prueba**, detectar **teoremas sin demostración**, navegar dependencias.

## 5. La frontera semántica ↔ carpintería (la "pregunta abierta")

Los históricos la dejan como *la* pregunta central: **¿qué se expresa como
semántica de alto nivel y qué queda como carpintería configurable?** Decisión de
método:

> **Es empírica, no de escritorio.** La frontera se descubre construyendo
> *vertical slices* y observando qué tocan los autores. Cada vez que un autor
> necesita "bajar a la carpintería" para algo frecuente, ese algo es candidato a
> **subir** al modelo (o al tema).

## 6. Estado y siguiente

- ✅ Capas como organización del modelo.
- 🟡 Schema del nodo `demostracion` (esbozo; falta cerrar atributos y *cross-refs*).
- ⬜ Schemas de `grafo`, `arbol`, `automata`.
- ⬜ Decisión de substrato: extender Pandoc AST vs. MyST vs. Typst (depende del
  barrido del [02-estado-del-arte](../02-estado-del-arte/#6-barrido-práctico-pendiente-acción-concreta)).

> **No avanzar a "diseño de gramática" hasta** que el schema de al menos un objeto
> esté cerrado y validado por el vertical slice del [04-roadmap](../04-roadmap/).
