import type { MatexDoc } from '@/features/matex/core'

/**
 * **Versiones Matex (AST) de las plantillas** (ME-23). Son *puntos de partida* para el editor
 * visual: estructura correcta y algo de contenido de ejemplo, listos para reemplazar. A diferencia
 * de los ejemplares de la Galería (documentos completos que se estudian), acá se prioriza que sea
 * fácil borrar lo de muestra y escribir lo propio.
 */

// Helpers de autoría del AST (texto/mate en línea, párrafo, ítem de lista).
const t = (text: string) => ({ type: 'text' as const, text })
const m = (tex: string) => ({ type: 'mathInline' as const, tex })
const p = (...content: ReturnType<typeof t>[] | object[]) => ({ type: 'paragraph' as const, content: content as never })
const li = (text: string) => ({ type: 'listItem' as const, content: [p(t(text))] })
const row = (cells: string[]) => ({ type: 'tableRow' as const, cells: cells.map((c) => ({ type: 'tableCell' as const, content: [t(c)] })) })

/** Resolución de práctica: enunciado + desarrollo paso a paso + resultado destacado. */
export const resolucionMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Resolución de práctica', author: 'Tu nombre', date: '' },
  content: [
    { type: 'heading', level: 2, content: [t('Ejercicio 1')] },
    {
      type: 'callout',
      variant: 'note',
      title: 'Enunciado',
      content: [p(t('Hallá los extremos de '), m('f(x) = x^3 - 3x'), t(' y clasificalos.'))],
    },
    p(t('Derivamos e igualamos a cero:')),
    {
      type: 'derivation',
      steps: [
        { tex: "f'(x) &= 3x^2 - 3", note: 'derivada' },
        { tex: '3x^2 - 3 &= 0', note: 'puntos críticos' },
        { tex: 'x &= \\pm 1', boxed: true },
      ],
    },
    p(t('Con la derivada segunda '), m("f''(x) = 6x"), t(' clasificamos: '), m('x=-1'), t(' es máximo y '), m('x=1'), t(' es mínimo.')),
    {
      type: 'figure',
      caption: 'La función con sus extremos marcados automáticamente.',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^3 - 3*x', markExtrema: true, featureCoords: true }], domain: [-3, 3], grid: true } }],
    },
  ],
}

/** Cheatsheet / formulario: fórmulas densas en dos columnas, agrupadas por tema. */
export const cheatsheetMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Formulario', author: '', date: '', margin: '1.5cm' },
  content: [
    {
      type: 'columns',
      columns: [
        {
          content: [
            { type: 'heading', level: 1, content: [t('Derivadas')] },
            { type: 'mathDisplay', rows: [{ tex: '(x^n)\' = n\\,x^{n-1}' }, { tex: '(\\sen x)\' = \\cos x' }, { tex: '(e^x)\' = e^x' }] },
            { type: 'heading', level: 1, content: [t('Reglas')] },
            { type: 'mathDisplay', rows: [{ tex: '(fg)\' = f\'g + fg\'' }, { tex: '\\left(\\frac{f}{g}\\right)\' = \\frac{f\'g - fg\'}{g^2}' }] },
          ],
        },
        {
          content: [
            { type: 'heading', level: 1, content: [t('Integrales')] },
            { type: 'mathDisplay', rows: [{ tex: '\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C' }, { tex: '\\int \\frac{dx}{x} = \\ln|x| + C' }] },
            {
              type: 'callout',
              variant: 'tip',
              title: 'Recordar',
              content: [p(t('Verificá siempre derivando el resultado.'))],
            },
          ],
        },
      ],
    },
  ],
}

/** Informe / TP académico: estructura clásica con secciones, figura y conclusión. */
export const informeMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Informe / TP', author: 'Tu nombre', institution: 'Cátedra', date: '', abstract: 'Resumen breve de qué se hizo y qué se encontró.' },
  content: [
    { type: 'heading', level: 2, content: [t('Introducción')] },
    p(t('Planteá acá el problema y por qué importa.')),
    { type: 'heading', level: 2, content: [t('Desarrollo')] },
    p(t('Describí el método. Podés intercalar fórmulas como '), m('T = 2\\pi\\sqrt{L/g}'), t(' en el texto.')),
    {
      type: 'figure',
      caption: 'Reemplazá por tu gráfico o imagen.',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'sqrt(x)' }], domain: [0, 4], grid: true } }],
    },
    { type: 'heading', level: 2, content: [t('Conclusiones')] },
    { type: 'bulletList', items: [li('Primer hallazgo.'), li('Segundo hallazgo.')] },
  ],
}

