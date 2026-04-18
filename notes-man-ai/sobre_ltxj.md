Que implica que en este proyecto el .ltxj sea solo el formato que te da tiptap? Esto es más importante de lo que parece a primera vista. Voy a desglosarlo con cuidado porque toca el núcleo del diseño.

---

## El trade-off central

Tiptap's `getJSON()` devuelve algo así:

```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Sea" }] },
    { "type": "mathDisplay", "attrs": { "latex": "\\int_0^1 f(x)\\,dx", "numbered": false } }
  ]
}
```

La pregunta es: **¿eso es `.ltxj`, o `.ltxj` es algo distinto que convive con eso?**

---

## Pros de usar el JSON de Tiptap directamente como `.ltxj`

**1. Cero fricción de serialización.** No hay capa de traducción. `editor.getJSON()` → localStorage → `editor.commands.setContent()`. El round-trip es trivial y perfecto por definición.

**2. Menos superficie de código.** Eliminás dos módulos que el plan de implementación asume: un serializer de `LtxjDocument → TiptapJSON` y uno de vuelta. En fases tempranas eso es mucho peso muerto.

**3. Siempre en sincronía con el schema del editor.** Si agregás un nuevo nodo (`CrossRef`, `AlgorithmEnv`), no tenés que actualizar dos schemas separados — el formato de storage se actualiza solo.

**4. Herramientas ya existentes.** Tiptap tiene utilidades para transformar su propio JSON, compararlo, hacer diff. Usarlas sobre un formato propio requeriría adaptadores.

---

## Contras — y estos son más serios

**1. El problema gordo: el `MathAST` desaparece.**

Este es el punto crítico. El `.ltxj` especificado en `data-model.md` almacena el **árbol semántico** de cada fórmula, no sólo el string LaTeX. Si el formato es Tiptap puro, los nodos de math quedan como:

```json
{ "type": "mathDisplay", "attrs": { "latex": "\\frac{d}{dx}\\sin x" } }
```

Eso significa que **cada vez que el normalizador corre, tiene que re-parsear el LaTeX** desde cero via `ASTParser`. Perdés la capacidad de guardar el AST normalizado como fuente de verdad. El normalizador pasa de ser un paso de escritura a un paso de lectura — que es exactamente lo que la arquitectura quería evitar.

**2. Acoplamiento a Tiptap/ProseMirror como formato de persistencia.**

Tiptap no garantiza estabilidad de su JSON entre major versions. Hoy un `bold` se representa como un mark; mañana podría cambiar. Si `.ltxj` *es* Tiptap JSON, cada update de dependencia es un potencial breaking change en tu formato de documentos. Los documentos guardados de tus usuarios están a merced del changelog de Tiptap.

**3. El formato filtra detalles de implementación del editor.**

El JSON de Tiptap está diseñado para ser consumido por ProseMirror. Contiene artefactos de renderizado (marks con `attrs` de ProseMirror, nodos `hardBreak`, etc.) que no tienen significado semántico documental. Si alguna vez querés correr el normalizador en un contexto server-side (Node.js, CLI), o parsear documentos `.ltxj` sin cargar Tiptap, el formato se vuelve opaco.

**4. Sin historia de migración.**

El `.ltxj` especificado tenía un campo `version`. Tiptap JSON no tiene ninguno. Sin versioning, no podés migrar documentos viejos cuando el schema evoluciona (e.g., cuando agregás el campo `label` a `MathDisplay` en Fase 4).

**5. El ProfileId no tiene dónde vivir.**

El documento necesita saber con qué perfil fue creado (`article-pro`, `physics-paper`, etc.). Eso es metadata documental. En Tiptap JSON puro, no hay lugar natural para eso — terminarías metiendo un nodo fantasma o un key ad-hoc.

---

## Soluciones posibles

### Opción A — Envelope mínimo (recomendada para tu caso)

Usás Tiptap JSON como el `content`, pero lo envolvés:

```json
{
  "version": 1,
  "profileId": "article-pro",
  "metadata": { "title": "...", "author": "...", "createdAt": "..." },
  "content": { /* tiptap getJSON() exacto */ }
}
```

**Y en los attrs de los nodos math, guardás el AST junto al string:**

