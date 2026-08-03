import type { Question } from '../types'

export const nivel4Questions: Question[] = [
  {
    id: 'q-l4-cond-1',
    lessonId: 'l4-condicionales',
    level: 4,
    prompt: '¿Con qué se cierra un bloque condicional creado con \\newif?',
    answer: '\\fi',
    distractors: ['\\endif', '\\end{if}', '\\fin'],
    explanation:
      'La estructura es \\ifbandera ... \\fi (sintaxis de TeX). No se usa \\endif ni \\end{if} (no es un entorno), y \\fin no existe.',
  },
  {
    id: 'q-l4-prog-1',
    lessonId: 'l4-programacion',
    level: 4,
    prompt: '¿Qué comando recorre un rango repitiendo contenido?',
    answer: '\\foreach \\n in {1,...,5}{...}',
    distractors: [
      '\\for \\n = 1 to 5 {...}',
      '\\loop \\n in {1,...,5}{...}',
      '\\repeat \\n from 1 to 5 {...}',
    ],
    explanation:
      '\\foreach (del paquete pgffor) recorre listas o rangos con la sintaxis in {…}. Las otras formas son sintaxis de otros lenguajes, no de LaTeX.',
  },
  {
    id: 'q-l4-paquetes-1',
    lessonId: 'l4-paquetes-propios',
    level: 4,
    prompt: '¿Qué comando define algo solo si no existe ya (evitando choques)?',
    answer: '\\providecommand{\\x}{...}',
    distractors: ['\\newcommand{\\x}{...}', '\\ensurecommand{\\x}{...}', '\\defifnew{\\x}{...}'],
    explanation:
      '\\providecommand define el comando solo si no estaba definido. \\newcommand da error si ya existe; los otros dos no existen.',
  },
  {
    id: 'q-l4-flujo-1',
    lessonId: 'l4-flujo',
    level: 4,
    prompt: '¿Cómo se escribe un comentario que no aparece en el PDF?',
    answer: 'Con % al inicio del texto a ignorar',
    distractors: [
      'Con // al inicio de la línea',
      'Con /* ... */ alrededor del texto',
      'Con \\comment{...} alrededor del texto',
    ],
    explanation:
      'En LaTeX, el % ignora el resto de la línea. // y /* */ son de otros lenguajes. (Existe un entorno comment con un paquete, pero el comentario básico es %.)',
  },
  {
    id: 'q-l4-publicacion-1',
    lessonId: 'l4-publicacion',
    level: 4,
    prompt: '¿Qué herramienta convierte LaTeX a Word, HTML o Markdown?',
    answer: 'pandoc',
    distractors: ['latexmk', 'biber', 'fontspec'],
    explanation:
      'pandoc convierte entre formatos (LaTeX ↔ docx ↔ HTML ↔ Markdown…). latexmk solo automatiza la compilación a PDF; biber procesa bibliografía; fontspec maneja fuentes en Xe/LuaLaTeX.',
  },
  {
    id: 'q-l4-expl3-1',
    lessonId: 'l4-expl3',
    level: 4,
    prompt: '¿Entre qué comandos se escribe el código de expl3?',
    answer: '\\ExplSyntaxOn ... \\ExplSyntaxOff',
    distractors: ['\\begin{expl3} ... \\end{expl3}', '\\ExplOn ... \\ExplOff', '\\usepackage{expl3}'],
    explanation:
      'El código expl3 va entre \\ExplSyntaxOn y \\ExplSyntaxOff (ahí _ y : son parte de los nombres). No es un entorno ni hace falta cargar un paquete: ya está en el núcleo.',
  },
  {
    id: 'q-l4-inyectar-1',
    lessonId: 'l4-inyectar',
    level: 4,
    prompt: '¿Qué paquete ejecuta Python durante la compilación y captura los resultados?',
    answer: 'pythontex',
    distractors: ['minted', 'listings', 'verbatim'],
    explanation:
      'pythontex corre Python (con shell-escape) y captura resultados/figuras. minted usa Python solo para resaltar; listings y verbatim solo muestran texto literal.',
  },
  {
    id: 'q-l4-instalacion-1',
    lessonId: 'l4-instalacion',
    level: 4,
    prompt: '¿Qué herramienta automatiza todas las pasadas de compilación (motor, biber, índices)?',
    answer: 'latexmk',
    distractors: ['pandoc', 'biber', 'tlmgr'],
    explanation:
      'latexmk orquesta las pasadas e invoca biber/makeindex cuando hace falta. pandoc convierte formatos; biber es un paso (bibliografía); tlmgr instala paquetes.',
  },
  {
    id: 'q-l4-accesibilidad-1',
    lessonId: 'l4-accesibilidad',
    level: 4,
    prompt: 'Para un PDF más accesible, ¿qué conviene hacer?',
    answer: 'Declarar el idioma y los metadatos del PDF',
    distractors: [
      'Subir el tamaño de la letra y nada más',
      'Distinguir la información solo por color',
      'Quitar todos los enlaces del documento',
    ],
    explanation:
      'Declarar idioma (pdflang) y metadatos, agregar texto alternativo y no depender solo del color mejora la accesibilidad. El tamaño de letra por sí solo no alcanza.',
  },
  {
    id: 'q-l4-especiales-1',
    lessonId: 'l4-documentos-especiales',
    level: 4,
    prompt: '¿Qué clase está pensada para un currículum (CV)?',
    answer: 'moderncv',
    distractors: ['exam', 'tikzposter', 'letter'],
    explanation:
      'moderncv (o altacv) es para CV. exam es para exámenes, tikzposter para pósters y letter para cartas.',
  },
  {
    id: 'q-l4-antipatrones-1',
    lessonId: 'l4-antipatrones',
    level: 4,
    prompt: '¿Cuál es el reemplazo correcto del obsoleto eqnarray?',
    answer: 'align (del paquete amsmath)',
    distractors: [
      '$$ ... $$ centrado',
      'el entorno array',
      'eqnarray*, que sí es moderno',
    ],
    explanation:
      'eqnarray tiene el espaciado roto; align (de amsmath) es el reemplazo. $$ también es obsoleto, array es para matrices, y eqnarray* comparte el mismo problema que eqnarray.',
  },
  {
    id: 'q-l4-antipatrones-2',
    lessonId: 'l4-antipatrones',
    level: 4,
    prompt: '¿Para qué sirve el paquete nag con la opción [l2tabu]?',
    answer: 'Avisa en el log cuando usás comandos obsoletos',
    distractors: [
      'Acelera la compilación cacheando figuras',
      'Numera las ecuaciones automáticamente',
      'Genera la bibliografía a partir de un .bib',
    ],
    explanation:
      'nag[l2tabu,orthodox] convierte la lista de anti-patrones en avisos automáticos al compilar: es un profesor de buenas prácticas. Se quita en la versión final.',
  },
]
