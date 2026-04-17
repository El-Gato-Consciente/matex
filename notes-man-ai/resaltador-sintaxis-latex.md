# Especificación técnica: resaltado y coloreado de fórmulas matemáticas

## 1. Objetivo

Diseñar e implementar un sistema de resaltado visual para fórmulas matemáticas en JavaScript, centrado en fórmulas tipo LaTeX matemático, con capacidad para distinguir y colorear diferentes clases de tokens y estructuras. El sistema debe ser útil tanto para edición interactiva como para visualización, con una arquitectura incremental que permita crecer desde un resaltado básico hasta una semántica más rica.

## 2. Alcance

El alcance recomendado no es LaTeX completo, sino un subconjunto de matemáticas en estilo LaTeX. Esto incluye:

* comandos matemáticos: `\frac`, `\alpha`, `\sin`, `\sum`, `\int`
* delimitadores y agrupación: `{}`, `[]`, `()`
* superíndices y subíndices: `^`, `_`
* números, variables y operadores
* entornos matemáticos frecuentes: `aligned`, `cases`, `matrix`
* texto embebido dentro de fórmulas: `\text{...}`
* delimitadores de modo matemático: `$...$`, `$$...$$`, `\(...\)`, `\[...\]` si aplica

Fuera de alcance, al menos en la primera versión:

* expansión completa de macros personalizadas
* interpretación completa de TeX
* validación semántica profunda
* soporte total de todo el ecosistema LaTeX

## 3. Objetivo funcional

El sistema debe permitir:

* colorear comandos, variables, números, operadores y delimitadores
* resaltar sintácticamente bloques anidados
* diferenciar estructuras como fracciones, exponentes, subíndices y entornos
* aplicar estilos distintos según tipo de token o rol semántico
* responder de forma fluida durante la edición
* degradar de manera segura cuando la fórmula esté incompleta o sea inválida

## 4. Principios de diseño

### 4.1. Simplicidad primero

El primer objetivo es un resaltado útil, no un parser perfecto. Es preferible un sistema robusto y predecible que uno “más inteligente” pero frágil.

### 4.2. Resaltado incremental

Cada cambio en la fórmula debe recomputar el mínimo necesario. El sistema debería evitar recompilar o reprocesar todo el documento si solo cambió un fragmento pequeño.

### 4.3. Tolerancia a errores

La edición real contiene fórmulas incompletas. El sistema debe aceptar:

* llaves sin cerrar
* comandos parciales
* subíndices o superíndices incompletos
* entornos sin cierre

La estrategia correcta es “mostrar algo razonable” en lugar de romper la vista.

### 4.4. Separación entre análisis y presentación

Conviene separar:

* análisis léxico / estructural
* reglas de clasificación
* aplicación visual de estilos

Esto facilita mantener el sistema y cambiar la estética sin tocar la lógica.

## 5. Niveles o fases de desarrollo

## Fase 0: definición del modelo visual

### Objetivo

Definir qué se quiere resaltar y cómo se mapea cada tipo de elemento a estilo visual.

### Entregables

* tabla de categorías visuales
* paleta base o sistema de tokens de color
* criterios de contraste y accesibilidad
* especificación de estados visuales: normal, foco, seleccionado, error, incompleto

### Decisiones técnicas

* si el resaltado será por color, subrayado, fondo, borde o combinación
* si habrá una semántica fija o personalizable por usuario
* si los estilos dependerán del contexto de edición o solo del tipo de token

---

## Fase 1: resaltado léxico básico

### Objetivo

Reconocer elementos sintácticos simples sin construir un parser completo.

### Entregables

* lexer básico para fórmulas matemáticas
* clasificación de tokens primarios
* render de prueba con varios estilos
* soporte mínimo para fórmulas válidas e inválidas

### Categorías mínimas recomendadas

* comando
* variable / identificador
* número
* operador
* delimitador
* espacio / separador
* comentario, si se soporta