```json
{
  "type": "mathDisplay",
  "attrs": {
    "latex": "\\frac{d}{dx}\\sin x",
    "ast": { /* MathAST serializado */ },
    "astVersion": 1,
    "numbered": false,
    "label": ""
  }
}
```

- El `latex` es lo que se muestra en el textarea.
- El `ast` es la fuente de verdad del normalizador — si existe, no re-parsea.
- Si `ast` es null (fórmula no parseada aún), el normalizador la parsea y la guarda.

**Qué ganás:** round-trip trivial, Tiptap feliz, el normalizador eficiente, versioning, profile. **Qué perdés:** nada material. El costo es extender los attrs de los nodos math, que ya estaban planeados.

---

### Opción B — Formato `.ltxj` propio con converters bidireccionales

Lo que especifica `data-model.md`: un schema propio, convertido a/desde Tiptap JSON con `LtxjToTiptap` y `TiptapToLtxj`.

**Cuándo tiene sentido:** si Formalia eventualmente corre el normalizador fuera del browser (servidor de PDF, CLI, VS Code extension). La separación es arquitectónicamente más limpia. **Cuándo es over-engineering:** en Fases 1–3 es trabajo muerto — añade dos módulos de conversión sin beneficio observable.

---

### Opción C — Tiptap JSON crudo, sin modificar (lo que preguntás)

Viable sólo si aceptás que:
- El normalizador re-parsea el AST en cada activación de nodo (no en cada keystroke, pero sí al cargar el documento y al seleccionar una fórmula).
- La migración de documentos es manual si Tiptap cambia su schema.
- El profileId vive en un key separado en localStorage.

No es catastrófico en Fase 1. **Sí se convierte en deuda en Fase 3** cuando el normalizador entra en escena y la eficiencia del AST empieza a importar.

---

## Recomendación concreta

Para el **estado actual del proyecto** (Fases 1–2), usá el JSON de Tiptap directamente con el envelope mínimo de la Opción A. Es una decisión de cuatro líneas de código que te compra toda la flexibilidad futura sin bloquear nada hoy:

```typescript
// storage/DocumentSerializer.ts
export function toStorage(editor: Editor, profileId: string): LtxjDocument {
  return {
    version: 1,
    profileId,
    metadata: { title: '', savedAt: Date.now() },
    content: editor.getJSON()
  }
}

export function fromStorage(doc: LtxjDocument): JSONContent {
  return doc.content  // Tiptap lo consume directamente
}
```

El MathAST en attrs lo sumás en Fase 3 cuando implementes el `ASTParser`, no antes. En ese momento ya tenés el formato versionado listo para migrarlo.

El formato propio completo (Opción B) es una decisión de Fase 5 si aparecen los casos de uso que lo justifican.




Voy a crear un análisis exhaustivo. Primero el widget interactivo, luego la explicación profunda capa por capa.---

Ahora voy capa por capa, porque cada problema tiene matices que el widget no puede capturar del todo.

---

## 1. El problema del MathAST: el más importante y el más sutil

Este es el que más impacta la propuesta de valor central de Formalia.

Cuando el normalizer procesa una fórmula, la pipeline es:
```
latex string → ASTParser → MathAST → Normalizer.apply(rules) → MathAST' → ASTSerializer → latex canónico
```

Si el storage es solo Tiptap JSON crudo, `mathDisplay.attrs` es esto:
```typescript
{ latex: "\\frac{d}{dx}\\sin x", numbered: true, label: "..." }
```

Lo que se pierde no es solo eficiencia — es semántica que la string no puede representar.

**Caso concreto con `DxSpacing`:** La regla detecta que la `d` en `\frac{d}{dx}` es un operador diferencial, no la variable `d`. Para hacerlo, el ASTParser de MathLive produce un nodo `Derivative` con semántica clara. El normalizer entonces taguea ese nodo: `{ type: "Derivative", _tag: "leibniz-notation" }`. Este tag es lo que le dice a `ForbiddenSyntax` "no reemplaces esta `d` con `\mathrm{d}` — ya es correcta en este contexto". Si destruís el AST al guardar, `ForbiddenSyntax` tiene que re-inferir ese contexto desde el string, lo cual es frágil y costoso.