/** Paper a dos columnas: artículo corto con resumen, teorema y bibliografía. */
export const paperTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Título del artículo',
    author: 'Tu nombre',
    institution: 'Cátedra',
    columns: 2,
    date: '',
    abstract: 'Resumen breve: qué problema se aborda, qué método se usa y cuál es el resultado principal.',
  },
  references: [{ key: 'ref1', type: 'book', author: 'Apellido, N.', title: 'Título de referencia', publisher: 'Editorial', year: '2020' }],
  content: [
    { type: 'heading', level: 1, content: [t('Introducción')] },
    p(t('Contexto del problema y por qué importa. Podés citar así '), { type: 'cite', keys: ['ref1'] }, t('.')),
    { type: 'heading', level: 1, content: [t('Resultado principal')] },
    {
      type: 'theorem',
      variant: 'theorem',
      id: 'thm-1',
      title: 'Enunciá tu teorema',
      content: [p(t('Si se cumple la hipótesis, entonces vale la conclusión.'))],
    },
    { type: 'theorem', variant: 'proof', proves: 'thm-1', content: [p(t('Escribí acá la demostración.'))] },
    { type: 'heading', level: 1, content: [t('Conclusiones')] },
    p(t('Qué se logró y qué queda abierto.')),
  ],
}

/** Tesina / informe largo (report): capítulos, figura y bibliografía. */
export const tesinaTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Título de la tesina',
    author: 'Tu nombre',
    institution: 'Lic. en Matemática',
    date: '',
    docKind: 'report',
    titlePage: true,
    toc: true,
  },
  references: [{ key: 'ref1', type: 'book', author: 'Apellido, N.', title: 'Título de referencia', publisher: 'Editorial', year: '2020' }],
  content: [
    { type: 'heading', level: 1, content: [t('Introducción')] },
    p(t('Presentá el tema, el objetivo y la estructura del trabajo. '), { type: 'cite', keys: ['ref1'] }, t('.')),
    { type: 'heading', level: 1, content: [t('Marco teórico')] },
    p(t('Definiciones y resultados previos que vas a usar.')),
    { type: 'heading', level: 1, content: [t('Desarrollo')] },
    {
      type: 'figure',
      caption: 'Reemplazá por tu gráfico.',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3], grid: true } }],
    },
    { type: 'heading', level: 1, content: [t('Conclusiones')] },
    { type: 'bulletList', items: [li('Qué se obtuvo.'), li('Qué queda para trabajo futuro.')] },
  ],
}

/** Apunte teórico: definición, ejemplo y caja de advertencia. */
export const apunteTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Apunte: tema', author: 'Cátedra', date: '' },
  content: [
    { type: 'heading', level: 1, content: [t('Idea central')] },
    p(t('Explicá en una o dos frases de qué se trata.')),
    {
      type: 'theorem',
      variant: 'definition',
      id: 'def-1',
      title: 'Concepto',
      content: [p(t('Escribí acá la definición formal, por ejemplo '), m('\\lim_{x\\to a} f(x) = L'), t('.'))],
    },
    { type: 'heading', level: 1, content: [t('Ejemplo')] },
    p(t('Un caso concreto que ilustre la definición.')),
    {
      type: 'figure',
      caption: 'Un gráfico que acompañe el ejemplo.',
      items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2', markExtrema: true }], domain: [-3, 3], grid: true } }],
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Error común',
      content: [p(t('Advertí acá la confusión típica sobre este tema.'))],
    },
  ],
}

/** Informe de laboratorio: objetivo, procedimiento, datos medidos y análisis. */
export const laboratorioTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Informe de laboratorio', author: 'Tu nombre', institution: 'Cátedra', date: '', abstract: 'Qué se midió y qué se concluyó.' },
  content: [
    { type: 'heading', level: 1, content: [t('Objetivo')] },
    p(t('Qué magnitud se quiere medir y con qué precisión.')),
    { type: 'heading', level: 1, content: [t('Procedimiento')] },
    { type: 'orderedList', items: [li('Preparar el montaje.'), li('Tomar las mediciones.'), li('Repetir y promediar.')] },
    { type: 'heading', level: 1, content: [t('Datos')] },
    {
      type: 'table',
      header: true,
      caption: 'Mediciones tomadas.',
      id: 'tab-datos',
      align: ['center', 'center', 'center'],
      rows: [row(['n', 'medición', 'error']), row(['1', '—', '—']), row(['2', '—', '—']), row(['3', '—', '—'])],
    },
    { type: 'heading', level: 1, content: [t('Análisis')] },
    p(t('Compará lo medido con lo esperado y discutí las fuentes de error.')),
  ],
}