### Decisiones técnicas

* usar expresiones regulares, máquina de estados o lexer manual
* mantener el resaltado independiente del motor de render
* definir una representación de tokens estable, por ejemplo:

  * tipo
  * valor
  * posición de inicio y fin
  * nivel de anidamiento opcional

### Riesgos

* las regex solas pueden volverse frágiles
* ciertos comandos pueden tener comportamiento contextual
* el mismo símbolo puede significar cosas distintas según el entorno

---

## Fase 2: estructura sintáctica liviana

### Objetivo

Reconocer relaciones locales entre tokens, sin llegar a interpretar toda la fórmula.

### Entregables

* detección de grupos con llaves
* detección de superíndices y subíndices
* detección de fracciones y argumentos principales
* soporte visual para anidamiento básico

### Casos a cubrir

* `x^2`
* `x_{ij}`
* `\frac{a}{b}`
* `\sqrt{a}`
* `\begin{aligned} ... \end{aligned}`

### Decisiones técnicas

* usar un stack para llaves y bloques
* permitir estructuras incompletas
* definir reglas de “cierre implícito” para evitar estados rotos
* distinguir tokens “fuertes” de tokens “decorativos”

### Riesgos

* ambigüedad en la asociación de argumentos
* necesidad de heurísticas para comandos que toman argumentos sin llaves
* interacción con autocompletado o edición en vivo

---

## Fase 3: semántica visual

### Objetivo

Diferenciar visualmente clases más específicas de contenido matemático.

### Entregables

* resaltado semántico por categorías
* estilos para funciones, operadores grandes, letras griegas, símbolos relacionales, delimitadores dinámicos
* reglas de estilo para texto incrustado con `\text{...}`
* soporte de personalización de tema

### Categorías semánticas sugeridas

* funciones trigonométricas y logarítmicas
* operadores grandes: sumatoria, integral, producto
* constantes y símbolos especiales
* conjuntos, números, vectores, matrices
* texto dentro de matemática
* placeholders o variables editables

### Decisiones técnicas

* usar clasificación explícita por lista blanca de comandos conocidos
* decidir si los comandos desconocidos quedan como “comando genérico” o “error leve”
* permitir temas por usuario o por contexto del documento

### Riesgos

* mantener listas semánticas manualmente puede requerir mantenimiento
* demasiados colores pueden reducir legibilidad
* el sistema debe seguir siendo usable en fórmulas densas

---

## Fase 4: integración con edición interactiva

### Objetivo

Convertir el resaltado en una parte real del editor, no solo en una vista de lectura.

### Entregables

* sincronización entre entrada y resaltado
* actualización incremental al teclear
* manejo correcto del cursor y selección
* comportamiento consistente en copiar/pegar

### Decisiones técnicas

* si el editor usa DOM puro, canvas o un motor especializado
* cómo se mapea posición de texto a posición visual
* cómo se preserva el caret cuando cambia el decorado
* cómo se mantiene el rendimiento en fórmulas largas

### Riesgos

* re-render completo en cada pulsación puede ser costoso
* el resaltado puede mover el texto visualmente y desalinear el cursor
* compatibilidad con IME, teclados especiales y pegado masivo

---

## Fase 5: validación, errores y diagnóstico

### Objetivo

Mejorar la comprensión del usuario cuando la fórmula es incompleta o incorrecta.

### Entregables

* estados visuales de error
* mensajes o pistas no intrusivas
* marcadores para llaves sin cerrar, comandos desconocidos o estructuras rotas
* logs internos o trazas de análisis para depuración

### Decisiones técnicas

* error duro vs advertencia suave
* mostrar error solo cuando la estructura impide seguir analizando
* definir cómo se comunica el problema sin saturar la interfaz

### Riesgos

* alertas excesivas generan ruido
* muchas advertencias reducen la confianza del usuario

---

## Fase 6: optimización y robustez

### Objetivo

