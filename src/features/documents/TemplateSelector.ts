import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { setDocumentContent, initDocMeta } from '@core/editor/EditorStore'
import type { DocMeta } from '@core/editor/EditorStore'

type Lang = 'es' | 'en'

interface Template {
  id:          string
  label:       Record<Lang, string>
  description: Record<Lang, string>
  meta:        Record<Lang, Partial<DocMeta>>
  content:     Record<Lang, object>
}

// ── Shared helpers ────────────────────────────────────────────────

const mi  = (latex: string) => ({ type: 'mathInline', attrs: { latex } })
const md  = (latex: string) => ({ type: 'mathDisplay', attrs: { latex, numbered: false, aligned: false, label: '' } })
const p   = (...content: object[]) => ({ type: 'paragraph', content })
const h   = (level: 1|2|3, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const b   = (text: string) => ({ type: 'text', marks: [{ type: 'bold' }],   text })
const it  = (text: string) => ({ type: 'text', marks: [{ type: 'italic' }], text })

const t   = (text: string) => ({ type: 'text', text })
const thm = (envType: string, title: string, ...content: object[]) => ({
  type: 'theoremEnv', attrs: { envType, id: crypto.randomUUID() },
  content: [{ type: 'theoremEnvTitle', content: title ? [{ type: 'text', text: title }] : [] }, ...content],
})
const ol = (...items: object[][]) => ({
  type: 'orderedList',
  content: items.map(c => ({ type: 'listItem', content: [{ type: 'paragraph', content: c }] })),
})
const ul = (...items: object[][]) => ({
  type: 'bulletList',
  content: items.map(c => ({ type: 'listItem', content: [{ type: 'paragraph', content: c }] })),
})
const BLANK = { type: 'paragraph' }

// ── Templates ────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [

  // ── En blanco ─────────────────────────────────────────────────
  {
    id: 'blank',
    label:       { es: 'En blanco',       en: 'Blank' },
    description: { es: 'Página en blanco.', en: 'Empty page.' },
    meta:    { es: { language: 'es' }, en: { language: 'en' } },
    content: { es: { type: 'doc', content: [BLANK] },
               en: { type: 'doc', content: [BLANK] } },
  },

  // ── Artículo ──────────────────────────────────────────────────
  {
    id: 'article',
    label:       { es: 'Artículo',  en: 'Article' },
    description: { es: 'Artículo completo con secciones, teoremas, pruebas y conclusiones.', en: 'Full article with sections, theorems, proofs and conclusions.' },
    meta: {
      es: { language: 'es', title: 'Álgebra Lineal: Valores y Vectores Propios',
            author: 'Autor', keywords: 'álgebra lineal, valores propios, diagonalización, teorema espectral',
            abstract: 'Estudiamos la teoría de valores propios para transformaciones lineales en espacios de dimensión finita. Demostramos el teorema de diagonalización y el teorema espectral para matrices simétricas, con aplicaciones a la forma canónica de Jordan.' },
      en: { language: 'en', title: 'Linear Algebra: Eigenvalues and Eigenvectors',
            author: 'Author', keywords: 'linear algebra, eigenvalues, diagonalization, spectral theorem',
            abstract: 'We study the theory of eigenvalues for linear transformations on finite-dimensional spaces. We prove the diagonalization theorem and the spectral theorem for symmetric matrices, with applications to Jordan canonical form.' },
    },
    content: {
      es: { type: 'doc', content: [
        h(1, 'Introducción'),
        p(t('Sea '), mi('V'), t(' un espacio vectorial de dimensión finita sobre '), mi('\\mathbb{F}'), t(' y sea '), mi('T: V \\to V'), t(' una transformación lineal. El problema central del álgebra lineal es descomponer '), mi('V'), t(' en subespacios '), b('invariantes'), t(' bajo '), mi('T'), t(', de modo que la acción de '), mi('T'), t(' sobre cada subespacio sea lo más simple posible.')),
        p(t('En este artículo desarrollamos la teoría espectral elemental: definimos valores y vectores propios, establecemos criterios de diagonalización, y demostramos el teorema espectral para operadores autoadjuntos.')),

        h(1, 'Preliminares'),
        h(2, 'Espacios vectoriales y bases'),
        thm('definition', 'Espacio vectorial',
          p(t('Un '), b('espacio vectorial'), t(' sobre un cuerpo '), mi('\\mathbb{F}'), t(' es un conjunto '), mi('V'), t(' equipado con operaciones de suma y multiplicación escalar que satisfacen los ocho axiomas usuales.')),
        ),
        thm('definition', 'Base y dimensión',
          p(t('Un conjunto '), mi('\\mathcal{B} = \\{v_1, \\ldots, v_n\\}'), t(' es una '), b('base'), t(' de '), mi('V'), t(' si es linealmente independiente y genera '), mi('V'), t('. La '), b('dimensión'), t(' de '), mi('V'), t(' es '), mi('n = \\dim V'), t('.')),
        ),
        h(2, 'Transformaciones lineales'),
        thm('definition', 'Transformación lineal',
          p(t('Una función '), mi('T: V \\to W'), t(' es '), b('lineal'), t(' si para todo '), mi('u, v \\in V'), t(' y '), mi('\\alpha \\in \\mathbb{F}'), t(':')),
          md('T(u + v) = T(u) + T(v) \\qquad T(\\alpha v) = \\alpha\\, T(v)'),
        ),
        p(t('Fijadas bases '), mi('\\mathcal{B}'), t(' de '), mi('V'), t(' y '), mi('\\mathcal{C}'), t(' de '), mi('W'), t(', toda transformación lineal queda representada por una matriz '), mi('[T]_{\\mathcal{B}}^{\\mathcal{C}} \\in M_{m\\times n}(\\mathbb{F})'), t('.')),

        h(1, 'Valores y vectores propios'),
        h(2, 'Definición y primeros ejemplos'),
        thm('definition', 'Valor propio',
          p(t('Sea '), mi('T: V \\to V'), t(' lineal. Un escalar '), mi('\\lambda \\in \\mathbb{F}'), t(' es un '), b('valor propio'), t(' de '), mi('T'), t(' si existe '), mi('v \\neq 0'), t(' tal que')),
          md('T(v) = \\lambda v'),
          p(t('El vector '), mi('v'), t(' se llama '), b('vector propio'), t(' asociado a '), mi('\\lambda'), t('. El subespacio '), mi('E_\\lambda = \\ker(T - \\lambda I)'), t(' se llama '), b('subespacio propio'), t('.')),
        ),
        thm('example', 'Rotación en el plano',
          p(t('La rotación '), mi('R_\\theta : \\mathbb{R}^2 \\to \\mathbb{R}^2'), t(' de ángulo '), mi('\\theta'), t(' tiene matriz')),
          md('[R_\\theta] = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}'),
          p(t('Para '), mi('\\theta \\notin \\{0, \\pi\\}'), t(' no tiene valores propios reales, pero sí complejos: '), mi('\\lambda = e^{\\pm i\\theta}'), t('.')),
        ),
        h(2, 'El polinomio característico'),
        thm('definition', 'Polinomio característico',
          p(t('El '), b('polinomio característico'), t(' de '), mi('A \\in M_n(\\mathbb{F})'), t(' es')),
          md('p_A(\\lambda) = \\det(A - \\lambda I) = (-1)^n \\lambda^n + \\cdots + \\det A'),
        ),
        thm('theorem', 'Cayley–Hamilton',
          p(t('Toda matriz satisface su propio polinomio característico: '), mi('p_A(A) = 0'), t('.')),
        ),
        thm('proof', '',
          p(t('Sea '), mi('B(\\lambda) = \\mathrm{adj}(A - \\lambda I)'), t(' la matriz de cofactores, de modo que '), mi('(A - \\lambda I)B(\\lambda) = p_A(\\lambda) I'), t('. Escribiendo '), mi('B(\\lambda) = B_0 + B_1 \\lambda + \\cdots + B_{n-1}\\lambda^{n-1}'), t(' e igualando coeficientes en ambos lados de la identidad matricial se obtiene el resultado. '), it('∎')),
        ),

        h(1, 'Diagonalización'),
        thm('definition', 'Matriz diagonalizable',
          p(t('Una matriz '), mi('A \\in M_n(\\mathbb{F})'), t(' es '), b('diagonalizable'), t(' si existe una base de '), mi('\\mathbb{F}^n'), t(' formada por vectores propios de '), mi('A'), t(', es decir, si existe '), mi('P'), t(' invertible tal que '), mi('P^{-1}AP = D'), t(' con '), mi('D'), t(' diagonal.')),
        ),
        thm('theorem', 'Criterio de diagonalización',
          p(t('Una matriz '), mi('A \\in M_n(\\mathbb{F})'), t(' es diagonalizable si y solo si la suma de las dimensiones de sus subespacios propios es '), mi('n'), t(', equivalentemente, si para cada valor propio '), mi('\\lambda_i'), t(' la multiplicidad algebraica coincide con la geométrica:')),
          md('\\dim E_{\\lambda_i} = m_a(\\lambda_i) \\quad \\text{para todo } i'),
        ),
        thm('corollary', '',
          p(t('Si '), mi('A \\in M_n(\\mathbb{F})'), t(' tiene '), mi('n'), t(' valores propios distintos, entonces '), mi('A'), t(' es diagonalizable.')),
        ),
        thm('remark', '',
          p(t('La diagonalización simplifica el cálculo de potencias: si '), mi('A = PDP^{-1}'), t(', entonces '), mi('A^k = PD^kP^{-1}'), t(', y '), mi('D^k'), t(' se obtiene elevando cada entrada diagonal a la potencia '), mi('k'), t('.')),
        ),

        h(1, 'Teorema espectral'),
        thm('theorem', 'Teorema espectral (matrices simétricas reales)',
          p(t('Toda matriz simétrica '), mi('A \\in M_n(\\mathbb{R})'), t(' (i.e. '), mi('A^\\top = A'), t(') es ortogonalmente diagonalizable: existe '), mi('Q'), t(' ortogonal tal que')),
          md('Q^\\top A Q = \\mathrm{diag}(\\lambda_1, \\ldots, \\lambda_n)'),
          p(t('con '), mi('\\lambda_i \\in \\mathbb{R}'), t(' y las columnas de '), mi('Q'), t(' forman una base ortonormal de vectores propios.')),
        ),
        thm('lemma', '',
          p(t('Los valores propios de una matriz simétrica real son reales y los vectores propios correspondientes a valores propios distintos son ortogonales.')),
        ),
        thm('proof', '',
          p(b('Realidad:'), t(' Sea '), mi('Av = \\lambda v'), t(' con '), mi('v \\neq 0'), t('. Entonces '), mi('\\bar{v}^\\top A v = \\lambda \\|v\\|^2'), t('. Como '), mi('A'), t(' es real y simétrica, el lado izquierdo es real, luego '), mi('\\lambda \\in \\mathbb{R}'), t('.')),
          p(b('Ortogonalidad:'), t(' Si '), mi('Av = \\lambda v'), t(' y '), mi('Aw = \\mu w'), t(' con '), mi('\\lambda \\neq \\mu'), t(', entonces '), mi('\\lambda \\langle v,w \\rangle = \\langle Av,w \\rangle = \\langle v,Aw \\rangle = \\mu \\langle v,w \\rangle'), t(', de donde '), mi('\\langle v,w \\rangle = 0'), t('. '), it('∎')),
        ),

        h(1, 'Conclusiones'),
        p(t('Hemos establecido los fundamentos de la teoría espectral: la existencia de valores propios vía el polinomio característico, el criterio de diagonalización por multiplicidades, y el teorema espectral para matrices simétricas. Estos resultados tienen aplicaciones en ecuaciones diferenciales, geometría diferencial, estadística multivariante y procesamiento de señales.')),
        ul(
          [b('Diagonalización: '), t('garantizada cuando todos los valores propios son simples.')],
          [b('Teorema espectral: '), t('toda matriz simétrica es ortogonalmente diagonalizable.')],
          [b('Cayley–Hamilton: '), t('toda matriz anula su polinomio característico.')],
        ),
      ]},

      en: { type: 'doc', content: [
        h(1, 'Introduction'),
        p(t('Let '), mi('V'), t(' be a finite-dimensional vector space over '), mi('\\mathbb{F}'), t(' and let '), mi('T: V \\to V'), t(' be a linear map. The central problem of linear algebra is to decompose '), mi('V'), t(' into '), b('invariant'), t(' subspaces under '), mi('T'), t(', so that the action of '), mi('T'), t(' on each subspace is as simple as possible.')),
        p(t('In this article we develop elementary spectral theory: we define eigenvalues and eigenvectors, establish diagonalization criteria, and prove the spectral theorem for self-adjoint operators.')),

        h(1, 'Preliminaries'),
        h(2, 'Vector spaces and bases'),
        thm('definition', 'Vector space',
          p(t('A '), b('vector space'), t(' over a field '), mi('\\mathbb{F}'), t(' is a set '), mi('V'), t(' equipped with addition and scalar multiplication satisfying the usual eight axioms.')),
        ),
        thm('definition', 'Basis and dimension',
          p(t('A set '), mi('\\mathcal{B} = \\{v_1, \\ldots, v_n\\}'), t(' is a '), b('basis'), t(' of '), mi('V'), t(' if it is linearly independent and spans '), mi('V'), t('. The '), b('dimension'), t(' of '), mi('V'), t(' is '), mi('n = \\dim V'), t('.')),
        ),
        h(2, 'Linear maps'),
        thm('definition', 'Linear map',
          p(t('A function '), mi('T: V \\to W'), t(' is '), b('linear'), t(' if for all '), mi('u, v \\in V'), t(' and '), mi('\\alpha \\in \\mathbb{F}'), t(':')),
          md('T(u + v) = T(u) + T(v) \\qquad T(\\alpha v) = \\alpha\\, T(v)'),
        ),

        h(1, 'Eigenvalues and eigenvectors'),
        h(2, 'Definition and first examples'),
        thm('definition', 'Eigenvalue',
          p(t('Let '), mi('T: V \\to V'), t(' be linear. A scalar '), mi('\\lambda \\in \\mathbb{F}'), t(' is an '), b('eigenvalue'), t(' of '), mi('T'), t(' if there exists '), mi('v \\neq 0'), t(' such that')),
          md('T(v) = \\lambda v'),
          p(t('The vector '), mi('v'), t(' is called an '), b('eigenvector'), t(' for '), mi('\\lambda'), t('. The subspace '), mi('E_\\lambda = \\ker(T - \\lambda I)'), t(' is the '), b('eigenspace'), t('.')),
        ),
        thm('example', 'Rotation in the plane',
          p(t('The rotation '), mi('R_\\theta : \\mathbb{R}^2 \\to \\mathbb{R}^2'), t(' by angle '), mi('\\theta'), t(' has matrix')),
          md('[R_\\theta] = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}'),
          p(t('For '), mi('\\theta \\notin \\{0, \\pi\\}'), t(' it has no real eigenvalues, but complex ones: '), mi('\\lambda = e^{\\pm i\\theta}'), t('.')),
        ),
        h(2, 'The characteristic polynomial'),
        thm('definition', 'Characteristic polynomial',
          p(t('The '), b('characteristic polynomial'), t(' of '), mi('A \\in M_n(\\mathbb{F})'), t(' is')),
          md('p_A(\\lambda) = \\det(A - \\lambda I) = (-1)^n \\lambda^n + \\cdots + \\det A'),
        ),
        thm('theorem', 'Cayley–Hamilton',
          p(t('Every matrix satisfies its own characteristic polynomial: '), mi('p_A(A) = 0'), t('.')),
        ),

        h(1, 'Diagonalization'),
        thm('theorem', 'Diagonalization criterion',
          p(t('A matrix '), mi('A \\in M_n(\\mathbb{F})'), t(' is diagonalizable if and only if the sum of the dimensions of its eigenspaces equals '), mi('n'), t(', equivalently, for each eigenvalue '), mi('\\lambda_i'), t(' the algebraic multiplicity equals the geometric multiplicity:')),
          md('\\dim E_{\\lambda_i} = m_a(\\lambda_i) \\quad \\text{for all } i'),
        ),
        thm('corollary', '',
          p(t('If '), mi('A \\in M_n(\\mathbb{F})'), t(' has '), mi('n'), t(' distinct eigenvalues, then '), mi('A'), t(' is diagonalizable.')),
        ),

        h(1, 'Spectral theorem'),
        thm('theorem', 'Spectral theorem (real symmetric matrices)',
          p(t('Every symmetric matrix '), mi('A \\in M_n(\\mathbb{R})'), t(' is orthogonally diagonalizable: there exists orthogonal '), mi('Q'), t(' such that')),
          md('Q^\\top A Q = \\mathrm{diag}(\\lambda_1, \\ldots, \\lambda_n)'),
          p(t('with '), mi('\\lambda_i \\in \\mathbb{R}'), t(' and the columns of '), mi('Q'), t(' forming an orthonormal basis of eigenvectors.')),
        ),

        h(1, 'Conclusions'),
        p(t('We have established the foundations of spectral theory: eigenvalue existence via the characteristic polynomial, the diagonalization criterion by multiplicities, and the spectral theorem for symmetric matrices. These results apply to differential equations, differential geometry, multivariate statistics, and signal processing.')),
      ]},
    },
  },

  // ── Apunte de clase ───────────────────────────────────────────
  {
    id: 'notes',
    label:       { es: 'Apunte de clase',   en: 'Lecture notes' },
    description: { es: 'Definiciones, teoremas, ejemplos y ejercicios propuestos.', en: 'Definitions, theorems, examples and exercises.' },
    meta: {
      es: { language: 'es', title: 'Cálculo Integral — Apunte de Clase',
            keywords: 'integración, integral de Riemann, técnicas de integración, teorema fundamental' },
      en: { language: 'en', title: 'Integral Calculus — Lecture Notes',
            keywords: 'integration, Riemann integral, integration techniques, fundamental theorem' },
    },
    content: {
      es: { type: 'doc', content: [
        h(1, 'La integral de Riemann'),
        h(2, 'Particiones y sumas'),
        thm('definition', 'Partición',
          p(t('Una '), b('partición'), t(' de '), mi('[a,b]'), t(' es un conjunto finito '), mi('P = \\{x_0, x_1, \\ldots, x_n\\}'), t(' con '), mi('a = x_0 < x_1 < \\cdots < x_n = b'), t('. La '), b('norma'), t(' de la partición es '), mi('\\|P\\| = \\max_i \\Delta x_i'), t(' donde '), mi('\\Delta x_i = x_i - x_{i-1}'), t('.')),
        ),
        thm('definition', 'Sumas de Riemann',
          p(t('Dada '), mi('f: [a,b] \\to \\mathbb{R}'), t(' acotada y una partición '), mi('P'), t(', se definen:')),
          md('U(f,P) = \\sum_{i=1}^n M_i\\,\\Delta x_i \\qquad L(f,P) = \\sum_{i=1}^n m_i\\,\\Delta x_i'),
          p(t('donde '), mi('M_i = \\sup_{[x_{i-1},x_i]} f'), t(' y '), mi('m_i = \\inf_{[x_{i-1},x_i]} f'), t('. La función '), mi('f'), t(' es '), b('integrable Riemann'), t(' si '), mi('\\inf_P U(f,P) = \\sup_P L(f,P)'), t(', y en ese caso se escribe '), mi('\\int_a^b f'), t('.')),
        ),
        thm('theorem', 'Criterio de Riemann',
          p(t('Una función acotada '), mi('f: [a,b] \\to \\mathbb{R}'), t(' es integrable si y solo si para todo '), mi('\\varepsilon > 0'), t(' existe una partición '), mi('P'), t(' tal que')),
          md('U(f,P) - L(f,P) < \\varepsilon'),
        ),
        thm('example', 'La función de Dirichlet',
          p(t('La función '), mi('D(x) = \\mathbf{1}_{\\mathbb{Q}}(x)'), t(' (vale 1 en racionales y 0 en irracionales) '), b('no'), t(' es integrable Riemann: para toda partición '), mi('U(D,P) = 1'), t(' y '), mi('L(D,P) = 0'), t('.')),
        ),

        h(2, 'Funciones integrables'),
        thm('theorem', '',
          p(t('Toda función '), b('continua'), t(' en '), mi('[a,b]'), t(' es integrable. Más generalmente, toda función acotada con un conjunto de discontinuidades de '), b('medida cero'), t(' es integrable (Lebesgue).')),
        ),
        thm('note', '',
          p(t('La integrabilidad de funciones monótonas también se sigue directamente del criterio de Riemann, tomando la partición uniforme con '), mi('n'), t(' subintervalos: '), mi('U - L \\leq \\frac{(f(b)-f(a))(b-a)}{n} \\to 0'), t('.')),
        ),

        h(1, 'El teorema fundamental del cálculo'),
        thm('theorem', 'TFC — Parte I',
          p(t('Si '), mi('f'), t(' es integrable en '), mi('[a,b]'), t(' y '), mi('F(x) = \\int_a^x f(t)\\,dt'), t(', entonces '), mi('F'), t(' es continua en '), mi('[a,b]'), t('. Si además '), mi('f'), t(' es continua en '), mi('x_0'), t(', entonces '), mi('F'), t(' es diferenciable en '), mi('x_0'), t(' y')),
          md("F'(x_0) = f(x_0)"),
        ),
        thm('theorem', 'TFC — Parte II (regla de Barrow)',
          p(t('Si '), mi('f'), t(' es continua en '), mi('[a,b]'), t(' y '), mi('G'), t(' es una primitiva de '), mi('f'), t(', entonces')),
          md('\\int_a^b f(x)\\,dx = G(b) - G(a) =: \\Big[G(x)\\Big]_a^b'),
        ),
        thm('corollary', '',
          p(t('Toda función continua en un intervalo tiene primitiva. En particular:')),
          md('\\frac{d}{dx} \\int_a^x f(t)\\,dt = f(x)'),
        ),

        h(1, 'Técnicas de integración'),
        h(2, 'Integración por partes'),
        thm('proposition', 'Integración por partes',
          p(t('Si '), mi('u, v'), t(' son diferenciables con '), mi("u', v'"), t(' continuas en '), mi('[a,b]'), t(':')),
          md("\\int_a^b u(x)\\,v'(x)\\,dx = \\Big[u(x)v(x)\\Big]_a^b - \\int_a^b u'(x)\\,v(x)\\,dx"),
        ),
        thm('example', '',
          p(t('Calcular '), mi('\\int_0^\\pi x\\sin x\\,dx'), t('. Tomando '), mi('u = x'), t(', '), mi("v' = \\sin x"), t(':')),
          md("\\int_0^\\pi x\\sin x\\,dx = \\Big[-x\\cos x\\Big]_0^\\pi + \\int_0^\\pi \\cos x\\,dx = \\pi + \\Big[\\sin x\\Big]_0^\\pi = \\pi"),
        ),
        h(2, 'Sustitución trigonométrica'),
        thm('proposition', '',
          p(t('Para integrandos con '), mi('\\sqrt{a^2 - x^2}'), t(', la sustitución '), mi('x = a\\sin\\theta'), t(' con '), mi('\\theta \\in [-\\pi/2, \\pi/2]'), t(' simplifica la expresión usando '), mi('\\sqrt{a^2 - x^2} = a\\cos\\theta'), t('.')),
        ),
        thm('example', '',
          p(t('Calcular '), mi('\\int \\frac{dx}{\\sqrt{4 - x^2}}'), t('. Con '), mi('x = 2\\sin\\theta'), t(':')),
          md('\\int \\frac{2\\cos\\theta\\,d\\theta}{2\\cos\\theta} = \\theta + C = \\arcsin\\!\\left(\\frac{x}{2}\\right) + C'),
        ),
        h(2, 'Fracciones parciales'),
        thm('remark', '',
          p(t('Para integrar funciones racionales '), mi('P(x)/Q(x)'), t(' con '), mi('\\deg P < \\deg Q'), t(', se descompone '), mi('Q'), t(' en factores lineales e irreducibles cuadráticos, y se escribe')),
          md('\\frac{P(x)}{Q(x)} = \\sum_i \\frac{A_i}{x - r_i} + \\sum_j \\frac{B_j x + C_j}{x^2 + p_j x + q_j}'),
        ),

        h(1, 'Integrales impropias'),
        thm('definition', 'Integral impropia de tipo I',
          p(t('Si '), mi('f'), t(' es integrable en '), mi('[a, R]'), t(' para todo '), mi('R > a'), t(', se define')),
          md('\\int_a^{\\infty} f(x)\\,dx = \\lim_{R \\to \\infty} \\int_a^R f(x)\\,dx'),
          p(t('cuando el límite existe y es finito. En caso contrario la integral diverge.')),
        ),
        thm('example', '',
          p(t('La integral de Gauss:')),
          md('\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}'),
          p(t('Se demuestra calculando el cuadrado de la integral usando coordenadas polares.')),
        ),
        thm('exercise', '',
          p(t('Determinar para qué valores de '), mi('p \\in \\mathbb{R}'), t(' converge '), mi('\\int_1^\\infty x^{-p}\\,dx'), t('. ¿Qué ocurre con '), mi('\\int_0^1 x^{-p}\\,dx'), t('?')),
        ),
      ]},

      en: { type: 'doc', content: [
        h(1, 'The Riemann integral'),
        h(2, 'Partitions and sums'),
        thm('definition', 'Partition',
          p(t('A '), b('partition'), t(' of '), mi('[a,b]'), t(' is a finite set '), mi('P = \\{x_0, x_1, \\ldots, x_n\\}'), t(' with '), mi('a = x_0 < x_1 < \\cdots < x_n = b'), t('. The '), b('mesh'), t(' is '), mi('\\|P\\| = \\max_i \\Delta x_i'), t('.')),
        ),
        thm('definition', 'Riemann sums',
          p(t('Given bounded '), mi('f: [a,b] \\to \\mathbb{R}'), t(' and a partition '), mi('P'), t(':')),
          md('U(f,P) = \\sum_{i=1}^n M_i\\,\\Delta x_i \\qquad L(f,P) = \\sum_{i=1}^n m_i\\,\\Delta x_i'),
          p(t('where '), mi('M_i = \\sup_{[x_{i-1},x_i]} f'), t(' and '), mi('m_i = \\inf_{[x_{i-1},x_i]} f'), t('. '), mi('f'), t(' is '), b('Riemann integrable'), t(' if '), mi('\\inf_P U(f,P) = \\sup_P L(f,P)'), t('.')),
        ),
        thm('theorem', 'Riemann criterion',
          p(t('A bounded function '), mi('f: [a,b] \\to \\mathbb{R}'), t(' is integrable if and only if for every '), mi('\\varepsilon > 0'), t(' there exists a partition '), mi('P'), t(' with')),
          md('U(f,P) - L(f,P) < \\varepsilon'),
        ),

        h(1, 'Fundamental theorem of calculus'),
        thm('theorem', 'FTC — Part I',
          p(t('If '), mi('f'), t(' is integrable on '), mi('[a,b]'), t(' and '), mi('F(x) = \\int_a^x f(t)\\,dt'), t(', then '), mi('F'), t(' is continuous. If also '), mi('f'), t(' is continuous at '), mi('x_0'), t(', then')),
          md("F'(x_0) = f(x_0)"),
        ),
        thm('theorem', 'FTC — Part II',
          p(t('If '), mi('f'), t(' is continuous on '), mi('[a,b]'), t(' and '), mi('G'), t(' is an antiderivative, then')),
          md('\\int_a^b f(x)\\,dx = G(b) - G(a)'),
        ),

        h(1, 'Integration techniques'),
        h(2, 'Integration by parts'),
        thm('proposition', 'Integration by parts',
          p(t('If '), mi('u, v'), t(' are differentiable with continuous derivatives:')),
          md("\\int_a^b u\\,v'\\,dx = \\Big[uv\\Big]_a^b - \\int_a^b u'v\\,dx"),
        ),
        thm('example', '',
          p(t('Compute '), mi('\\int_0^\\pi x\\sin x\\,dx'), t(' by parts with '), mi('u = x'), t(', '), mi("v' = \\sin x"), t(':')),
          md('\\int_0^\\pi x\\sin x\\,dx = \\pi'),
        ),
        h(2, 'Partial fractions'),
        thm('remark', '',
          p(t('To integrate rational functions '), mi('P/Q'), t(' with '), mi('\\deg P < \\deg Q'), t(', decompose into partial fractions and integrate term by term.')),
        ),
        h(2, 'Improper integrals'),
        thm('definition', 'Improper integral (type I)',
          p(t('If '), mi('f'), t(' is integrable on '), mi('[a,R]'), t(' for all '), mi('R > a'), t(':')),
          md('\\int_a^{\\infty} f(x)\\,dx = \\lim_{R \\to \\infty} \\int_a^R f(x)\\,dx'),
        ),
        thm('exercise', '',
          p(t('Determine for which '), mi('p \\in \\mathbb{R}'), t(' the integral '), mi('\\int_1^\\infty x^{-p}\\,dx'), t(' converges.')),
        ),
      ]},
    },
  },

  // ── Lista de ejercicios ───────────────────────────────────────
  {
    id: 'problem-set',
    label:       { es: 'Lista de ejercicios',   en: 'Problem set' },
    description: { es: 'Ejercicios organizados por tema con variedad de técnicas.', en: 'Exercises organized by topic with varied techniques.' },
    meta: {
      es: { language: 'es', title: 'Lista de Ejercicios — Análisis y Álgebra' },
      en: { language: 'en', title: 'Problem Set — Analysis and Algebra' },
    },
    content: {
      es: { type: 'doc', content: [
        h(1, 'Sucesiones y series'),
        h(2, 'Sucesiones'),
        ol(
          [t('Probar usando la definición '), mi('\\varepsilon'), t('-'), mi('N'), t(' que '), mi('\\displaystyle\\lim_{n\\to\\infty}\\frac{3n^2+2n}{n^2-1} = 3'), t('.')],
          [t('Sea '), mi('a_1 = \\sqrt{2}'), t(' y '), mi('a_{n+1} = \\sqrt{2 + a_n}'), t('. Demostrar por inducción que '), mi('a_n < 2'), t(' para todo '), mi('n'), t(', y que la sucesión es creciente. Concluir que converge y hallar su límite.')],
          [t('Sea '), mi('(a_n)'), t(' una sucesión de Cauchy en '), mi('\\mathbb{R}'), t('. Demostrar directamente (sin usar que '), mi('\\mathbb{R}'), t(' es completo) que es acotada.')],
          [t('Calcular '), mi('\\displaystyle\\lim_{n\\to\\infty}\\left(1 + \\frac{x}{n}\\right)^n'), t(' para '), mi('x \\in \\mathbb{R}'), t(' fijo. '), it('(Sugerencia: tomar logaritmo y aplicar L\'Hôpital.)')],
        ),
        h(2, 'Series'),
        ol(
          [t('Estudiar la convergencia de '), mi('\\displaystyle\\sum_{n=1}^{\\infty}\\frac{(-1)^n}{\\sqrt{n}}'), t('. ¿Es absolutamente convergente?')],
          [t('Probar que '), mi('\\displaystyle\\sum_{n=1}^{\\infty}\\frac{1}{n(n+1)} = 1'), t(' descomponiendo en fracciones parciales y telescopando.')],
          [t('Aplicar el criterio de la raíz para determinar el radio de convergencia de la serie de potencias '), mi('\\displaystyle\\sum_{n=0}^{\\infty}\\frac{n^2}{3^n}x^n'), t('.')],
          [t('Probar que la serie '), mi('\\displaystyle\\sum_{n=1}^\\infty \\frac{1}{n^p}'), t(' converge si y solo si '), mi('p > 1'), t('. '), it('(Serie p de Riemann.)')],
        ),

        h(1, 'Derivación e integración'),
        h(2, 'Derivadas'),
        ol(
          [t('Calcular '), mi("f'(x)"), t(' donde '), mi('f(x) = \\arctan\\left(\\dfrac{1+x}{1-x}\\right)'), t('. Simplificar el resultado.')],
          [t('Sea '), mi('f(x) = x^x'), t(' para '), mi('x > 0'), t('. Calcular '), mi("f'(x)"), t(' usando la técnica de '), b('logarithmic differentiation'), t('.')],
          [t('Enunciar y demostrar el teorema del valor medio de Lagrange. Usar el resultado para probar que '), mi('|\\sin x - \\sin y| \\leq |x - y|'), t(' para todo '), mi('x, y \\in \\mathbb{R}'), t('.')],
        ),
        h(2, 'Integrales'),
        ol(
          [t('Calcular las siguientes integrales:'),],
        ),
        ul(
          [mi('\\displaystyle\\int \\frac{x^2}{x^3+1}\\,dx')],
          [mi('\\displaystyle\\int_0^1 \\arctan x\\,dx')],
          [mi('\\displaystyle\\int \\frac{dx}{\\sqrt{x^2+4}}'), t(' '), it('(sustitución trigonométrica o hiperbólica)')],
          [mi('\\displaystyle\\int_0^{\\infty} \\frac{\\sin x}{x}\\,dx = \\frac{\\pi}{2}'), t(' '), it('(integral de Dirichlet, para investigar)')],
        ),

        h(1, 'Álgebra lineal'),
        h(2, 'Espacios vectoriales'),
        ol(
          [t('Determinar si el conjunto '), mi('W = \\{(x,y,z) \\in \\mathbb{R}^3 : x + 2y - z = 0\\}'), t(' es un subespacio de '), mi('\\mathbb{R}^3'), t('. Hallar una base y su dimensión.')],
          [t('Sean '), mi('U'), t(' y '), mi('W'), t(' subespacios de '), mi('V'), t(' de dimensión finita. Probar la fórmula de la dimensión:'), md('\\dim(U + W) = \\dim U + \\dim W - \\dim(U \\cap W)')],
        ),
        h(2, 'Matrices y determinantes'),
        ol(
          [t('Sea '), mi('A = \\begin{pmatrix} 2 & 1 & 0 \\\\ 1 & 3 & 1 \\\\ 0 & 1 & 2 \\end{pmatrix}'), t('. Calcular '), mi('\\det A'), t(', hallar '), mi('A^{-1}'), t(' y resolver el sistema '), mi('Ax = b'), t(' para '), mi('b = (1, 0, -1)^\\top'), t('.')],
          [t('Hallar los valores propios y vectores propios de '), mi('A = \\begin{pmatrix} 4 & -2 \\\\ 1 & 1 \\end{pmatrix}'), t('. ¿Es diagonalizable? Si lo es, hallar '), mi('P'), t(' tal que '), mi('P^{-1}AP'), t(' sea diagonal.')],
          [t('Demostrar que '), mi('\\det(AB) = \\det A \\cdot \\det B'), t(' para '), mi('A, B \\in M_n(\\mathbb{R})'), t(' usando la descomposición '), mi('LU'), t(' o la fórmula de expansión.')],
        ),

        h(1, 'Probabilidad'),
        ol(
          [t('Un dado justo se lanza '), mi('n'), t(' veces. Sea '), mi('X'), t(' el número de seises obtenidos. Hallar '), mi('\\mathbb{E}[X]'), t(' y '), mi('\\mathrm{Var}(X)'), t('. ¿Para qué '), mi('n'), t(' es '), mi('P(X \\geq 2) > 1/2'), t('?')],
          [t('Sea '), mi('X \\sim \\mathcal{N}(0,1)'), t('. Calcular '), mi('\\mathbb{E}[X^2]'), t(' y '), mi('\\mathbb{E}[e^{tX}]'), t(' para '), mi('t \\in \\mathbb{R}'), t('. '), it('(La última es la función generatriz de momentos de la normal.)')],
          [t('Enunciar y demostrar la ley de los grandes números (versión débil). Usar la desigualdad de Chebyshev.')],
        ),
      ]},

      en: { type: 'doc', content: [
        h(1, 'Sequences and series'),
        h(2, 'Sequences'),
        ol(
          [t('Prove using the '), mi('\\varepsilon'), t('-'), mi('N'), t(' definition that '), mi('\\displaystyle\\lim_{n\\to\\infty}\\frac{3n^2+2n}{n^2-1} = 3'), t('.')],
          [t('Let '), mi('a_1 = \\sqrt{2}'), t(' and '), mi('a_{n+1} = \\sqrt{2 + a_n}'), t('. Show by induction that '), mi('a_n < 2'), t(' and that the sequence is increasing. Find its limit.')],
          [t('Compute '), mi('\\displaystyle\\lim_{n\\to\\infty}\\left(1 + \\frac{x}{n}\\right)^n'), t(' for fixed '), mi('x \\in \\mathbb{R}'), t('.')],
        ),
        h(2, 'Series'),
        ol(
          [t('Show that '), mi('\\displaystyle\\sum_{n=1}^{\\infty}\\frac{1}{n(n+1)} = 1'), t(' by partial fractions.')],
          [t('Find the radius of convergence of '), mi('\\displaystyle\\sum_{n=0}^{\\infty}\\frac{n^2}{3^n}x^n'), t('.')],
          [t('Prove that '), mi('\\displaystyle\\sum_{n=1}^\\infty \\frac{1}{n^p}'), t(' converges if and only if '), mi('p > 1'), t('.')],
        ),

        h(1, 'Calculus'),
        ol(
          [t('Let '), mi('f(x) = x^x'), t(' for '), mi('x > 0'), t('. Compute '), mi("f'(x)"), t(' using logarithmic differentiation.')],
          [t('State and prove the Mean Value Theorem. Use it to show '), mi('|\\sin x - \\sin y| \\leq |x-y|'), t('.')],
          [t('Compute '), mi('\\displaystyle\\int_0^1 \\arctan x\\,dx'), t(' using integration by parts.')],
          [t('Study convergence of '), mi('\\displaystyle\\int_1^\\infty x^{-p}\\,dx'), t(' as a function of '), mi('p'), t('.')],
        ),

        h(1, 'Linear algebra'),
        ol(
          [t('Find eigenvalues and eigenvectors of '), mi('A = \\begin{pmatrix} 4 & -2 \\\\ 1 & 1 \\end{pmatrix}'), t('. Is '), mi('A'), t(' diagonalizable?')],
          [t('Let '), mi('U, W'), t(' be subspaces of a finite-dimensional space '), mi('V'), t('. Prove:'), md('\\dim(U+W) = \\dim U + \\dim W - \\dim(U \\cap W)')],
          [t('Prove that '), mi('\\det(AB) = \\det A \\cdot \\det B'), t(' for '), mi('A,B \\in M_n(\\mathbb{R})'), t('.')],
        ),
      ]},
    },
  },

  // ── Demostración ──────────────────────────────────────────────
  {
    id: 'proof',
    label:       { es: 'Demostración',   en: 'Proof' },
    description: { es: 'Resultado central con lemas, prueba detallada y corolarios.', en: 'Central result with lemmas, detailed proof and corollaries.' },
    meta: {
      es: { language: 'es', title: 'El Teorema de Hahn–Banach' },
      en: { language: 'en', title: 'The Hahn–Banach Theorem' },
    },
    content: {
      es: { type: 'doc', content: [
        p(t('El teorema de Hahn–Banach es uno de los resultados fundamentales del análisis funcional. Garantiza la extensión de funcionales lineales acotados preservando la norma, y tiene consecuencias profundas en dualidad, separación de conjuntos convexos y representación de funcionales.')),

        h(1, 'Preliminares'),
        thm('definition', 'Espacio normado y funcional lineal acotado',
          p(t('Un '), b('espacio normado'), t(' es un par '), mi('(X, \\|\\cdot\\|)'), t(' donde '), mi('X'), t(' es un espacio vectorial real y '), mi('\\|\\cdot\\|: X \\to [0,\\infty)'), t(' satisface los axiomas de norma. Un funcional '), mi('f: X \\to \\mathbb{R}'), t(' es '), b('lineal acotado'), t(' si es lineal y existe '), mi('M \\geq 0'), t(' con '), mi('|f(x)| \\leq M\\|x\\|'), t(' para todo '), mi('x \\in X'), t('. La '), b('norma operador'), t(' de '), mi('f'), t(' es')),
          md('\\|f\\| = \\sup_{x \\neq 0} \\frac{|f(x)|}{\\|x\\|} = \\sup_{\\|x\\|=1} |f(x)|'),
        ),
        thm('definition', 'Funcional de Minkowski',
          p(t('Sea '), mi('C \\subset X'), t(' convexo, absorbente y equilibrado. El '), b('funcional de Minkowski'), t(' (o funcional de gauge) de '), mi('C'), t(' es')),
          md('p(x) = \\inf\\{\\lambda > 0 : x \\in \\lambda C\\}'),
          p(t('Este funcional satisface '), mi('p(x + y) \\leq p(x) + p(y)'), t(' (subaditividad) y '), mi('p(\\alpha x) = \\alpha p(x)'), t(' para '), mi('\\alpha \\geq 0'), t(' (homogeneidad positiva).')),
        ),

        h(1, 'Lemas auxiliares'),
        thm('lemma', 'Extensión de un paso',
          p(t('Sea '), mi('Y \\subsetneq X'), t(' un subespacio de '), mi('X'), t(' y sea '), mi('f: Y \\to \\mathbb{R}'), t(' lineal con '), mi('f(y) \\leq p(y)'), t(' para todo '), mi('y \\in Y'), t('. Sea '), mi('x_0 \\in X \\setminus Y'), t(' y '), mi('Z = \\mathrm{span}(Y \\cup \\{x_0\\})'), t('. Entonces existe una extensión lineal '), mi('g: Z \\to \\mathbb{R}'), t(' de '), mi('f'), t(' satisfaciendo '), mi('g(z) \\leq p(z)'), t(' para todo '), mi('z \\in Z'), t('.')),
        ),
        thm('proof', '',
          p(t('Todo elemento de '), mi('Z'), t(' se escribe únicamente como '), mi('z = y + \\alpha x_0'), t(' con '), mi('y \\in Y'), t(' y '), mi('\\alpha \\in \\mathbb{R}'), t('. Definimos '), mi('g(y + \\alpha x_0) = f(y) + \\alpha c'), t(' para algún '), mi('c \\in \\mathbb{R}'), t(' a elegir. La condición '), mi('g \\leq p'), t(' exige')),
          md('f(y) + \\alpha c \\leq p(y + \\alpha x_0) \\quad \\forall y \\in Y,\\, \\alpha \\in \\mathbb{R}'),
          p(t('Separando los casos '), mi('\\alpha > 0'), t(' y '), mi('\\alpha < 0'), t(' y reordenando, se obtiene que '), mi('c'), t(' debe satisfacer')),
          md('\\sup_{y \\in Y}\\bigl[f(y) - p(y - x_0)\\bigr] \\leq c \\leq \\inf_{y \\in Y}\\bigl[p(y + x_0) - f(y)\\bigr]'),
          p(t('La subaditividad de '), mi('p'), t(' y la hipótesis '), mi('f \\leq p|_Y'), t(' garantizan que el supremo no supera el ínfimo, por lo que tal '), mi('c'), t(' existe. '), it('∎')),
        ),
        thm('lemma', 'Zorn y extensión transfinita',
          p(t('El conjunto de extensiones de '), mi('f'), t(' dominadas por '), mi('p'), t(' está parcialmente ordenado por extensión y todo subconjunto encadenado tiene cota superior. Por el '), b('lema de Zorn'), t(', existe un elemento maximal.')),
        ),

        h(1, 'Teorema principal'),
        thm('theorem', 'Hahn–Banach (versión analítica)',
          p(t('Sea '), mi('X'), t(' un espacio vectorial real, '), mi('p: X \\to \\mathbb{R}'), t(' un funcional sublineal, '), mi('Y \\subseteq X'), t(' un subespacio y '), mi('f: Y \\to \\mathbb{R}'), t(' lineal con '), mi('f(y) \\leq p(y)'), t(' para todo '), mi('y \\in Y'), t('. Entonces existe una extensión lineal '), mi('F: X \\to \\mathbb{R}'), t(' tal que')),
          md('F|_Y = f \\qquad \\text{y} \\qquad F(x) \\leq p(x) \\quad \\forall x \\in X'),
        ),
        thm('proof', '',
          p(b('Existencia:'), t(' Aplicar el lema de extensión de un paso repetidamente. Sea '), mi('\\mathcal{F}'), t(' la familia de todas las extensiones de '), mi('f'), t(' dominadas por '), mi('p'), t(', ordenada por '), mi('(g_1, Z_1) \\leq (g_2, Z_2) \\iff Z_1 \\subseteq Z_2'), t(' y '), mi('g_2|_{Z_1} = g_1'), t('. Por el lema de Zorn existe un elemento maximal '), mi('(F, Z^*)'), t('.')),
          p(b('Maximalidad implica '), mi('Z^* = X'), t(': si '), mi('Z^* \\neq X'), t(', el primer lema produce una extensión estricta, contradiciendo la maximalidad. '), it('∎')),
        ),

        h(1, 'Corolarios'),
        thm('corollary', 'Extensión preservando norma',
          p(t('Sea '), mi('(X, \\|\\cdot\\|)'), t(' un espacio normado, '), mi('Y \\subseteq X'), t(' subespacio y '), mi('f \\in Y^*'), t('. Existe '), mi('F \\in X^*'), t(' con '), mi('F|_Y = f'), t(' y '), mi('\\|F\\|_{X^*} = \\|f\\|_{Y^*}'), t('.')),
        ),
        thm('corollary', 'Separación de puntos',
          p(t('Para todo '), mi('x \\in X'), t(' con '), mi('x \\neq 0'), t(', existe '), mi('F \\in X^*'), t(' con '), mi('F(x) = \\|x\\|'), t(' y '), mi('\\|F\\| = 1'), t('. En particular, '), mi('X^*'), t(' separa puntos de '), mi('X'), t('.')),
        ),
        thm('corollary', 'Separación geométrica',
          p(t('Sean '), mi('A, B \\subset X'), t(' convexos no vacíos con '), mi('A \\cap B = \\emptyset'), t(' y '), mi('A'), t(' abierto. Entonces existe '), mi('F \\in X^*'), t(' y '), mi('c \\in \\mathbb{R}'), t(' tales que')),
          md('F(a) < c \\leq F(b) \\quad \\text{para todo } a \\in A,\\, b \\in B'),
        ),

        h(1, 'Observaciones finales'),
        thm('remark', 'Versión compleja',
          p(t('El teorema se extiende a espacios vectoriales complejos: dado '), mi('f: Y \\to \\mathbb{C}'), t(' lineal acotado, existe '), mi('F: X \\to \\mathbb{C}'), t(' extensión con '), mi('\\|F\\| = \\|f\\|'), t('. La demostración reduce el caso complejo al real identificando la parte real del funcional.')),
        ),
        thm('note', 'Equivalencia con el axioma de elección',
          p(t('La demostración del lema de Zorn utiliza el axioma de elección. De hecho, el teorema de Hahn–Banach es estrictamente más débil que el axioma de elección pero no es demostrable sin alguna forma de elección: existen modelos de ZF donde falla.')),
        ),
        thm('exercise', '',
          p(t('Usar el teorema de Hahn–Banach para demostrar que en un espacio de Hilbert '), mi('H'), t(', todo funcional lineal acotado '), mi('f \\in H^*'), t(' se puede representar como '), mi('f(x) = \\langle x, y \\rangle'), t(' para un único '), mi('y \\in H'), t('. '), it('(Teorema de representación de Riesz.)')),
        ),
      ]},

      en: { type: 'doc', content: [
        p(t('The Hahn–Banach theorem is one of the fundamental results of functional analysis. It guarantees the extension of bounded linear functionals while preserving the norm, with deep consequences for duality, separation of convex sets, and functional representation.')),

        h(1, 'Preliminaries'),
        thm('definition', 'Normed space and bounded functional',
          p(t('A '), b('normed space'), t(' is a pair '), mi('(X, \\|\\cdot\\|)'), t('. A functional '), mi('f: X \\to \\mathbb{R}'), t(' is '), b('bounded linear'), t(' if it is linear and')),
          md('\\|f\\| = \\sup_{\\|x\\|=1} |f(x)| < \\infty'),
        ),
        thm('definition', 'Minkowski functional',
          p(t('For a convex, absorbing, balanced set '), mi('C \\subset X'), t(', the '), b('Minkowski functional'), t(' is')),
          md('p(x) = \\inf\\{\\lambda > 0 : x \\in \\lambda C\\}'),
          p(t('It satisfies '), mi('p(x+y) \\leq p(x)+p(y)'), t(' and '), mi('p(\\alpha x) = \\alpha p(x)'), t(' for '), mi('\\alpha \\geq 0'), t('.')),
        ),

        h(1, 'Auxiliary lemmas'),
        thm('lemma', 'One-step extension',
          p(t('Let '), mi('Y \\subsetneq X'), t(', '), mi('f: Y \\to \\mathbb{R}'), t(' linear with '), mi('f \\leq p|_Y'), t(', and '), mi('x_0 \\notin Y'), t('. Then there exists a linear extension '), mi('g'), t(' to '), mi('\\mathrm{span}(Y \\cup \\{x_0\\})'), t(' with '), mi('g \\leq p'), t('.')),
        ),
        thm('proof', '',
          p(t('Every element of the extended space writes as '), mi('y + \\alpha x_0'), t('. Set '), mi('g(y+\\alpha x_0) = f(y) + \\alpha c'), t('. The condition '), mi('g \\leq p'), t(' requires')),
          md('\\sup_{y}\\bigl[f(y) - p(y - x_0)\\bigr] \\leq c \\leq \\inf_{y}\\bigl[p(y + x_0) - f(y)\\bigr]'),
          p(t('Subadditivity of '), mi('p'), t(' ensures the sup does not exceed the inf, so such '), mi('c'), t(' exists. '), it('∎')),
        ),

        h(1, 'Main theorem'),
        thm('theorem', 'Hahn–Banach',
          p(t('Let '), mi('X'), t(' be a real vector space, '), mi('p'), t(' sublinear, '), mi('Y \\subseteq X'), t(' a subspace and '), mi('f: Y \\to \\mathbb{R}'), t(' linear with '), mi('f \\leq p|_Y'), t('. There exists a linear extension '), mi('F: X \\to \\mathbb{R}'), t(' with')),
          md('F|_Y = f \\qquad F(x) \\leq p(x) \\; \\forall x \\in X'),
        ),
        thm('proof', '',
          p(t('Order all dominated extensions by inclusion. By '), b('Zorn\'s lemma'), t(' there is a maximal element '), mi('(F, Z^*)'), t('. The one-step lemma shows '), mi('Z^* = X'), t(' (otherwise we could extend further, contradicting maximality). '), it('∎')),
        ),

        h(1, 'Corollaries'),
        thm('corollary', 'Norm-preserving extension',
          p(t('If '), mi('f \\in Y^*'), t(', there exists '), mi('F \\in X^*'), t(' with '), mi('F|_Y = f'), t(' and '), mi('\\|F\\|_{X^*} = \\|f\\|_{Y^*}'), t('.')),
        ),
        thm('corollary', 'Separation of points',
          p(t('For every '), mi('x \\neq 0'), t(' in '), mi('X'), t(', there exists '), mi('F \\in X^*'), t(' with '), mi('F(x) = \\|x\\|'), t(' and '), mi('\\|F\\|=1'), t('. Thus '), mi('X^*'), t(' separates points of '), mi('X'), t('.')),
        ),
        thm('corollary', 'Geometric separation',
          p(t('If '), mi('A, B \\subset X'), t(' are disjoint convex sets with '), mi('A'), t(' open, there exist '), mi('F \\in X^*'), t(' and '), mi('c \\in \\mathbb{R}'), t(' with')),
          md('F(a) < c \\leq F(b) \\quad \\forall a \\in A,\\, b \\in B'),
        ),
        thm('exercise', '',
          p(t('Use Hahn–Banach to prove the Riesz representation theorem: every '), mi('f \\in H^*'), t(' on a Hilbert space satisfies '), mi('f(x) = \\langle x,y \\rangle'), t(' for a unique '), mi('y \\in H'), t('.')),
        ),
      ]},
    },
  },

]

