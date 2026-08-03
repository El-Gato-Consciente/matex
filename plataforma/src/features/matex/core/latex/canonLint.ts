/**
 * Lint de contenido LaTeX: hace **ejecutable** el canon (`canon.ts` / `estandares.tex`).
 * Función pura sobre el string final de un documento; la usan los tests de QA para
 * que el corpus (lecciones, ejemplares, plantillas) no vuelva a divergir del estándar.
 *
 * Filosofía: el lint vigila el **PISO** (lo que el estándar manda siempre) y los
 * **anti-patrones** (l2tabu) — no preferencias estilísticas que la distinción
 * MÍNIMA/MÁXIMA hace dependientes del contexto. Por eso "usá mathtools en vez de
 * amsmath" no es error del lint (sería forzar paquetes); sí lo es cargar ambos.
 */

export interface LintIssue {
  readonly rule: string
  readonly message: string
}

export interface LintOptions {
  /**
   * Documento de "primer contacto" o de clase especial que no toma el PISO completo
   * (p. ej. la primera lección, o un CV con su propia tipografía). Se saltea el PISO,
   * pero los anti-patrones se chequean igual.
   */
  readonly allowMinimal?: boolean
}

/** ¿Es un documento completo (tiene `\documentclass`)? Los fragmentos incluidos no. */
function isFullDocument(source: string): boolean {
  return /\\documentclass/.test(source)
}

interface Rule {
  readonly rule: string
  readonly message: string
  /** Devuelve true si la regla se **viola**. */
  readonly violated: (src: string) => boolean
}

/** PISO: solo aplica a documentos completos y cuando no es `allowMinimal`. */
const PISO_RULES: readonly Rule[] = [
  {
    rule: 'piso/fontenc',
    message: 'falta \\usepackage[T1]{fontenc} (acentos que se copian y guionado correcto)',
    violated: (s) => !/\\usepackage(\[[^\]]*\])?\{[^}]*\}/.test(s) || !/\[T1\]\{fontenc\}/.test(s),
  },
  {
    rule: 'piso/lmodern',
    message: 'falta \\usepackage{lmodern} (fuentes vectoriales; requisito de microtype)',
    violated: (s) => !/\{lmodern\}/.test(s),
  },
  {
    rule: 'piso/babel-es-noshorthands',
    message:
      'babel en español debe ser [spanish,es-noshorthands]{babel} (los shorthands rompen tikz/siunitx/URLs)',
    violated: (s) => /\{babel\}/.test(s) && !/es-noshorthands/.test(s),
  },
  {
    rule: 'piso/babel-presente',
    message: 'falta \\usepackage[spanish,es-noshorthands]{babel} (idioma del documento)',
    violated: (s) => !/\{babel\}/.test(s),
  },
  {
    rule: 'piso/microtype',
    message: 'falta \\usepackage{microtype} (pulido tipográfico; el estándar lo pide siempre)',
    violated: (s) => !/\{microtype\}/.test(s),
  },
]

/** Anti-patrones (l2tabu): siempre se chequean. */
const ANTIPATTERN_RULES: readonly Rule[] = [
  {
    rule: 'anti/eqnarray',
    message: 'usá align en vez de eqnarray (espaciado roto)',
    violated: (s) => /\\begin\{eqnarray\*?\}/.test(s),
  },
  {
    rule: 'anti/dollar-dollar',
    message: 'usá \\[ ... \\] o equation en vez de $$...$$ (TeX plano, rompe el espaciado)',
    violated: (s) => /\$\$/.test(s),
  },
  {
    rule: 'anti/siunitx-viejo',
    message: 'en siunitx v3 usá \\qty/\\unit en vez de \\SI/\\si',
    violated: (s) => /\\SI\{/.test(s) || /\\si\{/.test(s),
  },
  {
    rule: 'anti/hline',
    message: 'usá booktabs (\\toprule/\\midrule/\\bottomrule) en vez de \\hline',
    violated: (s) => /\\hline/.test(s),
  },
  {
    rule: 'anti/reglas-verticales',
    message: 'tablas sin líneas verticales: quitá los | del column spec (regla booktabs)',
    violated: (s) =>
      /\\begin\{(tabular|tabularx|array)\}(\[[^\]]*\])?(\{[^}]*\})?\{[^}]*\|[^}]*\}/.test(s),
  },
  {
    rule: 'anti/fuentes-viejas',
    message: 'comandos de fuente obsoletos (\\bf,\\it,\\rm,\\sc,\\sl,\\tt): usá \\textbf/\\textit/… o \\bfseries/…',
    violated: (s) => /\\(bf|it|rm|sc|sl|tt)\b(?!series|shape|family|default)/.test(s),
  },
  {
    rule: 'anti/over',
    message: 'usá \\frac{a}{b} en vez de a \\over b (TeX plano)',
    violated: (s) => /\\over\b(?!line|brace|set|leftarrow|rightarrow)/.test(s),
  },
  {
    rule: 'anti/centerline',
    message: 'usá \\centering o el entorno center en vez de \\centerline',
    violated: (s) => /\\centerline\b/.test(s),
  },
]

/** Redundancia: cargar amsmath y mathtools a la vez (mathtools ya incluye amsmath). */
const REDUNDANCY_RULES: readonly Rule[] = [
  {
    rule: 'redundante/amsmath-con-mathtools',
    message: 'mathtools ya carga amsmath: quitá \\usepackage{amsmath}',
    violated: (s) => /\{mathtools\}/.test(s) && /\\usepackage(\[[^\]]*\])?\{amsmath\}/.test(s),
  },
]

/**
 * Devuelve los problemas de canon de un documento LaTeX. Vacío = limpio.
 * Las reglas de PISO se aplican solo a documentos completos y no `allowMinimal`.
 */
export function lintLatex(source: string, options: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = []
  const full = isFullDocument(source)

  if (full && !options.allowMinimal) {
    for (const rule of PISO_RULES) {
      if (rule.violated(source)) issues.push({ rule: rule.rule, message: rule.message })
    }
  }
  for (const rule of [...ANTIPATTERN_RULES, ...REDUNDANCY_RULES]) {
    if (rule.violated(source)) issues.push({ rule: rule.rule, message: rule.message })
  }
  return issues
}
