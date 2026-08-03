import type { MatexDoc } from '../../matex/core'

/**
 * **Versiones Matex (AST) de los ejemplares de la Galería** (ME-23). A diferencia de las plantillas
 * (puntos de partida), acá el documento es **completo y se estudia**: muestra cómo el modelo
 * semántico expresa cada tipo de documento y sale a LaTeX *y* HTML desde un solo AST.
 *
 * Todas las familias tienen versión Matex: prosa académica (article/report/book/KOMA),
 * presentación, carta, examen, CV y póster. Cada una se declara con `meta.family` (AR-09).
 */

const t = (text: string) => ({ type: 'text' as const, text })
const m = (tex: string) => ({ type: 'mathInline' as const, tex })
const p = (...content: object[]) => ({ type: 'paragraph' as const, content: content as never })
const li = (text: string) => ({ type: 'listItem' as const, content: [p(t(text))] })
const h = (level: 1 | 2 | 3, text: string) => ({ type: 'heading' as const, level, content: [t(text)] })
const row = (cells: string[]) => ({ type: 'tableRow' as const, cells: cells.map((c) => ({ type: 'tableCell' as const, content: [t(c)] })) })

/** Informe KOMA (scrartcl): informe técnico con resumen, secciones, tabla y conclusión. */
export const komaMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Medición del período de un péndulo',
    author: 'Estudiante',
    institution: 'Laboratorio de Cálculo',
    date: '2026',
    style: 'modern',
    abstract:
      'Medimos el período de un péndulo simple para distintas longitudes y verificamos la relación T = 2π·√(L/g). El valor estimado de g concuerda con el esperado dentro del error experimental.',
  },
  content: [
    h(1, 'Introducción'),
    p(t('El péndulo simple es un sistema clásico cuyo período, para oscilaciones pequeñas, no depende de la masa ni de la amplitud, sino solo de la longitud:')),
    { type: 'mathDisplay', rows: [{ tex: 'T = 2\\pi\\sqrt{\\dfrac{L}{g}}' }] },
    h(1, 'Resultados'),
    p(t('La tabla resume las mediciones realizadas:')),
    {
      type: 'table',
      header: true,
      caption: 'Período medido según la longitud.',
      id: 'tab-pendulo',
      align: ['center', 'center'],
      rows: [row(['L (m)', 'T (s)']), row(['0.25', '1.00']), row(['0.50', '1.42']), row(['1.00', '2.01'])],
    },
    p(t('Los datos siguen la dependencia '), m('T \\propto \\sqrt{L}'), t(' esperada, como muestra el ajuste:')),
    {
      type: 'figure',
      caption: 'Período en función de la longitud.',
      id: 'fig-pendulo',
      items: [{ kind: 'plot', spec: { functions: [{ expr: '2*pi*sqrt(x/9.81)', legend: 'T teórico' }], domain: [0, 1.2], grid: true, xlabel: 'L', ylabel: 'T' } }],
    },
    h(1, 'Conclusiones'),
    {
      type: 'bulletList',
      items: [li('El período crece con la raíz de la longitud, como predice el modelo.'), li('La masa no influye en el período para oscilaciones pequeñas.')],
    },
  ],
}