Preparar el sistema para uso real intensivo.

### Entregables

* análisis de rendimiento
* minimización de recomputaciones
* caché de segmentos analizados
* pruebas con fórmulas largas y ediciones frecuentes

### Decisiones técnicas

* dividir por bloques o por líneas
* invalidar solo regiones afectadas
* evitar operaciones costosas en el hilo principal si no son necesarias

### Riesgos

* fórmulas muy largas pueden degradar la interfaz
* demasiada abstracción puede dificultar el mantenimiento

## 6. Modelo de arquitectura recomendado

Una arquitectura práctica puede dividirse en cuatro capas:

1. **Entrada**: texto o fórmula en bruto.
2. **Análisis**: tokenización y detección de estructura ligera.
3. **Clasificación**: asignación de tipos visuales y semánticos.
4. **Presentación**: render del resaltado, tema y estados.

Esta separación permite cambiar una capa sin rehacer las demás.

## 7. Representación interna sugerida

Para cada token o segmento conviene almacenar:

* tipo
* valor crudo
* inicio y fin en el texto
* profundidad de anidamiento
* bloque padre, si existe
* flags de error o advertencia
* clase visual asignada

Esto facilita:

* repintado parcial
* navegación por bloques
* inspección de errores
* futuras funciones como autocompletado o hover

## 8. Consideraciones técnicas clave

### 8.1. Ambigüedad sintáctica

En matemáticas, una misma secuencia puede interpretarse de formas distintas según contexto. El sistema debe aceptar heurísticas controladas y no pretender exactitud absoluta.

### 8.2. Soporte de fórmulas incompletas

La edición real casi siempre contiene fragmentos parciales. El análisis debe ser robusto ante cortes temporales.

### 8.3. Rendimiento

La percepción de fluidez es parte del producto. Conviene evitar:

* reparseos globales innecesarios
* render masivo de nodos DOM
* cálculos repetidos por cada tecla

### 8.4. Accesibilidad

El color no debe ser el único canal de información. Es recomendable combinar color con:

* peso tipográfico
* subrayado
* fondo tenue
* borde o indicador lateral

### 8.5. Personalización

Distintos usuarios pueden preferir diferentes estilos. Conviene que la paleta sea configurable sin modificar el núcleo del sistema.

### 8.6. Compatibilidad con motor matemático

Si el sistema convive con un motor como MathLive o similar, hay que definir claramente qué hace cada componente:

* motor de edición
* motor de render
* motor de resaltado
* motor de validación

## 9. Entregables por versión

### Versión 0.1

* resaltado básico por regex o lexer simple
* categorías mínimas
* demo funcional

### Versión 0.2

* estructura de bloques con stack
* llaves, exponentes, subíndices
* primer sistema de temas

### Versión 0.3

* categorías semánticas ampliadas
* integración con editor en vivo
* manejo de errores suaves

### Versión 1.0

* resaltado estable
* rendimiento aceptable en uso real
* configuración visual
* base preparada para autocompletado y diagnóstico

## 10. Criterios de aceptación

El sistema puede considerarse adecuado cuando:

* distingue correctamente comandos, operadores y delimitadores frecuentes
* no se rompe con fórmulas incompletas
* mantiene el cursor estable durante la edición
* colorea con consistencia visual
* es suficientemente rápido para uso interactivo
* permite extender categorías sin reescribir toda la lógica

## 11. Recomendación práctica final

La estrategia más razonable es construir primero un resaltado **léxico + estructural liviano**, y dejar la semántica fina como una segunda capa. Para un editor matemático, esto suele dar mejor relación entre complejidad y valor que intentar interpretar LaTeX completo desde el inicio.

## 12. Próximo paso sugerido

A partir de esta especificación, el siguiente documento natural sería:

* un mapa de categorías visuales
* o una propuesta de arquitectura técnica con módulos, interfaces y eventos
* o una primera versión de lexer en JavaScript
