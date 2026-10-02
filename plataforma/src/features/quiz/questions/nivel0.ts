import type { Question } from '../types'

export const nivel0Questions: Question[] = [
  {
    id: 'q-l0-bienvenida-1',
    lessonId: 'l0-bienvenida',
    level: 0,
    prompt: '¿Qué hace el compilador de LaTeX?',
    answer: 'Convierte el texto con marcas en un PDF',
    distractors: [
      'Corrige la ortografía del texto escrito',
      'Traduce el documento a formato Word',
      'Acomoda el texto mientras lo escribís',
    ],
    explanation:
      'En LaTeX escribís texto plano con marcas (\\section, \\emph, ecuaciones) y el compilador lo procesa para producir el PDF final. No es un editor visual: la forma la decide al compilar, no mientras tipeás.',
  },
  {
    id: 'q-l0-bienvenida-2',
    lessonId: 'l0-bienvenida',
    level: 0,
    prompt: '¿Quién creó TeX, el motor sobre el que se construyó LaTeX?',
    answer: 'Donald Knuth',
    distractors: ['Leslie Lamport', 'Alan Turing', 'Linus Torvalds'],
    explanation:
      'Knuth creó TeX en 1978, disconforme con la tipografía de sus libros. Leslie Lamport construyó LaTeX encima en 1984: por eso es el distractor más tentador.',
  },
  {
    id: 'q-l0-bienvenida-3',
    lessonId: 'l0-bienvenida',
    level: 0,
    prompt: '¿En qué tipo de trabajo se luce LaTeX frente a un procesador de texto?',
    answer: 'Documentos largos con mucha matemática',
    distractors: [
      'Notas cortas editadas por varios a la vez',
      'Planillas con cálculos y gráficos dinámicos',
      'Cartas rápidas con formato visual al instante',
    ],
    explanation:
      'LaTeX brilla con matemática y documentos largos y estructurados, donde numeración, índices y referencias se mantienen solos. Para colaborar en tiempo real o escribir algo corto y rápido, un procesador suele ser mejor opción.',
  },
  {
    id: 'q-l0-pensar-1',
    lessonId: 'l0-pensar-documento',
    level: 0,
    prompt: 'Según la filosofía de Matex, ¿en qué orden conviene pensar un documento?',
    answer: 'Primero el significado, después la forma',
    distractors: [
      'Primero la forma, después el significado',
      'Primero los paquetes, después el texto',
      'Primero los márgenes, después el contenido',
    ],
    explanation:
      'La tesis es “significado → forma → carpintería”: declarás qué es cada cosa (sección, teorema) y dejás el aspecto para temas y paquetes. Pensar la forma primero lleva a ajustes manuales y frágiles.',
  },
  {
    id: 'q-l0-primer-1',
    lessonId: 'l0-primer-documento',
    level: 0,
    prompt: '¿Qué comando declara el tipo de documento?',
    answer: '\\documentclass{article}',
    distractors: ['\\documentstyle{article}', '\\usepackage{article}', '\\begindocument{article}'],
    explanation:
      '\\documentclass{...} es la primera línea y fija la clase. \\documentstyle es de LaTeX 2.09 (obsoleto); \\usepackage carga paquetes, no clases; \\begindocument no existe.',
  },
  {
    id: 'q-l0-primer-2',
    lessonId: 'l0-primer-documento',
    level: 0,
    prompt: '¿Dónde va el contenido visible del documento?',
    answer: 'Entre \\begin{document} y \\end{document}',
    distractors: [
      'Entre \\documentclass y \\usepackage',
      'Después de \\end{document}, al final',
      'Dentro de \\documentclass{...}, con llaves',
    ],
    explanation:
      'Todo lo visible va dentro del entorno document. Lo anterior a \\begin{document} es el preámbulo (configuración) y lo posterior a \\end{document} se ignora.',
  },
  {
    id: 'q-l0-estructura-1',
    lessonId: 'l0-estructura-texto',
    level: 0,
    prompt: '¿Cómo se separan dos párrafos en LaTeX?',
    answer: 'Con una línea en blanco entre ellos',
    distractors: [
      'Con un único salto de línea simple',
      'Con el comando \\newline al final',
      'Con dos barras \\\\ al final de la línea',
    ],
    explanation:
      'Un salto de línea simple NO crea párrafo: LaTeX une el texto. La línea en blanco es la señal de párrafo nuevo. \\newline y \\\\ fuerzan un salto de renglón, no un párrafo.',
  },
  {
    id: 'q-l0-listas-1',
    lessonId: 'l0-listas',
    level: 0,
    prompt: '¿Qué comando inicia cada elemento de una lista?',
    answer: '\\item',
    distractors: ['\\bullet', '\\entry', '\\point'],
    explanation:
      'Dentro de itemize/enumerate, cada elemento empieza con \\item. \\bullet es solo el símbolo de viñeta en modo math; \\entry y \\point no existen.',
  },
  {
    id: 'q-l0-mate-1',
    lessonId: 'l0-matematica-basica',
    level: 0,
    prompt: '¿Cómo se escribe una fracción en modo matemático?',
    answer: '\\frac{a}{b}',
    distractors: ['\\frac(a)(b)', '\\fraction{a}{b}', '\\dfrac[a][b]'],
    explanation:
      '\\frac{num}{den} usa llaves. Los paréntesis o corchetes no sirven, y \\fraction no existe. (\\dfrac sí existe —fracción “display”— pero también con llaves: \\dfrac{a}{b}.)',
  },
  {
    id: 'q-l0-compilar-1',
    lessonId: 'l0-compilar-errores',
    level: 0,
    prompt: 'En un error de LaTeX, ¿qué indica la referencia “l.N” del log?',
    answer: 'El número de línea donde se rompió',
    distractors: [
      'El nivel de gravedad del error',
      'La cantidad de líneas del archivo',
      'El idioma configurado del documento',
    ],
    explanation:
      'El log marca con “l.N” la línea N donde TeX se detuvo. Conviene leer el primer error: los que siguen suelen ser su consecuencia.',
  },
  {
    id: 'q-l0-caracteres-1',
    lessonId: 'l0-caracteres-especiales',
    level: 0,
    prompt: '¿Cómo se escribe un símbolo de porcentaje literal en el texto?',
    answer: '\\%',
    distractors: ['%', '\\percent', '{%}'],
    explanation:
      'El % es un carácter reservado: inicia un comentario, así que el resto de la línea se ignora. Para mostrarlo literal hay que escaparlo: \\%.',
  },
  {
    id: 'q-l0-base-1',
    lessonId: 'l0-base-preambulo',
    level: 0,
    prompt: '¿Por qué casi todos los ejemplos de la plataforma comparten las mismas líneas de preámbulo?',
    answer: 'Son la “base” recomendada que conviene tener en todo documento en español',
    distractors: [
      'Son obligatorias en LaTeX; sin ellas no compila',
      'Es una limitación del editor de la plataforma',
      'Cada ejemplo las copió por error del anterior',
    ],
    explanation:
      'Son el “piso” (fontenc, lmodern, babel+es-noshorthands, microtype): no son obligatorias para compilar, pero mejoran acentos, fuentes y tipografía. El detalle está en “El canon del preámbulo” (Nivel 1).',
  },
]