/** Monografía (report): documento largo con capítulos, teorema, gráfico y bibliografía. */
export const monografiaMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'El método de Newton–Raphson',
    author: 'Cátedra de Laboratorio de Cálculo',
    date: '2026',
    docKind: 'report',
    titlePage: true,
    toc: true,
    abstract: 'Estudiamos el método de Newton–Raphson: su deducción geométrica, su convergencia cuadrática y sus modos de fallo.',
  },
  references: [
    { key: 'burden2011', type: 'book', author: 'R. L. Burden y J. D. Faires', title: 'Análisis numérico', publisher: 'Cengage Learning', year: '2011', edition: '9' },
    { key: 'stoer2002', type: 'book', author: 'J. Stoer y R. Bulirsch', title: 'Introduction to Numerical Analysis', publisher: 'Springer', year: '2002' },
  ],
  content: [
    h(1, 'Introducción'),
    p(
      t('El método de Newton–Raphson aproxima una raíz de '),
      m('f'),
      t(' reemplazando la curva por su recta tangente y tomando la intersección con el eje. La iteración es '),
      m('x_{n+1} = x_n - f(x_n)/f\'(x_n)'),
      t('. '),
      { type: 'cite', keys: ['burden2011'] },
      t('.'),
    ),
    {
      type: 'figure',
      caption: 'La tangente en un punto y su corte con el eje: el siguiente iterado.',
      id: 'fig-newton',
      items: [
        {
          kind: 'plot',
          spec: {
            functions: [{ expr: 'x^2 - 2', markRoots: true, featureCoords: true }],
            tangents: [{ fn: 0, at: 2, showValue: true }],
            domain: [0, 2.6],
            grid: true,
          },
        },
      ],
    },
    h(1, 'Convergencia'),
    {
      type: 'theorem',
      variant: 'theorem',
      id: 'thm-newton',
      title: 'Convergencia cuadrática',
      content: [
        p(
          t('Si '),
          m('f'),
          t(' es dos veces derivable, '),
          m("f'(r) \\neq 0"),
          t(' y '),
          m('x_0'),
          t(' está suficientemente cerca de la raíz '),
          m('r'),
          t(', entonces el error satisface '),
          m('|x_{n+1} - r| \\le C\\,|x_n - r|^2'),
          t('.'),
        ),
      ],
    },
    {
      type: 'theorem',
      variant: 'proof',
      proves: 'thm-newton',
      content: [
        p(
          t('Se desarrolla '),
          m('f'),
          t(' por Taylor alrededor de '),
          m('x_n'),
          t(' y se evalúa en '),
          m('r'),
          t('; el término de segundo orden domina el error. '),
          { type: 'cite', keys: ['stoer2002'] },
          t('.'),
        ),
      ],
    },
    h(1, 'Cuándo falla'),
    {
      type: 'callout',
      variant: 'warning',
      title: 'Modos de fallo',
      content: [
        {
          type: 'bulletList',
          items: [
            li('Derivada nula en el iterado: la tangente es horizontal y no corta el eje.'),
            li('Punto inicial lejano: puede diverger o caer en un ciclo.'),
            li('Raíces múltiples: la convergencia deja de ser cuadrática.'),
          ],
        },
      ],
    },
  ],
}

/** Tesina (report): estructura de trabajo largo con capítulos y método. */
export const tesinaMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Estimación de π por Monte Carlo',
    author: 'Estudiante',
    institution: 'Lic. en Matemática',
    date: '2026',
    docKind: 'report',
    titlePage: true,
    toc: true,
  },
  references: [{ key: 'robert2004', type: 'book', author: 'C. Robert y G. Casella', title: 'Monte Carlo Statistical Methods', publisher: 'Springer', year: '2004' }],
  content: [
    h(1, 'Planteo'),
    p(
      t('Si se arrojan puntos uniformes en el cuadrado '),
      m('[0,1]^2'),
      t(', la fracción que cae dentro del cuarto de círculo unitario tiende a '),
      m('\\pi/4'),
      t('. '),
      { type: 'cite', keys: ['robert2004'] },
      t('.'),
    ),
    { type: 'mathDisplay', rows: [{ tex: '\\hat{\\pi} = 4\\cdot\\frac{\\#\\{(x,y): x^2+y^2\\le 1\\}}{N}' }] },
    h(1, 'Método'),
    {
      type: 'bulletList',
      items: [li('Generar N pares uniformes en el cuadrado.'), li('Contar los que caen dentro del cuarto de círculo.'), li('Multiplicar la proporción por 4.')],
    },
    {
      type: 'figure',
      caption: 'La región de aceptación: el cuarto de círculo dentro del cuadrado.',
      id: 'fig-mc',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'sqrt(1 - x^2)', shade: 'below' }], domain: [0, 1], range: [0, 1], equalAxes: true, grid: true } }],
    },
    h(1, 'Resultados'),
    p(t('El error decrece como '), m('O(1/\\sqrt{N})'), t(': para ganar un dígito hacen falta cien veces más puntos.')),
  ],
}