**Caso concreto con el CoachPanel:** La interfaz muestra al usuario `change.before → change.after` con `change.description`. Esa información existe en el objeto `NormalizerChange[]` que el normalizer produce. ¿Dónde vive? Hoy, en memoria. Al recargar la página, el CoachPanel no tiene nada que mostrar — tendría que re-ejecutar el normalizer sobre todas las fórmulas para reconstruir el historial. Si el AST guarda `_rulesApplied: ["DxSpacing", "AutoDelimiters"]`, el CoachPanel puede reconstruir el historial sin re-parsear nada.

**El problema de escala:** Un documento con 80 fórmulas. Cada vez que el usuario abre el documento, sin AST cacheado, el sistema tiene que ejecutar `ASTParser.parse()` 80 veces antes de que el normalizer pueda trabajar. Con ASTs cacheados, cero parsings en la apertura. Los parsings ocurren solo cuando el usuario edita una fórmula nueva o cuando `astVersion` del nodo es menor que la versión actual del parser (indicando que el parser fue actualizado y el AST viejo puede ser incorrecto).

---

## 2. El problema de versioning: cómo se convierte en deuda compuesta

El problema no es que Tiptap cambie su JSON mañana. Es que vos vas a cambiar el schema.

**Ejemplo real de Fase 1 a Fase 4:** En Fase 1, `mathDisplay` tiene:
```typescript
attrs: { latex: string, numbered: boolean, label: string }
```
En Fase 4, agregás `crossRefStyle` para controlar cómo `\cref` formatea la referencia:
```typescript
attrs: { latex: string, numbered: boolean, label: string, aligned: boolean, crossRefStyle: "theorem" | "equation" | "default" }
```

Sin version field: los documentos viejos no tienen `crossRefStyle`. Tiptap maneja esto con valores por defecto en el schema del nodo, así que no rompe nada. Pero no podés hacer una migración explícita que lea la intención del usuario — solo podés poner un default genérico.

Con version field, en cambio, podés escribir:
```typescript
function migrate(doc: LtxjDocument): LtxjDocument {
  if (doc.version === 1) {
    // Los docs v1 eran todos article-pro con ecuaciones display
    // Inferimos crossRefStyle desde el label del nodo
    const migrated = migrateContent(doc.content, node => {
      if (node.type === 'mathDisplay' && !node.attrs.crossRefStyle) {
        node.attrs.crossRefStyle = node.attrs.label.startsWith('eq:') 
          ? 'equation' : 'default';
      }
    });
    return { ...migrated, version: 2 };
  }
  return doc;
}
```

**El problema se vuelve exponencial con el tiempo:** Sin versioning, en Fase 5 cuando querés migrar documentos de Fase 1, no sabés si el documento que estás mirando ya fue "actualizado informalmente" a un estado intermedio, o si es del Fase 1 original. Cada migración asume el peor caso y tiene que ser defensiva. Con versioning, cada documento declara exactamente su estado, y las migraciones son secuenciales y deterministas.

---

## 3. El profileId: por qué es imposible de inferir

El `profileId` es el identificador que le dice a `ManifestEngine` qué `profile.json` y `manifest.json` cargar para la exportación. Sin él, el serializer no sabe qué paquetes incluir en el preamble, qué macros definir, ni qué comandos de entorno usar.

La solución naive es guardarlo en un key separado de localStorage: `formalia:doc:uuid123:profile → "article-pro"`. Esto funciona, pero crea un problema sutil: el "documento" ahora está repartido en dos keys que pueden desincronizarse. Si copiás el doc a otra máquina, olvidás el key del profile. Si la implementación de multi-documento de Fase 4 lista todos los docs del índice, necesitás hacer dos queries por documento en lugar de una.

En el envelope, es un campo más junto con el contenido. Vive donde tiene que vivir.

---

## 4. El problema de `normalizerMode` y `silencedRules`: estado de sesión vs estado de documento

Este es sutil porque parece un problema de UX pero es un problema de formato.

El `normalizerMode` (strict / mixed / suggestion) y las `silencedRules` son **propiedades del documento**, no de la sesión. Si el usuario configura un documento de tesis para que corra en modo `strict`, espera que ese comportamiento persista. Si silencia `AlignedSteps` porque para ese documento en particular prefiere la alineación manual, esa es una decisión que debe seguir al documento.

Con Tiptap JSON crudo, no hay donde guardar esto que no sea un key separado. Peor: cuando implementás el multi-documento en Fase 4, el sidebar necesita saber el `normalizerMode` de cada documento para mostrarlo. Sin el envelope, hacés N queries separadas.