/** Currículum (clase `moderncv`): contacto + secciones con entradas de trayectoria. */
export const cvTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    author: 'Tu Nombre',
    accent: 'blue',
    family: { kind: 'cv', cv: { subtitle: 'Tu título o profesión', email: 'vos@ejemplo.com', address: 'Ciudad, País' } },
  },
  content: [
    { type: 'heading', level: 1, content: [t('Formación')] },
    { type: 'cvEntry', period: '20XX–20XX', role: 'Título obtenido', org: 'Institución', place: 'Ciudad', detail: 'Detalle breve (promedio, tesis, orientación).' },
    { type: 'heading', level: 1, content: [t('Experiencia')] },
    { type: 'cvEntry', period: '20XX–hoy', role: 'Cargo', org: 'Organización', place: 'Ciudad', detail: 'Qué hacías y qué lograste.' },
    { type: 'heading', level: 1, content: [t('Habilidades')] },
    { type: 'bulletList', items: [li('Herramientas y lenguajes.'), li('Idiomas.')] },
  ],
}

/** Examen (clase `exam`): preguntas con puntaje y solución; una bandera arma las dos versiones. */
export const examenTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    title: 'Examen parcial',
    date: '',
    family: { kind: 'exam', exam: { instructions: 'Justificá cada respuesta. Tiempo: 2 horas.' } },
  },
  content: [
    {
      type: 'examQuestion',
      points: 20,
      content: [p(t('Calculá la derivada de '), m('f(x) = x^3 - 3x'), t('.'))],
      solution: [p(t('')), { type: 'mathDisplay', rows: [{ tex: "f'(x) = 3x^2 - 3" }] }],
    },
    {
      type: 'examQuestion',
      points: 30,
      content: [p(t('Calculá '), m('\\int_0^1 x^2\\,dx'), t('.'))],
      solution: [{ type: 'mathDisplay', rows: [{ tex: '\\left[\\frac{x^3}{3}\\right]_0^1 = \\frac{1}{3}' }] }],
    },
    {
      type: 'examQuestion',
      points: 50,
      content: [p(t('Demostrá que '), m('\\sqrt{2}'), t(' es irracional.'))],
      solution: [p(t('Por el absurdo: si fuera racional e irreducible, numerador y denominador resultarían ambos pares, contradicción.'))],
    },
  ],
}

/** Carta formal (clase `letter`): remitente, destinatario, saludo, cuerpo y despedida. */
export const cartaTplMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: {
    date: '',
    family: {
      kind: 'letter',
      letter: {
        from: 'Tu nombre',
        fromAddress: 'Tu dirección\nCiudad',
        to: 'Nombre del destinatario',
        toAddress: 'Institución\nDirección',
        opening: 'Estimado/a:',
        closing: 'Saludos cordiales,',
        signature: 'Tu nombre',
      },
    },
  },
  content: [
    p(t('Me dirijo a usted con motivo de… (planteá acá el asunto de la carta en una frase clara).')),
    p(t('Desarrollá el pedido o la explicación en uno o dos párrafos. Sé concreto: qué necesitás, para cuándo y por qué.')),
    p(t('Quedo a disposición por cualquier consulta y agradezco desde ya su tiempo.')),
  ],
}

/** Presentación (beamer): arranque de una charla con portada, viñetas graduales y columnas. */
export const presentacionMatex: MatexDoc = {
  type: 'doc',
  version: 4,
  meta: { title: 'Título de la charla', author: 'Tu nombre', institution: 'Cátedra', date: '', family: { kind: 'presentation' }, style: 'classic', toc: false },
  content: [
    {
      type: 'slide',
      title: 'Idea principal',
      reveal: true,
      content: [{ type: 'bulletList', items: [li('Primer punto, aparece solo.'), li('Después el segundo.'), li('Y por último el tercero.')] }],
    },
    {
      type: 'slide',
      title: 'Texto y gráfico',
      content: [
        {
          type: 'columns',
          columns: [
            { ratio: 0.45, content: [p(t('A la izquierda la explicación; a la derecha, la figura.')), { type: 'mathDisplay', rows: [{ tex: 'f(x) = x^2' }] }] },
            { ratio: 0.55, content: [{ type: 'figure', items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-3, 3], grid: true } }] }] },
          ],
        },
      ],
    },
    { type: 'slide', title: 'Cierre', content: [{ type: 'bulletList', items: [li('Qué se lleva la audiencia.'), li('Próximos pasos.')] }] },
  ],
}
