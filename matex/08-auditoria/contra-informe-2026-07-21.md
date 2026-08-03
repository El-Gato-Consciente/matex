# Contra-informe — revisión crítica de la auditoría 2026-07-21

> Revisión independiente de [`auditoria-2026-07-21.md`](auditoria-2026-07-21.md), verificando
> cada afirmación **contra el código y ejecutándola**, no releyendo el informe. Incluye un
> análisis en profundidad de la filosofía del AST que llega a una conclusión distinta.

**Diferencia de método.** La auditoría original **contó** (cuántas implementaciones hay,
cuántos campos tiene un tipo, cuántas líneas). Este contra-informe **ejecuta** (¿las tres
implementaciones dan el mismo resultado? ¿el estado ilegal es alcanzable?). Esa diferencia
cambió tres de los trece veredictos, y descubrió un bug presente donde la auditoría veía un
riesgo hipotético.

Es una revisión de mi propio trabajo previo. Los errores que señalo abajo son míos.

---

## 1. El hallazgo que la auditoría no vio

### N-1 · La numeración **ya diverge**, y el HTML contradice al PDF 🔴 S · **medido y ejecutado**

La auditoría dijo (§A-1): *«si divergen, el editor miente sobre lo que va a compilar»*.
Condicional. **No es condicional: divergen hoy.**

El canon de LaTeX es la autoridad y dice ([`canon.ts`](../../plataforma/src/features/latex/canon.ts) 62-70):

```latex
\newtheorem{theorem}{Teorema}[section]   % numerado POR SECCIÓN → "1.1"
\newtheorem*{remark}{Observación}        % ESTRELLADO → NO se numera
```

Los números de LaTeX **no se dedujeron: se compilaron**. Documento con un teorema antes de
toda sección, uno en cada una de dos secciones, y una observación en la primera. Números reales
tomados del `.aux`:

```
sinSeccion   -> 0.1
enSec1       -> 1.1
enSec2       -> 2.1
```

Contra lo que produce cada implementación:

| | Teorema (sin sección) | Teorema (§1) | Observación | Teorema (§2) | `\ref` al último |
|---|---|---|---|---|---|
| **LaTeX** (compilado, autoridad) | **0.1** | **1.1** | *sin número* | **2.1** | «Teorema 2.1» |
| **Editor** (`numbering.ts`) | **0.1** ✅ | **1.1** ✅ | *sin número* ✅ | **2.1** ✅ | «Teorema 2.1» ✅ |
| **HTML** (`buildHtmlRefs`) | **1** ❌ | **2** ❌ | **Observación 3** ❌ | **4** ❌ | **«Teorema 4»** ❌ |

Tres defectos concretos del backend HTML:

1. **Numera global en vez de por sección** (`thm += 1`, `html.ts` 149) — «Teorema 1» donde el
   PDF dice «Teorema 1.1».
2. **Numera las observaciones**: solo excluye `proof` (`b.variant !== 'proof'`), mientras el
   canon las declara con `\newtheorem*`. Y como consumen contador, **corren todos los números
   siguientes**: cuantas más observaciones, mayor el desfase.
3. **Las referencias cruzadas resuelven al número equivocado**: el mismo `\ref` dice «Teorema
   2.1» en el PDF y «Teorema 3» en el HTML.

**Por qué importa más que como lo planteó la auditoría.** No es deuda de mantenimiento, es la
**tesis del proyecto fallando en producción**: «un AST → dos salidas de calidad». Los 23
documentos Matex verificados compilan a PDF perfecto y su versión HTML tiene la numeración mal.
`verify:content` no lo detecta porque solo comprueba que el PDF compile.

**Y hay algo peor: un test codifica el número equivocado como comportamiento esperado.**
`html.test.ts` 96 afirma:

```ts
expect(html).toContain('Teorema 1 (Pitágoras).')   // documento SIN sección
```

LaTeX, para ese mismo documento, numera **«Teorema 0.1»** (compilado arriba). El test no es que
«no verifica cuál número»: **verifica el número incorrecto y lo deja fijado**. Cualquiera que
corrija el backend HTML para que coincida con el PDF va a ver ese test ponerse en rojo y puede
concluir que rompió algo. La suite está defendiendo el bug.

