import type { WikiGroup, WikiPage } from './types'

/**
 * Contenido de la wiki «Cómo funciona Matex». Escrita para quien **usa** Matex (la
 * documentación de desarrollo vive en `matex/`). Regla: describir solo lo que el
 * editor hace hoy, con las etiquetas tal como aparecen en la interfaz.
 */
export const wikiGroups: readonly WikiGroup[] = [
  {
    title: 'Empezar',
    pages: [
      {
        id: 'que-es',
        title: '¿Qué es Matex?',
        summary: 'Un editor donde escribís qué querés decir, y Matex se encarga de cómo se ve: en PDF, en la web y más.',
        blocks: [
          {
            kind: 'animation',
            id: 'tres-salidas',
            caption: 'Un mismo documento, tres salidas: PDF con calidad de imprenta, HTML que se adapta a la pantalla y gráficos vectoriales.',
          },
          {
            kind: 'prose',
            markdown:
              'Matex es un **editor visual para documentos técnicos**: apuntes, informes, tesis, presentaciones, exámenes. Escribís como en un procesador de texto —títulos, párrafos, fórmulas, teoremas, gráficos— y Matex arma el documento por vos.',
          },
          {
            kind: 'prose',
            markdown:
              'Lo distinto es **qué guarda** de lo que escribís. No guarda “texto en negrita de 14 puntos”: guarda **qué es** cada cosa —un teorema, una ecuación numerada, el gráfico de una función—. Ese modelo del documento (lo llamamos **AST**) es el corazón de Matex, y de él salen todas las salidas:',
          },
          {
            kind: 'cards',
            items: [
              { title: 'PDF', tag: 'vía LaTeX', markdown: 'Calidad de imprenta. Matex genera el LaTeX y lo compila por vos.' },
              { title: 'Página web', tag: 'HTML', markdown: 'Se adapta a cualquier pantalla y los gráficos con parámetros se vuelven interactivos.' },
              { title: 'LaTeX', tag: '.tex', markdown: 'El código generado, prolijo y con buenas prácticas, por si querés seguir a mano.' },
              { title: 'El modelo', tag: '.mtex', markdown: 'El documento en sí, para guardarlo, compartirlo o volver a abrirlo.' },
            ],
          },
          {
            kind: 'callout',
            tone: 'tip',
            markdown:
              'No necesitás saber LaTeX para usar Matex. Si lo sabés, lo vas a reconocer en cada salida: es el LaTeX que escribiría alguien con experiencia.',
          },
          {
            kind: 'cta',
            action: 'start-matex',
            label: 'Crear un documento Matex',
            markdown: '¿Querés probarlo ya? Se abre un documento de ejemplo listo para editar.',
          },
        ],
      },
      {
        id: 'intencion',
        title: 'Intención, no formato',
        summary: 'La idea que hace funcionar todo: decís qué es cada cosa y cada salida resuelve cómo se ve.',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'En un procesador de texto, para que algo *parezca* un teorema lo ponés en negrita, lo numerás a mano y esperás que no se desacomode. En Matex insertás un **Teorema**, y listo: la numeración, el estilo y las referencias salen solos.',
          },
          {
            kind: 'animation',
            id: 'intencion',
            caption: 'Marcás un Teorema una sola vez. El PDF lo escribe en LaTeX y la web en HTML; ninguno de los dos te pide nada más.',
          },
          {
            kind: 'prose',
            markdown:
              'Eso tiene consecuencias muy concretas:\n\n- **Cambiar el diseño no rompe nada.** Pasás de Estándar a Moderno y todo se reacomoda, porque el contenido nunca supo de fuentes ni de márgenes.\n- **La numeración se mantiene sola.** Agregás un teorema en el medio y los demás se renumeran, junto con cada referencia que los nombra.\n- **Las salidas no se contradicen.** El PDF y la web salen del mismo modelo: lo que dice uno, lo dice el otro.',
          },
          {
            kind: 'callout',
            tone: 'note',
            markdown:
              '¿Y si necesitás algo que Matex no modela? Hay dos escotillas en **Insertar**: **LaTeX crudo**, para un fragmento puntual, e **Incluir archivo**, para traer un `.tex` propio. Usalas como excepción: lo que entra por ahí lo entiende el PDF, pero Matex no sabe *qué es*.',
          },
        ],
      },
      {
        id: 'primer-documento',
        title: 'Tu primer documento',
        summary: 'De cero a un PDF en cinco pasos.',
        blocks: [
          {
            kind: 'steps',
            items: [
              {
                title: 'Andá a Mis Proyectos',
                markdown: 'Es tu taller: ahí quedan todos tus documentos, organizados en carpetas. Tocá **Nuevo proyecto**.',
              },
              {
                title: 'Elegí «Visual (Matex)»',
                markdown:
                  'En **¿Cómo querés editar?** elegí **Visual (Matex)**. Después arrancá de una plantilla (**Empezar rápido**) o de un documento completo (**Estudiar un ejemplo**).',
              },
              {
                title: 'Escribí',
                markdown:
                  'Como en cualquier editor. Para títulos, listas y negrita está **Formato**; para fórmulas, teoremas, tablas y gráficos, **Insertar**.',
              },
              {
                title: 'Mirá la vista previa',
                markdown:
                  'El panel de la derecha muestra el documento como **PDF**, **HTML**, **LaTeX** o **AST**. El HTML se actualiza mientras escribís; el PDF, cuando tocás **Compilar**.',
              },
              {
                title: 'Descargalo',
                markdown: 'Como PDF, página web, LaTeX o proyecto Matex completo. Mientras tanto, todo se guarda solo.',
              },
            ],
          },
          { kind: 'cta', action: 'projects', label: 'Ir a Mis Proyectos' },
        ],
      },
    ],
  },
  {
    title: 'Escribir',
    pages: [
      {
        id: 'editor',
        title: 'El editor',
        summary: 'Escribís a la izquierda; a la derecha ves el mismo documento de cuatro maneras.',
        blocks: [
          {
            kind: 'animation',
            id: 'vista-previa',
            caption: 'La vista previa: PDF (compilado), HTML (en vivo), LaTeX y AST. Las cuatro son el mismo documento.',
          },
          { kind: 'prose', markdown: 'Arriba del documento hay dos menús:' },
          {
            kind: 'cards',
            items: [
              {
                title: 'Formato ▾',
                markdown: 'Negrita, cursiva, código en línea, títulos (H1 y H2) y listas con viñetas o numeradas.',
              },
              {
                title: 'Insertar ▾',
                markdown:
                  'Fórmulas y derivaciones, teoremas y definiciones, cajas, tablas, figuras y gráficos, código, referencias, citas, notas al pie, diapositivas y columnas.',
              },
            ],
          },
          {
            kind: 'prose',
            markdown:
              '**La barra de contexto.** Cuando el cursor está en un bloque, aparece una barra con sus opciones. En una tabla: agregar o quitar filas y columnas, encabezado, alineación y epígrafe. En una ecuación: numerar cada fila. En una figura: epígrafe, tamaño y etiqueta. En un teorema: cambiar su tipo.',
          },
          {
            kind: 'prose',
            markdown:
              '**La vista previa.** El **HTML** se actualiza con cada tecla, y si el documento tiene gráficos con parámetros, sus sliders funcionan ahí mismo. El **PDF** se compila al abrir el documento y cada vez que tocás **Compilar**; si escribiste algo desde entonces, aparece **● desactualizado**. **LaTeX** y **AST** muestran lo que Matex genera y guarda, de solo lectura. El panel se puede colapsar para escribir con más espacio.',
          },
          {
            kind: 'callout',
            tone: 'tip',
            markdown: 'No hay botón de guardar: Matex guarda solo, mientras escribís.',
          },
        ],
      },
      {
        id: 'matematica',
        title: 'Matemática',
        summary: 'Fórmulas en línea y en bloque, derivaciones alineadas y una paleta con todos los símbolos.',
        blocks: [
          {
            kind: 'cards',
            items: [
              { title: 'Fórmula en línea', markdown: 'Dentro del párrafo, como el *a² + b² = c²* de esta frase. Atajo: escribí `$$`.' },
              { title: 'Fórmula en bloque', markdown: 'Centrada, en su propio renglón.' },
              {
                title: 'Derivación',
                markdown: 'Varias ecuaciones alineadas (por ejemplo, en el `=`). Cada fila se numera con **Nº** y se agregan con **+ fila**.',
              },
              { title: 'Razonamiento', markdown: 'A dos columnas: cada paso con su justificación al lado.' },
            ],
          },
          {
            kind: 'prose',
            markdown:
              '**Adentro de una fórmula se escribe LaTeX**, el idioma universal de la matemática. Si no te acordás de un comando, escribí `\\` y empezá a tipear: aparece un autocompletado.',
          },
          {
            kind: 'prose',
            markdown:
              '**Símbolos ▾** abre una paleta con buscador, organizada en pestañas: Común, Lógica, Relaciones, Conjuntos, Operadores, Cálculo, Griego, Flechas, Delimitadores, Acentos, Estructuras y Fuentes. **Casos ▾** arma funciones partidas: cada rama es un valor *si* una condición.',
          },
          {
            kind: 'keys',
            items: [
              { keys: ['$$'], desc: 'Insertar una fórmula en línea.' },
              { keys: ['\\', 'letras'], desc: 'Autocompletar un comando dentro de una fórmula.' },
              { keys: ['↑', '↓', 'Enter', 'Tab'], desc: 'Moverse por el autocompletado y elegir.' },
              { keys: ['Enter', 'Esc'], desc: 'Cerrar el editor de la fórmula.' },
            ],
          },
        ],
      },
      {
        id: 'teoremas',
        title: 'Teoremas y referencias',
        summary: 'Entornos numerados, demostraciones, referencias que se actualizan solas, citas y bibliografía.',
        blocks: [
          {
            kind: 'prose',
            markdown:
              '**Insertar** ofrece Teorema, Definición y Demostración. Con el cursor adentro, el **Tipo** de la barra de contexto lo cambia entre Teorema, Lema, Proposición, Corolario, Definición, Ejemplo, Observación y Demostración. Todos pueden llevar un título y una etiqueta, y se numeran en vivo mientras escribís.',
          },
          {
            kind: 'callout',
            tone: 'tip',
            markdown:
              '**Demostraciones diferidas.** Una demostración puede ir lejos de su enunciado: en **Demuestra** elegís qué resultado demuestra y Matex escribe la referencia.',
          },
          {
            kind: 'prose',
            markdown:
              '**Cajas.** **Insertar → Caja / Nota** crea un recuadro de tipo 📝 Nota, 💡 Consejo, ⚠️ Cuidado o ❗ Importante, con título opcional.',
          },
          {
            kind: 'prose',
            markdown:
              '**Referencias cruzadas.** Escribí `@` (o **Insertar → Referencia**) y elegí de la lista qué querés nombrar: un teorema, una ecuación, una figura. Elegís el **objeto**, no tipeás una etiqueta: si su número cambia, la referencia lo sigue.',
          },
          {
            kind: 'prose',
            markdown:
              '**Citas y bibliografía.** Escribí `#` (o **Insertar → Cita**) y elegí la obra; cada cita se muestra como *[cita]* o como *Autor (año)*. Las obras se cargan en la ventana **Bibliografía**: libro, artículo, capítulo, ponencia, tesis o recurso web, o pegando BibTeX con **Importar BibTeX…**. El estilo puede ser numérico [1], autor-año o alfabético. Si una cita apunta a una obra que no existe, se marca en rojo.',
          },
          {
            kind: 'keys',
            items: [
              { keys: ['@'], desc: 'Insertar una referencia cruzada.' },
              { keys: ['#'], desc: 'Insertar una cita.' },
              { keys: ['Ctrl/⌘', 'clic'], desc: 'Sobre una referencia: ir a lo que nombra.' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Gráficos',
    pages: [
      {
        id: 'graficos',
        title: 'Gráficos',
        summary: 'Decís qué querés mostrar —una función, una comparación, una distribución— y Matex lo dibuja.',
        blocks: [
          {
            kind: 'animation',
            id: 'grafico',
            caption:
              'Una función con dos parámetros. En la vista HTML, cada parámetro con mínimo y máximo es un slider; la derivada, el área y la tangente son anotaciones del mismo gráfico.',
          },
          { kind: 'prose', markdown: 'En **Insertar → Figura**, Matex pregunta **¿Qué querés mostrar?** y ofrece:' },
          {
            kind: 'cards',
            items: [
              {
                title: 'Gráfico de funciones',
                tag: 'el más completo',
                markdown: 'Curvas explícitas, paramétricas, polares, implícitas, cónicas y series de datos, con parámetros que se vuelven sliders.',
              },
              {
                title: 'Barras y torta',
                tag: 'comparar · repartir',
                markdown: 'Barras (también apiladas u horizontales), línea de tendencia o torta, a partir de una tabla de categorías.',
              },
              {
                title: 'Histograma y boxplot',
                tag: 'distribución',
                markdown: 'Pegás las muestras y Matex arma los intervalos.',
              },
              {
                title: 'Diagrama conmutativo',
                tag: 'estructura',
                markdown: 'Objetos en una grilla y flechas: ↪ mono, ↠ epi, ↦ mapsto; continuas, a guiones o punteadas.',
              },
              { title: 'Árbol', tag: 'jerarquía', markdown: 'Cada nodo con su etiqueta y su padre.' },
              { title: 'Imagen', markdown: 'Una imagen tuya, con epígrafe y tamaño.' },
            ],
          },
          {
            kind: 'prose',
            markdown:
              '**El gráfico de funciones, en detalle.** Su inspector tiene tres pestañas:\n\n- **Curvas** — cada curva con su color, trazo y rol (principal, secundaria, derivada…). Podés marcar raíces, extremos, inflexiones y asíntotas, sombrear arriba o abajo, partir la función en ramas o restringir su dominio. Una curva puede usar a otra (`f1`, `f2`). Los **Parámetros** con mínimo y máximo se vuelven sliders.\n- **Ejes** — título, dominio, rango, grilla, leyenda, ejes iguales y marcas en múltiplos de π.\n- **Anotaciones** — áreas (integrales, entre curvas, sumas de Riemann), puntos, rectas verticales y horizontales, tangentes, textos e intersecciones.',
          },
          {
            kind: 'callout',
            tone: 'tip',
            markdown:
              '**Subfiguras.** Una figura puede tener varias partes —una función y un histograma, dos imágenes—. Con dos o más, Matex las rotula (a), (b)… y cada una lleva su subepígrafe.',
          },
          {
            kind: 'callout',
            tone: 'note',
            markdown:
              'Cada gráfico se dibuja dos veces: en el **PDF**, con pgfplots (nativo de LaTeX), y en la **web**, como SVG. No es una captura: los dos salen del mismo modelo.',
          },
        ],
      },
    ],
  },
  {
    title: 'Diseño y salida',
    pages: [
      {
        id: 'diseno',
        title: 'Diseño del documento',
        summary: 'El mismo contenido, otra presentación: tipo de documento, estructura, estilo, acento y márgenes.',
        blocks: [
          {
            kind: 'animation',
            id: 'diseno',
            caption: 'Cambiar el diseño no toca el contenido: Estándar, Clásico, Moderno con acento naranja y, al final, a dos columnas.',
          },
          { kind: 'prose', markdown: 'Todo se elige en la ventana **Documento**:' },
          {
            kind: 'cards',
            items: [
              { title: 'Familia', markdown: 'Documento normal, Presentación (beamer), Carta, Examen, Currículum (CV) o Póster.' },
              { title: 'Estructura', markdown: 'Artículo (secciones), Informe (capítulos) o Libro (capítulos y partes).' },
              { title: 'Diseño', markdown: 'Estándar, Clásico o Moderno.' },
              { title: 'Acento', markdown: 'El del diseño, o azul, verde, naranja, rojo, violeta, gris o negro.' },
              { title: 'Márgenes', markdown: 'Los de la clase, amplios, normales o estrechos.' },
              { title: 'Extras', markdown: 'Índice general, portada en página propia y dos columnas.' },
            ],
          },
          {
            kind: 'prose',
            markdown:
              '**Cada familia agrega lo suyo.** Una carta pide remitente, destinatario, saludo, despedida y firma; un examen, su consigna; un CV, subtítulo, email y dirección; un póster, cuántas columnas tiene su grilla. Las presentaciones toman su aspecto del diseño y el acento, y se arman con **Insertar → Diapositiva**: cada diapositiva puede revelar su contenido de a uno.',
          },
          {
            kind: 'prose',
            markdown:
              '**Portada y bibliografía** tienen sus propias ventanas: título, autores (con afiliación y email), institución, resumen y fecha, por un lado; las obras citadas y su estilo, por el otro.',
          },
          {
            kind: 'callout',
            tone: 'note',
            markdown: '**Dos columnas** es una decisión del PDF: en la web el texto va en una sola columna, porque la pantalla no se pagina.',
          },
          {
            kind: 'callout',
            tone: 'warning',
            markdown:
              'Las preguntas de examen, las entradas de CV y los bloques de póster vienen en las plantillas y los ejemplos, pero **todavía no se pueden insertar** desde el editor.',
          },
        ],
      },
      {
        id: 'exportar',
        title: 'Exportar y compartir',
        summary: 'Bajá el documento en el formato que necesites, o llevátelo entero.',
        blocks: [
          {
            kind: 'cards',
            items: [
              { title: 'PDF', markdown: 'Si está desactualizado, Matex lo recompila antes de bajarlo.' },
              {
                title: 'Página web (.html)',
                markdown: 'Un solo archivo autónomo: la matemática en MathML y los gráficos en SVG. Se abre en cualquier navegador.',
              },
              {
                title: 'LaTeX (.tex o .zip)',
                markdown: 'El código generado. Si el documento usa imágenes u otros archivos, viene en un `.zip` listo para compilar.',
              },
              { title: 'Proyecto Matex (.zip)', markdown: 'El modelo con sus imágenes y recursos: la copia completa.' },
              { title: 'Matex (.mtex)', markdown: 'Solo el modelo, sin recursos.' },
            ],
          },
          {
            kind: 'prose',
            markdown:
              '**Los archivos del proyecto.** El panel **Archivos** guarda imágenes, `.tex`, `.bib`, `.cls`, `.sty`, `.dat`, `.csv` y `.txt`. Desde ahí insertás una imagen como figura o un `.tex` con `\\input`.',
          },
          {
            kind: 'prose',
            markdown:
              '**Importar.** En Mis Proyectos podés traer un `.mtex` o un proyecto Matex en `.zip`, y sigue exactamente donde lo dejaste.',
          },
        ],
      },
    ],
  },
  {
    title: 'Por dentro',
    pages: [
      {
        id: 'modelo',
        title: 'El modelo (AST)',
        summary: 'Lo que Matex guarda de verdad: un árbol que describe tu documento.',
        blocks: [
          {
            kind: 'prose',
            markdown:
              'Detrás del editor no hay texto con formato: hay un **árbol**. La raíz es el documento; sus ramas son los bloques (títulos, párrafos, ecuaciones, teoremas); y dentro de cada bloque, lo que contiene (texto, fórmulas en línea, referencias).',
          },
          {
            kind: 'animation',
            id: 'arbol',
            caption: 'Cada bloque que escribís es un nodo del árbol. El editor, el PDF y la web leen el mismo árbol.',
          },
          {
            kind: 'prose',
            markdown:
              'Ese árbol se llama **AST** (*abstract syntax tree*) y es, literalmente, el lenguaje de Matex: no hay una sintaxis que aprender, porque el editor es la forma de escribirlo. Lo podés mirar en la pestaña **AST** de la vista previa y guardarlo tal cual como `.mtex`.',
          },
          {
            kind: 'prose',
            markdown:
              '**Por qué un árbol.** El modelo no guarda nombres de paquetes ni de comandos de LaTeX: guarda **intención** (qué familia de documento, qué estilo, qué acento) y cada salida la traduce a su manera. Por eso existe la web además del PDF, y por eso una salida nueva no obliga a reescribir tus documentos.',
          },
          {
            kind: 'callout',
            tone: 'note',
            markdown:
              '**Tus documentos viejos siguen abriendo.** El modelo tiene versión (hoy, la 4). Si abrís un `.mtex` de una versión anterior, Matex lo actualiza solo. En casos raros —un tema de diseño muy específico de una versión vieja— se elige el estilo más parecido.',
          },
        ],
      },
      {
        id: 'atajos',
        title: 'Atajos',
        summary: 'Lo que conviene tener a mano mientras escribís.',
        blocks: [
          {
            kind: 'keys',
            items: [
              { keys: ['$$'], desc: 'Fórmula en línea.' },
              { keys: ['@'], desc: 'Referencia cruzada.' },
              { keys: ['#'], desc: 'Cita.' },
              { keys: ['\\', 'letras'], desc: 'En una fórmula: autocompletar un comando.' },
              { keys: ['Enter'], desc: 'Sobre una fórmula, referencia o cita seleccionada: abrirla para editar.' },
              { keys: ['Esc'], desc: 'Cerrar el editor de una fórmula.' },
              { keys: ['Ctrl/⌘', 'Enter'], desc: 'Salir de un bloque: agrega un párrafo después.' },
              { keys: ['Ctrl/⌘', 'clic'], desc: 'Sobre una referencia: ir a lo que nombra.' },
              { keys: ['Ctrl/⌘', 'B'], desc: 'Negrita.' },
              { keys: ['Ctrl/⌘', 'I'], desc: 'Cursiva.' },
              { keys: ['Ctrl/⌘', 'Z'], desc: 'Deshacer.' },
            ],
          },
        ],
      },
    ],
  },
]

export const allPages: readonly WikiPage[] = wikiGroups.flatMap((group) => group.pages)

export function findPage(id: string): WikiPage | undefined {
  return allPages.find((page) => page.id === id)
}