/** Póster científico (`tikzposter`): bloques en dos columnas con método, resultados y conclusión. */
export const posterMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Convergencia de métodos iterativos',
    author: 'Nombre Apellido',
    institution: 'Lic. en Matemática — Laboratorio de Cálculo',
    accent: 'blue',
    family: { kind: 'poster', poster: { columns: 2 } },
  },
  content: [
    {
      type: 'posterBlock',
      title: 'Motivación',
      column: 1,
      content: [p(t('Muchos problemas no tienen solución cerrada: se aproxima la raíz de '), m('f'), t(' con un método iterativo. Comparamos bisección y Newton–Raphson.'))],
    },
    {
      type: 'posterBlock',
      title: 'Métodos',
      column: 1,
      content: [
        { type: 'mathDisplay', rows: [{ tex: 'x_{n+1} = \\frac{a_n + b_n}{2} \\quad\\text{(bisección)}' }, { tex: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)} \\quad\\text{(Newton)}' }] },
        { type: 'bulletList', items: [li('Bisección: siempre converge, orden 1.'), li('Newton: orden 2, pero puede diverger.')] },
      ],
    },
    {
      type: 'posterBlock',
      title: 'Resultados',
      column: 2,
      content: [
        p(t('La tangente de Newton acelera la convergencia cerca de la raíz:')),
        {
          type: 'figure',
          items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2 - 2', markRoots: true, featureCoords: true }], tangents: [{ fn: 0, at: 2 }], domain: [0, 2.6], grid: true } }],
        },
      ],
    },
    {
      type: 'posterBlock',
      title: 'Conclusión',
      column: 2,
      content: [{ type: 'bulletList', items: [li('Bisección para garantizar convergencia.'), li('Newton cuando hay buena estimación inicial.'), li('En la práctica: combinarlos.')] }],
    },
  ],
}

/** Currículum (`moderncv`): datos de contacto + secciones con entradas de trayectoria. */
export const cvMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    author: 'Nombre Apellido',
    accent: 'blue',
    family: { kind: 'cv', cv: { subtitle: 'Lic. en Matemática', email: 'nombre@ejemplo.edu', address: 'Ciudad, Argentina' } },
  },
  content: [
    h(1, 'Formación'),
    { type: 'cvEntry', period: '2020–2025', role: 'Lic. en Matemática', org: 'Universidad Nacional', place: 'Ciudad', detail: 'Promedio 9,1. Tesina sobre métodos numéricos.' },
    { type: 'cvEntry', period: '2019', role: 'Bachiller', org: 'Colegio Nacional', place: 'Ciudad', detail: 'Orientación en Ciencias Exactas.' },
    h(1, 'Experiencia'),
    { type: 'cvEntry', period: '2023–2025', role: 'Ayudante de cátedra', org: 'Laboratorio de Cálculo', place: 'Universidad Nacional', detail: 'Clases prácticas y corrección de trabajos.' },
    { type: 'cvEntry', period: '2022', role: 'Pasantía', org: 'Instituto de Investigación', place: 'Ciudad', detail: 'Procesamiento de datos experimentales.' },
    h(1, 'Habilidades'),
    { type: 'bulletList', items: [li('LaTeX, Python, análisis numérico.'), li('Inglés técnico (lectura y escritura).')] },
  ],
}

/**
 * Examen (`exam`): parcial con puntajes y soluciones. El **mismo AST** produce la versión del
 * alumno y la del docente cambiando una sola bandera (`exam.showSolutions`).
 */