**Y el editor es el que tiene razón.** Es un dato importante para el arreglo: `numbering.ts`
espeja el canon fielmente. La unificación propuesta en A-1 debe tomar **la política del editor**
como referencia y corregir el HTML, no promediar las tres.

**Ironía metodológica.** La auditoría original diagnosticó, con razón, que *«los bugs los
encontró verificar, no leer el código»* — y acto seguido reportó A-1 leyendo el código sin
ejecutar la comparación. Bastaban veinte líneas de sonda.

---

## 2. Hallazgos nuevos, menores

### N-2 · Comentario huérfano en el AST ⚪ XS · medido

`ast.ts` 249-255: un bloque JSDoc completo que documenta **`FigureNode`** («Figura: flotante con
imagen + epígrafe…») está pegado inmediatamente encima de `export type PlotLineStyle`. El
`FigureNode` real vive en la línea 875 con su propia documentación. Residuo de un refactor: al
pasar el mouse sobre `PlotLineStyle` en el IDE puede aparecer texto sobre figuras.

### N-3 · El encabezado del archivo más importante del proyecto está desactualizado ⚪ XS · medido

`ast.ts` 11-12 dice: *«Versión inicial (piloto): el subconjunto mínimo. Nodos futuros previstos:
`figure`, `table`, `theorem`/`proof`, `include`, `ref`/`cite`, `plot`…»*.

**Los seis están implementados.** Es el mismo problema que la limpieza documental del
2026-07-21 corrigió en los README, sobrevivido dentro del código — y en el archivo que define
el modelo semántico entero.

### N-4 · `PlotSpec.syntax` está mal documentado, y eso es peligroso ⚪ XS · medido

Su comentario dice: *«Notación en que se escriben las funciones (**para reabrir el editor en el
modo justo**)»* — lo describe como preferencia de UI. Pero lo consumen **cuatro módulos del
backend** (`relation.ts` 258, `intersect.ts` 56 y 150, `parameters.ts` 53, `relationSvg.ts` 993)
para **parsear las expresiones**.

Es una trampa: yo mismo, leyendo el comentario durante esta revisión, lo clasifiqué como
«estado del editor filtrado al documento» y estuve a un paso de proponer eliminarlo. Habría
roto el parseo de toda expresión en notación LaTeX. **Un campo cuya documentación miente sobre
su rol es peor que un campo sin documentar.**

---

## 3. Correcciones a la auditoría original

### ✅ Se sostienen sin cambios

**A-3** (el núcleo importa `features/latex/canon`) — verificado: los únicos imports externos de
`core/` son `zod`, `katex` y ese. La afirmación «única violación» es correcta.

**A-4** (JavaScript como sopa de strings) — verificado en `html.ts` 428-448 y 873-877.

**O-1** (vulnerabilidad `high` en `fast-uri`) — verificado.

**C-1** (editor con cobertura 0.06) — verificado, y el matiz sobre *refactor → test* es el
correcto.

### ⚠️ Se sostienen, pero por otra razón

#### A-2 · Estados imposibles — severidad correcta, argumento equivocado

La auditoría lo justificó como defecto abstracto de modelado: *«`{presentation, letter, cv}` es
representable»*. Verifiqué la alcanzabilidad real: **la UI solo permite fijar `presentation`**
(`MatexWorkspace.tsx` 1711); `letter`/`exam`/`cv`/`poster` los ponen únicamente las plantillas
y los ejemplares. Como defecto abstracto, sería 🟡, no 🔴.

**Pero hay un camino concreto que la auditoría no vio, y es peor:**

> Abrir la plantilla **«carta formal»** en el editor visual → modal Documento → tildar **«Modo
> presentación (beamer)»**. El checkbox no tiene guarda alguna. El resultado es
> `{letter: {…}, presentation: true}`, y la precedencia de `compile.ts` 292-297 hace ganar a
> `presentation`: **la carta se convierte en una presentación de beamer y todos los campos de
> carta —destinatario, saludo, firma, adjuntos— se descartan en silencio.**