// ── Component ─────────────────────────────────────────────────────

@customElement('fp-template-selector')
export class TemplateSelector extends LitElement {

  @state() private _selected: string = 'blank'
  @state() private _lang: Lang = 'es'

  private _dialog!: HTMLDialogElement

  override createRenderRoot() { return this }

  override firstUpdated() {
    this._dialog = this.querySelector('dialog')!
    window.addEventListener('formalia:new', () => this.open())
  }

  open() {
    this._selected = 'blank'
    this._dialog?.showModal()
  }

  override render() {
    return html`
      <dialog class="tmpl-dialog" @click="${this._onBackdrop}" @keydown="${this._onKeydown}">
        <div class="tmpl-inner" @click="${(e: Event) => e.stopPropagation()}">

          <div class="tmpl-header">
            <span class="tmpl-title">${this._lang === 'es' ? 'Nuevo documento' : 'New document'}</span>
            <div class="tmpl-lang-toggle">
              <button class="tmpl-lang-btn ${this._lang === 'es' ? 'is-active' : ''}"
                @click="${() => { this._lang = 'es' }}">ES</button>
              <button class="tmpl-lang-btn ${this._lang === 'en' ? 'is-active' : ''}"
                @click="${() => { this._lang = 'en' }}">EN</button>
            </div>
            <button class="tbtn" @click="${this._close}" title="Cancelar (Esc)">✕</button>
          </div>

          <div class="tmpl-grid">
            ${TEMPLATES.map(tmpl => html`
              <button
                class="tmpl-card ${this._selected === tmpl.id ? 'is-selected' : ''}"
                @click="${() => { this._selected = tmpl.id }}"
                @dblclick="${() => { this._selected = tmpl.id; this._apply() }}"
              >
                <div class="tmpl-card-label">${tmpl.label[this._lang]}</div>
                <div class="tmpl-card-desc">${tmpl.description[this._lang]}</div>
              </button>
            `)}
          </div>

          <div class="tmpl-footer">
            <button class="tbtn" @click="${this._close}">${this._lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
            <button class="tbtn tmpl-apply" @click="${this._apply}">
              ${this._lang === 'es' ? 'Crear documento' : 'Create document'}
            </button>
          </div>

        </div>
      </dialog>
    `
  }

  private _close = () => { this._dialog?.close() }
  private _onBackdrop = () => { this._close() }
  private _onKeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this._apply() } }

  private _apply = () => {
    const template = TEMPLATES.find(tmpl => tmpl.id === this._selected)
    if (!template) return
    initDocMeta({ title: '', author: '', email: '', date: '', institution: '', abstract: '', keywords: '', ...template.meta[this._lang] })
    setDocumentContent(template.content[this._lang] as never)
    this._dialog?.close()
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-template-selector': TemplateSelector }
}