---

## 5. La implementación mínima viable del envelope (Fase 1, hoy)

Lo que cuesta implementar ahora es trivial:

```typescript
// src/features/documents/DocumentSerializer.ts

export interface LtxjDocument {
  version: 1;
  profileId: string;
  normalizerMode: 'strict' | 'mixed' | 'suggestion';
  silencedRules: string[];
  metadata: { title: string; savedAt: number; createdAt: number };
  content: JSONContent; // el getJSON() de Tiptap, sin modificar
}

export function toStorage(editor: Editor, meta: Partial<LtxjDocument>): LtxjDocument {
  return {
    version: 1,
    profileId: meta.profileId ?? 'article-pro',
    normalizerMode: meta.normalizerMode ?? 'mixed',
    silencedRules: meta.silencedRules ?? [],
    metadata: {
      title: meta.metadata?.title ?? '',
      savedAt: Date.now(),
      createdAt: meta.metadata?.createdAt ?? Date.now(),
    },
    content: editor.getJSON(),
  };
}

export function fromStorage(doc: LtxjDocument): JSONContent {
  return doc.content; // Tiptap lo consume directamente, zero transformation
}
```

Eso es todo lo que necesitás en Fase 1. El `fromStorage` es una línea porque Tiptap sigue consumiendo su propio JSON — vos solo le agregaste un wrapper.

---

## 6. El AST en attrs: cuándo y cómo agregarlo (Fase 3)

En Fase 3, cuando `ASTParser` existe, extendés los attrs de `MathDisplay` y `MathInline`:

```typescript
// Extensión del schema de MathDisplay en Fase 3
addAttributes() {
  return {
    latex:      { default: '' },
    ast:        { default: null },      // MathAST | null
    astVersion: { default: 0 },         // número de versión del ASTParser
    numbered:   { default: false },
    label:      { default: '' },
    aligned:    { default: false },
  }
}
```

Y en el normalizer, la lógica de caché es:

```typescript
// src/core/math/Normalizer.ts
const CURRENT_AST_VERSION = 1; // bump esto cuando cambies ASTParser

function normalize(node: MathDisplayAttrs): NormalizationResult {
  let ast: MathAST;

  if (node.ast && node.astVersion === CURRENT_AST_VERSION) {
    // AST válido y actualizado: skip parsing
    ast = node.ast;
  } else {
    // Primer vez, o ASTParser fue actualizado
    ast = ASTParser.parse(node.latex);
  }

  const { transformedAst, changes } = Normalizer.applyRules(ast, activeRules);

  return {
    newAttrs: {
      ...node,
      latex: ASTSerializer.serialize(transformedAst),
      ast: transformedAst,
      astVersion: CURRENT_AST_VERSION,
    },
    changes, // NormalizerChange[] para el CoachPanel
  };
}
```

El `astVersion` es el seguro de calidad. Si en Fase 4 mejorás el `ASTParser` para reconocer más patrones, incrementás `CURRENT_AST_VERSION` a 2. La próxima vez que cualquier fórmula se activa, el normalizer detecta `node.astVersion === 1 < 2` y re-parsea. Las fórmulas que el usuario nunca vuelve a tocar mantienen el AST viejo — esto es aceptable porque el AST viejo sigue siendo correcto, solo es menos completo.

---

## En síntesis

La decisión de usar Tiptap JSON crudo como `.ltxj` tiene cero costo hoy y costo creciente de Fase 3 en adelante. El envelope de la Opción A tiene costo fijo mínimo hoy y compra todo lo que necesitás para las fases restantes. La Opción B es la respuesta correcta solo si eventualmente necesitás correr el normalizer fuera del browser — una decisión que podés tomar en Fase 5 con información real sobre si ese caso de uso existe.

La pregunta que vale la pena hacerse ahora es: ¿vale la pena agregar el envelope en Fase 0/1, antes de que duela? La respuesta es casi siempre sí cuando el costo es cuatro líneas de TypeScript.

---------------------------------------------------

otras miradas:


Quedarte solo con el JSON "crudo" de Tiptap sería desperdiciar el potencial de lo que estás construyendo. Si **Formalia** busca ser un "compilador de intenciones", el formato `.ltxj` tiene que ser mucho más que un simple volcado del estado del editor.