Dos clics, sin advertencia, sin pérdida visible hasta compilar. **La severidad 🔴 está
justificada; el argumento correcto es la destrucción silenciosa de un documento, no la
elegancia del tipo.** Y sugiere una mitigación inmediata mucho más barata que la unión
discriminada: **deshabilitar el checkbox cuando el documento ya pertenece a otra familia**
(XS), y hacer el modelado bien después.

#### O-3 · Accesibilidad — la auditoría ya se autocorrigió, pero se quedó corta

Corregir «0 `alt`» estuvo bien (no hay `<img>` en la UI). Pero el hallazgo que quedó
—«los widgets propios no son operables por teclado»— sigue marcado **inferido**, y podría
haberse medido: el gráfico SVG registra `wheel`/`mousedown`/`mousemove` y ningún `keydown`.
Es 🔴 de accesibilidad para quien no usa mouse, aunque ⚪ de prioridad de producto hoy.

### ❌ Sobrevaluado

#### F-1 · El «51% del AST» está inflado por los comentarios

La cifra cuenta líneas de un bloque densamente documentado. Medido:

| | total | comentarios | código real |
|---|---:|---:|---:|
| `ast.ts` completo | 1.222 | **537 (44%)** | 589 |
| Bloque `PlotSpec` y familia | 405 | 186 | **197** |

En **declaraciones reales**, la familia `PlotSpec` es **197 de 589 líneas = 33%**, no 51%. Y el
resto del bloque «gráficos» (charts, distribuciones, diagramas, árboles, partes de figura) son
220 líneas **magras y bien modeladas**: `ChartSpec` tiene 6 campos, `DiagramSpec` 4, `TreeSpec` 3.

La crítica de la auditoría, tal como está escrita —«el modelo de gráficos es un panel de
configuración»— **es injusta con cuatro de las cinco familias**. Lo que es un panel de
configuración es **`PlotSpec` y su familia, específicamente**. Un 33% sigue siendo mucho y 26+19
campos opcionales siguen siendo muchos: el hallazgo es válido, el titular era retórica.

---

## 4. La filosofía del AST — una lectura distinta

La auditoría original planteó la tensión así: *«el modelo tiene dos mitades con filosofías
distintas: la prosa es semántica, los gráficos son configuración»*, y declinó proponer arreglo.

**Creo que ese diagnóstico está mal encuadrado, y por eso no encontró la salida.**

### El AST modela tres categorías de nodo, no dos, y nunca las nombró

| categoría | ejemplos | qué es el nodo | ¿«qué vs cómo» aplica? |
|---|---|---|---|
| **Descriptivo** | `heading`, `theorem`, `paragraph`, `table`, `callout`, `reasoning` | *describe algo que el autor tiene* | **Sí, perfectamente** |
| **Descriptivo con contenido opaco** | `mathInline`, `EquationRow`, `derivation.steps[]`, etiquetas de diagrama | *describe un objeto cuyo interior el modelo no entiende* | Sí por fuera, **no por dentro** |
| **Constructivo** | `PlotSpec` y familia, `DistSpec.bins`, `PlotArea.riemann` | *es una receta para fabricar algo que no existía* | **No, o no de la misma forma** |

Un teorema **es** un teorema en cualquier medio: describirlo y dejar que el backend lo componga
es exactamente correcto. Pero un gráfico de `x²` con sus raíces marcadas **no es un objeto que
el autor tenga y quiera transcribir**: es algo que el sistema **fabrica** a partir de una
receta. `samples: 200` no es presentación ni semántica — **es un parámetro del algoritmo de
construcción**, y no tiene análogo en la prosa porque la prosa no se construye, se transcribe.

Vista así, **la supuesta inconsistencia filosófica se disuelve**: el modelo de prosa y el de
gráficos no obedecen filosofías contradictorias, son **dos categorías de nodo distintas que el
modelo nunca distinguió explícitamente**. La incomodidad no viene de que los gráficos estén mal
hechos; viene de que están metidos en un vocabulario diseñado para nodos descriptivos.

### Lo que sí está genuinamente revuelto: `PlotSpec` mezcla las tres cosas

Los 26+19 campos, clasificados:

| categoría | campos | veredicto |
|---|---|---|
| **Intención** (qué mostrar/destacar) | `role`, `markRoots`, `markExtrema`, `markInflections`, `markAsymptotes`, `markYIntercept`, `featureCoords`, `shade`, `inverse`, `endLabel`, `showValue` | **Lo más semántico del modelo entero.** «Quiero que se vean las raíces» es una intención didáctica pura. |
| **Receta** (cómo computarlo) | `samples`, `bins`, `riemann`, `riemannN`, `interpolate`, `interpDegree`, `syntax`, `pieces`, `fromData` | Ni semántica ni presentación: **parámetros de construcción**. Legítimos, mal ubicados. |
| **Presentación** | `hideTicks`, `piTicks`, `legendPos`, `grid`, `legend`, `color`, `style`, `width`, `pattern`, `labelPos`, `equalAxes` | Capa 2, admitida por el propio modelo. |

**Ahí está el arreglo que la auditoría declinó proponer.** No es «hacer los gráficos más
semánticos» —los campos de intención ya lo son y son excelentes—: es **separar las tres
categorías** en vez de tenerlas en una bolsa plana de 26 campos. Algo como
`{ show: {...}, compute: {...}, style: {...} }`. Cada backend consume las tres, pero un lector
del modelo **ve la diferencia**, y la regla «el AST no guarda presentación» pasa a ser
verificable en vez de aspiracional.

Esto también explica **por qué LE-02 fue tan claro y F-1 tan difuso**: LE-02 atacaba
*vocabulario de un backend* (`metropolis`, `banking`), que es inequívocamente incorrecto. F-1
ataca campos que son legítimos pero están sin clasificar. No es el mismo tipo de deuda, y
tratarlos igual confunde.

### F-3 · La cuestión de la matemática, reformulada

La auditoría la planteó como «dos representaciones incompatibles: cadena opaca vs AST parseado».
Correcto como observación. Pero con la taxonomía de arriba, la pregunta real es más nítida:

> **`derivation` es un nodo descriptivo con contenido opaco. LE-06 (`verify` numérico) pide
> convertirlo en un nodo constructivo. ¿Puede un nodo descriptivo volverse constructivo sin
> dejar de ser descriptivo?**

Porque una derivación tiene que seguir sirviendo para escribir un paso que **no se puede
computar** («por hipótesis inductiva», «por el teorema de Green»). Si `verify` exige estructura,
o se parte el nodo en dos tipos, o la estructura es opcional y conviven ambos modos.

Hay una pista fuerte en el propio proyecto: **`PlotFunction.fromData` ya hizo exactamente esta
transición**. Una serie de datos —dato crudo, descriptivo— se volvió una función de primera
clase que acepta tangente, área y raíces (ME-45), sin romper las funciones por expresión.
Convivencia de dos modos bajo un tipo. Es el precedente a mirar antes de diseñar LE-06.

Mi recomendación concreta, más específica que la de la auditoría: **no promover el AST de
expresiones a toda la prosa** (arrastra el parser a todo el modelo y no resuelve los pasos no
computables). En cambio, **agregar estructura opcional al paso**: `DerivationStep.check?:
{ expr, expect }` — el paso sigue siendo `tex` para mostrar, y opcionalmente declara qué se
puede verificar. Igual que `fromData`: dos modos, un tipo.

### Lo que la auditoría acertó y conviene subrayar

El elogio a `mathDisplay.aligned`, `theorem.proves`, `derivation`/`reasoning` y a las escotillas
honestas es correcto y está bien fundado. Agrego uno que no mencionó: **`EquationRow` lleva la
identidad en la fila, no en el bloque** — de ahí sale que una referencia a una ecuación siga
apuntando bien aunque se agreguen líneas arriba. Es una decisión de modelado fina, del mismo
nivel que `theorem.proves`, y es la clase de cosa que el proyecto debería proteger con tests
(hoy no los tiene: N-1 muestra que la numeración está sin verificación cruzada).

---

## 5. Cuadro de ponderación revisado