export const examenMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Examen Parcial — Cálculo I',
    date: '2026',
    family: { kind: 'exam', exam: { instructions: 'Justificá cada respuesta. Tiempo: 2 horas. Total: 100 puntos.' } },
  },
  content: [
    {
      type: 'examQuestion',
      points: 20,
      content: [p(t('¿Cuál es la derivada de '), m('x^2'), t('? Justificá con la definición.'))],
      solution: [p(t('Por el cociente incremental, '), m("f'(x) = 2x"), t('.'))],
    },
    {
      type: 'examQuestion',
      points: 20,
      content: [p(t('Verdadero o falso: toda función continua es derivable. Justificá.'))],
      solution: [p(t('Falso: '), m('f(x)=|x|'), t(' es continua en 0 pero no derivable allí (las derivadas laterales difieren).'))],
    },
    {
      type: 'examQuestion',
      points: 30,
      content: [p(t('Calculá '), m('\\int_0^1 x^2\\,dx'), t('.'))],
      solution: [{ type: 'mathDisplay', rows: [{ tex: '\\int_0^1 x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^1 = \\frac{1}{3}' }] }],
    },
    {
      type: 'examQuestion',
      points: 30,
      content: [p(t('Demostrá que '), m('\\sqrt{2}'), t(' es irracional.'))],
      solution: [
        p(
          t('Por el absurdo: si '),
          m('\\sqrt{2} = p/q'),
          t(' irreducible, entonces '),
          m('p^2 = 2q^2'),
          t(', luego '),
          m('p'),
          t(' es par; escribiendo '),
          m('p = 2k'),
          t(' resulta que '),
          m('q'),
          t(' también es par, contradiciendo que la fracción era irreducible.'),
        ),
      ],
    },
  ],
}

/** Carta formal (`letter`): solicitud de prórroga, con remitente, destinatario, saludo y firma. */
export const cartaMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    date: '2026',
    family: {
      kind: 'letter',
      letter: {
        from: 'Nombre Apellido',
        fromAddress: 'Lic. en Matemática\nUniversidad Nacional',
        to: 'Dra. Coordinadora',
        toAddress: 'Departamento de Matemática\nFacultad de Ciencias Exactas',
        opening: 'Estimada Dra.:',
        closing: 'Saludos cordiales,',
        signature: 'Nombre Apellido',
        encl: 'Certificado médico',
      },
    },
  },
  content: [
    p(t('Me dirijo a usted a fin de solicitar una prórroga para la entrega del trabajo final de la materia Laboratorio de Cálculo, cuyo vencimiento opera el 30 de agosto.')),
    p(
      t('El motivo es que durante las últimas dos semanas estuve con licencia médica, lo que me impidió avanzar con la parte experimental. Adjunto el certificado correspondiente. Estimo poder entregar el trabajo completo dentro de los quince días posteriores a la fecha original.'),
    ),
    p(t('Agradezco desde ya su consideración y quedo a disposición por cualquier documentación adicional que necesite.')),
  ],
}

/** Libro (book): capítulos, secciones y una definición. */
export const libroMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Notas de Cálculo',
    author: 'Cátedra de Laboratorio de Cálculo',
    date: '2026',
    docKind: 'book',
    toc: true,
  },
  content: [
    { type: 'part', content: [t('Fundamentos')] },
    h(1, 'Límites'),
    p(t('El límite formaliza la idea de "acercarse" a un valor sin necesariamente alcanzarlo.')),
    {
      type: 'theorem',
      variant: 'definition',
      id: 'def-limite',
      title: 'Límite',
      content: [
        p(
          t('Decimos que '),
          m('\\lim_{x\\to a} f(x) = L'),
          t(' si para todo '),
          m('\\varepsilon > 0'),
          t(' existe '),
          m('\\delta > 0'),
          t(' tal que '),
          m('0 < |x-a| < \\delta'),
          t(' implica '),
          m('|f(x)-L| < \\varepsilon'),
          t('.'),
        ),
      ],
    },
    h(2, 'Un ejemplo'),
    p(t('La función '), m('f(x) = (x^2-1)/(x-1)'), t(' no está definida en '), m('x=1'), t(', pero su límite allí vale 2.')),
    h(1, 'Derivadas'),
    p(t('La derivada es el límite del cociente incremental y mide la pendiente de la recta tangente.')),
    {
      type: 'figure',
      caption: 'Una curva y su tangente.',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], tangents: [{ fn: 0, at: 1, showValue: true }], domain: [-2, 2], grid: true } }],
    },
  ],
}