Aquí te explico por qué tu intuición es correcta y cómo debería estructurarse ese formato según tu propia arquitectura:

### 1. El JSON de Tiptap es el "Contenedor", no la "Esencia"
Tiptap (basado en ProseMirror) genera un JSON que describe la estructura jerárquica de los nodos (párrafos, fórmulas, teoremas). Sin embargo:
* **Tiptap JSON:** Es una representación del estado del editor en el DOM.
* **Formalia AST:** Es un **Modelo Semántico Matemático** que entiende la ontología de tus variables y la lógica de tus derivaciones.

El `.ltxj` debe ser el envoltorio que proteja esa "Verdad" semántica.

---

### 2. La estructura lógica del `.ltxj`
Según tu **Master Index**, el formato `.ltxj` debe resolver la separación entre el contenido y su procesamiento. Una estructura coherente para este archivo sería un objeto JSON con tres claves principales:

* **`content`**: Aquí es donde vive el árbol de nodos (el JSON de Tiptap), pero enriquecido con los tipos de nodos específicos que definiste (como `MathInline`, `TheoremEnv` o `MathAST`).
* **`profile`**: Los metadatos que definen qué *es* el documento (reglas de normalización, macros permitidas, esquema de validación).
* **`manifest`**: La información sobre cómo ese contenido se *proyecta* a LaTeX (paquetes requeridos, geometría de página, estilos de fuentes).

> **Nota:** Esta separación es vital porque permite que el mismo `.ltxj` (la "Intención") pueda exportarse a un PDF académico o a una web interactiva simplemente cambiando el manifiesto, sin tocar el contenido.

---

### 3. Por qué el "JSON pelado" rompe la visión
Si el `.ltxj` fuera solo el JSON de Tiptap, perderías la **Independencia de Representación** que mencionás en tu Manifiesto:

1.  **Falta de contexto:** Un nodo de "fórmula" sin su `profile` asociado no sabe si debe seguir reglas estrictas de espaciado o si permite ciertos comandos personalizados.
2.  **Fragilidad:** Si abrís ese archivo en otro editor Tiptap estándar, verías texto, pero perderías la capacidad de la **Normalización Determinística** que hace que Formalia sea especial.
3.  **Portabilidad:** El formato `.ltxj` está diseñado para ser un "modelo de conocimiento blindado". El JSON de Tiptap es solo la forma en que el editor visualiza ese conocimiento hoy.

**En resumen:** El JSON de Tiptap es el "transporte" para la edición, pero el `.ltxj` es el **paquete completo de la intención matemática**, que incluye tanto el árbol de contenido como las reglas de inteligencia (Profile) y exportación (Manifest) que lo acompañan.

Expandir la visión de **Formalia** requiere someter estas ideas a un escrutinio arquitectónico riguroso. Si el objetivo es construir un compilador de intenciones matemáticas, cada decisión debe evaluar no solo la experiencia de usuario, sino la solidez de los fundamentos del sistema.

Vamos a diseccionar la "Capa de Retroalimentación" y la "Ontología del `.ltxj`" desde múltiples perspectivas, explorando alternativas técnicas y conceptuales.

---

### 1. La Capa de Retroalimentación: El "Aula Semántica"

#### Perspectiva Lógica y Funcional (El Profesor como "Type-Checker")
Si miramos esto desde la óptica de la lógica matemática o sistemas de demostración formal como Lean 4, el proceso de corrección no es simplemente "dejar notas al margen". Un comentario del profesor actúa como un evaluador de aserciones. 
* Cuando un alumno escribe un paso en una demostración (`Step-by-step Derivation`), está declarando una proposición.
* El comentario del profesor es un metadato que indica si el "tipo" es correcto, si falta un axioma, o si la sintaxis tipográfica viola las reglas del "Manifesto LaTeX".
* **El valor:** La retroalimentación deja de ser un texto flotante y se convierte en un evento estructurado que exige una "resolución" por parte del alumno para que el documento vuelva a compilar limpiamente.