| # | Hallazgo | Auditoría | Revisado | Motivo del cambio |
|---|---|:---:|:---:|---|
| **N-1** | **La numeración ya diverge; el HTML contradice al PDF** | *no visto* | **🔴 S** | Ejecutado, no supuesto |
| A-1 | Numeración implementada 3× | 🔴 S/M | 🔴 S/M | Se mantiene; N-1 es su consecuencia medida |
| A-2 | Familias: estados imposibles | 🔴 M | **🔴 M + 🔴 XS** | Mitigación inmediata (guarda en el checkbox) separada del modelado |
| O-1 | Vulnerabilidad `high` | 🔴 XS | 🔴 XS | — |
| C-1 | Editor con cobertura 0.06 | 🟡 L | 🟡 L | — |
| A-3 | Dirección de dependencias | 🟡 S | 🟡 S | — |
| A-4 | JS como sopa de strings | 🟡 M | 🟡 M | — |
| F-1 | «51% del AST es configuración» | 🟡 L | **🟡 M** | 33% real; 4 de 5 familias están bien; el arreglo es clasificar, no rehacer |
| F-2 | Nodos de familia en la unión | 🟡 M | 🟡 M | — |
| F-3 | Dos matemáticas | 🟡 — | 🟡 — | Reformulado: descriptivo→constructivo, con `fromData` como precedente |
| O-2 | Bundle 2.5 MB | 🟡 S | 🟡 S | — |
| **N-4** | `PlotSpec.syntax` mal documentado | *no visto* | ⚪ XS | Trampa activa para el próximo refactor |
| **N-2/N-3** | Comentario huérfano · encabezado obsoleto | *no visto* | ⚪ XS | — |
| C-2 | Contenido no corre en PRs | ⚪ XS | ⚪ XS | — |
| O-3 | Teclado en widgets propios | ⚪ M | ⚪ M | Medible, no solo inferible |
| C-3 | `showcase`/`templates` 0.02 | ⚪ S | ⚪ S | — |

---

## 6. Conclusiones

**Sobre el estado del proyecto.** El veredicto de fondo de la auditoría se confirma: el proyecto
está sano, con disciplina de tipos excepcional y un modelo semántico con decisiones de diseño
genuinamente buenas. Pero **tiene un bug de corrección en producción** (N-1) que ninguna de sus
tres capas de verificación —597 tests, 154 compilaciones, `verify:content`— podía detectar,
porque todas comprueban *que algo salga*, no *que las dos salidas coincidan*. Peor: **un test
fija el número equivocado**, así que la suite no solo no detecta el bug — lo protege.

**Sobre la tesis del proyecto.** «Un AST → dos salidas de calidad» está probada para la
*estructura* y falsada para la *numeración*. Eso no la invalida, pero marca dónde tiene que ir
el próximo esfuerzo de verificación: **tests de equivalencia entre backends**, no más tests por
backend. Es una categoría de test que el proyecto todavía no tiene.

**Sobre la filosofía del AST.** No hay dos filosofías en conflicto. Hay **tres categorías de
nodo** —descriptivo, descriptivo-opaco y constructivo— de las cuales el modelo solo nombró la
primera. Reconocerlas explícitamente: (a) disuelve la supuesta inconsistencia de F-1, (b)
convierte «el AST no guarda presentación» en una regla verificable, y (c) da la forma correcta
de plantear LE-06.

**Sobre el método.** El hallazgo más importante de esta revisión no salió de mirar más código
sino de **ejecutar una comparación de veinte líneas**. La auditoría original tenía toda la
información necesaria para encontrarlo —identificó las tres implementaciones y hasta citó el
comentario que confiesa la duplicación— y no lo encontró porque se detuvo en describir la
estructura del problema. Contar implementaciones es barato; compararlas cuesta un poco más y
vale mucho más.

**Secuencia sugerida, revisada:**

1. **O-1** (XS) · `npm audit fix`.
2. **A-2 mitigación** (XS) · guarda en el checkbox de presentación. Dos clics destruyen un
   documento hoy.
3. **N-1 + A-1** (S) · corregir la numeración del HTML **tomando el editor como referencia**,
   unificar en `core/numbering.ts` y agregar el **primer test de equivalencia entre backends**.
4. **N-2/N-3/N-4** (XS) · higiene del AST, de paso.
5. El resto, según la secuencia original.