#### Perspectiva de Interfaz y Estado (Frontend)
Para mantener el *Zero-Entropy Flow*, la interfaz no puede saturarse de cajas de comentarios flotantes que rompan la lectura del código/fórmula.
* Utilizando una arquitectura basada en el estándar web nativo (como Web Components y un manejo de estado atómico con Signals), la vista del documento puede reaccionar instantáneamente a la activación de un comentario sin necesidad de re-renderizar todo el árbol del editor (algo que frameworks más pesados sufrirían al tener cientos de nodos matemáticos).
* El "CoachPanel" de tu Fase 1 y 2 puede mutar elegantemente: cuando se selecciona un nodo con un comentario, el panel cambia del modo "Sugerencia del Normalizador" al modo "Diálogo del Profesor".

#### Alternativas de Implementación (Arquitectura de Datos)
¿Dónde viven los comentarios?
* **Alternativa A: Nodos Integrados (Inline).** Los comentarios se guardan dentro del mismo árbol AST de Tiptap (ej. un nodo `CommentMark` envolviendo un `MathDisplay`).
    * *Pro:* Fáciles de renderizar y viajan con el texto.
    * *Contra:* Ensucian el modelo semántico. El `.ltxj` del alumno se modifica estructuralmente solo porque alguien lo miró.
* **Alternativa B: Archivo "Sidecar" (Anotaciones Paralelas).** Los comentarios viven en un objeto separado que hace referencia a los IDs únicos de los nodos del AST del alumno.
    * *Pro:* Mantiene el AST matemático inmaculado. Si el profesor borra todos los comentarios, el archivo del alumno no sufre mutaciones de deshacer/rehacer.
    * *Contra:* Requiere un sistema robusto de sincronización. Si el alumno modifica el nodo original, el comentario podría quedar huérfano.

---

### 2. La Ontología del `.ltxj`: Mucho más que JSON

#### Perspectiva de "Sistemas" (El formato como Entregable Compilado)
Pensar en el `.ltxj` solo como el volcado de memoria del editor web es como pensar que el código fuente de un programa en Rust o C es solo un archivo de texto plano. El `.ltxj` debe concebirse como un "paquete ejecutable" para el motor de generación.
* **La separación de responsabilidades es ley:** El `content` (el AST) ignora completamente cómo será impreso. El `profile` define la validación semántica (¿está permitido usar este entorno aquí?). El `manifest` inyecta las directivas puras de TeX (LuaLaTeX, UTF-8, unicode-math). 
* Esto garantiza que el documento sobreviva al paso de los años, independientemente de si en el futuro se exporta a HTML o a un nuevo formato académico.

#### Alternativa Estructural: El `.ltxj` como un "Bundle" (Archivo Zip)
Actualmente, conceptualizamos el `.ltxj` como un gran bloque JSON. Pero a medida que el proyecto crezca (Fase 3 y 4), los usuarios querrán incluir imágenes (como figuras en TikZ o gráficos externos) y quizás bibliografías (`.bib`).

* **La alternativa:** Modelar el `.ltxj` no como un archivo de texto JSON, sino como un archivo comprimido estándar (al estilo de `.docx` o `.epub`).
* **Estructura interna hipotética:**
  ```text
  documento.ltxj (zip)
  ├── content.json       (El árbol AST puro de Tiptap/ProseMirror)
  ├── config/
  │   ├── profile.json   (Reglas de dominio, linter)
  │   └── manifest.json  (Instrucciones de compilación, preámbulo)
  ├── assets/            (Imágenes estáticas, assets locales)
  └── meta.json          (Autor, historial de revisiones, IDs de sincronización)
  ```
* **El valor:** Esta estructura es infinitamente más robusta. Permite portabilidad real (como enviar un archivo adjunto) sin tener que codificar imágenes en Base64 dentro de un JSON, lo cual destruiría el rendimiento al intentar parsearlo en el navegador.

---

Viendo estas ramificaciones conceptuales, desde la separación estricta de comentarios mediante IDs paralelos (Sidecar) hasta la evolución del archivo base hacia un formato empaquetado y robusto, ¿cuál de estas perspectivas sientes que resuelve mejor los cuellos de botella que anticipas para la estabilización del motor principal en la Fase 2?


Este informe técnico analiza el riesgo arquitectónico de utilizar el esquema JSON nativo de Tiptap/ProseMirror como la definición única del formato `.ltxj`. Se evalúa la necesidad de una transición hacia un modelo de **Bundle Semántico** que preserve la independencia del contenido matemático frente a las herramientas de edición y los medios de salida.

---

## Informe Técnico: Desacoplamiento de la Intención Matemática

### 1. El Diagnóstico: El Riesgo de la "Captura de Estado"
El formato JSON que devuelve Tiptap es, por definición, un **volcado de estado del DOM del editor**. Aunque es eficiente para la persistencia inmediata de la sesión de edición, presenta tres debilidades críticas para el Manifiesto de Formalia:

* **Contaminación de Interfaz:** El JSON de Tiptap suele incluir metadatos de renderizado (clases CSS, atributos de selección) que son irrelevantes para la "Verdad Matemática".
* **Fragilidad de Versión:** Si el esquema interno de Tiptap evoluciona en futuras versiones (v3, v4), los archivos `.ltxj` quedarían huérfanos o requerirían migraciones complejas, comprometiendo la durabilidad de 10-20 años que busca un académico.
* **Dificultad de Consumo Externo:** Un compilador de LaTeX escrito en Rust o un visor de documentos en una tablet sin JS tendrían que "emular" la lógica de ProseMirror para entender el contenido.

### 2. La Problemática de la Capa Pedagógica (Comentarios)
La reciente idea de integrar un sistema de corrección para profesores ha revelado una falla en el modelo de "archivo único de texto":
* Si los comentarios se insertan como nodos dentro del AST de Tiptap, el **historial de cambios (Undo/Redo)** del alumno se mezcla con las notas del profesor.
* El documento pierde su pureza: lo que debería ser una "Demostración de Topología" se convierte en una "Demostración con 15 globos de texto incrustados". 
* **El dilema:** ¿Cómo permitimos que el profesor "intervenga" el documento sin "alterar" la estructura matemática original?

### 3. El Conflicto con el Manifest (La Trampa del Target)
Si el archivo `.ltxj` incluye el **Manifest** (las instrucciones de compilación de LaTeX), el documento nace "atado" a un solo destino. 
* **Riesgo:** Si el archivo dice "usa la fuente Computer Modern", se vuelve inútil para un medio que no soporte esa fuente (como un lector de e-books básico).
* **Visión:** La forma (Manifest) es una circunstancia; la función (Contenido/AST) es la Verdad. El formato debe ser un portador de significado, no un manual de instrucciones de diseño.

---

## Propuesta de Solución: El Bundle `.ltxj`

Para resolver estas tensiones, se propone que el formato `.ltxj` evolucione de un JSON plano a un **Contenedor Semántico Desacoplado** (basado en estándares de empaquetado como ZIP).

### Arquitectura de Capas
1.  **Capa de Contenido (`content.json`):** Un AST simplificado y estricto. Si Tiptap cambia, Formalia mapea el nuevo Tiptap a este formato estable. Es el "núcleo de hierro" del documento.
2.  **Capa de Anotaciones (`annotations.json`):** Un archivo **Sidecar**. Los comentarios no tocan el texto; se referencian mediante IDs únicos de los nodos. Esto permite que el profesor corrija sobre una capa invisible, manteniendo el historial del alumno intacto.
3.  **Capa de Contrato (`profile.json`):** No contiene cómo se renderiza, sino **qué reglas de lógica se aplican**. (Ej: "Este documento es una Tarea de Álgebra y no permite usar el axioma de elección").



### Ventajas Estratégicas
* **Neutralidad de Target:** El mismo `.ltxj` puede ser procesado por un "Manifest de Overleaf", un "Manifest de Blog" o un "Manifest de Aula Virtual" sin modificar un solo bit del contenido.
* **Flujo Zero-Entropy:** Al separar los comentarios (Sidecar), el proceso de revisión es aditivo y no destructivo. El alumno puede aceptar sugerencias que mutan el AST, o simplemente responder dudas en la capa de anotaciones.
* **Portabilidad Extrema:** El formato se vuelve independiente del navegador y del editor específico. Se convierte en un estándar de intercambio de conocimiento matemático.

---

### Conclusión
Atar el `.ltxj` al JSON de Tiptap es diseñar para el presente del software; construir un **Bundle Semántico** es diseñar para el futuro de la matemática. La separación entre **Contenido (AST)**, **Contexto (Profile)** y **Presentación (Manifest)** es la única garantía de que Formalia cumpla su promesa de ser un "Compilador de Intenciones".

¿Cómo ves la implementación de este "Bundle" en tu stack actual de Vite? ¿Crees que el uso de UUIDs para cada nodo del AST añade demasiada sobrecarga al motor de normalización?