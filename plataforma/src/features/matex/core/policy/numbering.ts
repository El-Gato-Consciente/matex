import { equationPlan } from '../equation'
import type { EquationRow, TheoremVariant } from '../ast'

/**
 * **Política de numeración del documento — la fuente ÚNICA.**
 *
 * Es una decisión de **política compartida** (ver `matex/03-modelo-semantico/reglas-del-modelo.md`
 * §3): los tres backends —LaTeX, HTML y el editor visual— deben numerar **idéntico**. Si
 * difieren, es un bug, no una diferencia de medio. Antes vivía implementada tres veces y
 * **divergía** (FIX-18: el HTML numeraba los teoremas global en vez de por sección y numeraba
 * las observaciones); ahora las reglas viven acá y cada backend solo aporta el recorrido.
 *
 * **Autoridad:** el canon de LaTeX (`core/latex/canon.ts`):
 *   `\newtheorem{theorem}{Teorema}[section]` → teoremas **por sección**, contador compartido;
 *   `\newtheorem*{remark}{Observación}` → las observaciones **no** numeran; `proof` tampoco.
 *
 * **Cómo se usa:** cada backend crea un contador (`createDocNumbering()`) y recorre su
 * representación **en orden de documento**, llamando a un método por cada objeto numerable. El
 * contador tiene estado (es un recorrido), así que el orden importa y debe ser el mismo en los
 * tres — que es justo lo que verifica QA-08.
 */
export interface DocNumbering {
  /**
   * Parte (`\part`) → número **romano** («I», «II»), contador propio (ME-46). Como en LaTeX, una
   * parte **no** reinicia los capítulos/secciones: es un divisor rotulado, el resto sigue su cuenta.
   */
  part(): string
  /** Encabezado de nivel 1/2/3 → número jerárquico («1», «1.1», «1.1.1»). */
  section(level: 1 | 2 | 3): string
  /**
   * Entorno tipo teorema → «1.2» (por sección, contador compartido con lemas/definiciones/…),
   * o `null` si **no numera** (`proof` y `remark`, igual que el canon).
   */
  theorem(variant: TheoremVariant): string | null
  /**
   * Fórmula en bloque → un número por fila (`null` = fila sin número). El contador es **continuo**
   * en todo el documento; el entorno concreto (una suelta vs `align`/`gather`) no cambia el conteo.
   */
  equation(rows: readonly EquationRow[], aligned: boolean | undefined): (string | null)[]
  /** Figura → «1» solo si tiene caption (como en LaTeX, el número lo da `\caption`); si no, `null`. */
  figure(hasCaption: boolean): string | null
  /** Tabla → «1» solo si tiene caption; si no, `null`. Contador separado del de figuras. */
  table(hasCaption: boolean): string | null
}

/** Los entornos tipo teorema que **no** reciben número (espejo de `\newtheorem*` + `proof`). */
const UNNUMBERED_THEOREMS: ReadonlySet<TheoremVariant> = new Set(['proof', 'remark'])

/** ¿Una fila de fórmula en bloque recibe número? Regla única, derivada de `equationPlan`. */
export function equationRowIsNumbered(row: EquationRow, plan: { multiline: boolean; starred: boolean }): boolean {
  // Multilínea: numeran las filas marcadas, salvo que el entorno sea estrellado (ninguna marcada).
  // Una sola fila: numera si está marcada. (Ambas ramas coinciden con lo que emite el compilador.)
  return plan.multiline ? !plan.starred && row.numbered === true : row.numbered === true
}

/** Entero → número romano en mayúsculas (para las partes: I, II, III, …). */
export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  let rem = Math.max(0, Math.floor(n))
  for (const [value, sym] of table) while (rem >= value) { out += sym; rem -= value }
  return out
}

/** Crea un contador de numeración fresco (un recorrido de documento). */
export function createDocNumbering(): DocNumbering {
  let prt = 0
  const sec = [0, 0, 0] // niveles 1, 2, 3
  let thmInSection = 0
  let eq = 0
  let fig = 0
  let tab = 0

  return {
    part() {
      prt += 1
      return toRoman(prt)
    },
    section(level) {
      sec[level - 1] = (sec[level - 1] ?? 0) + 1
      for (let i = level; i < 3; i += 1) sec[i] = 0
      // Los teoremas se numeran por sección: al abrir una sección de nivel 1, reinician.
      if (level === 1) thmInSection = 0
      return sec.slice(0, level).join('.')
    },
    theorem(variant) {
      if (UNNUMBERED_THEOREMS.has(variant)) return null
      thmInSection += 1
      return `${sec[0] ?? 0}.${thmInSection}`
    },
    equation(rows, aligned) {
      const plan = equationPlan([...rows], aligned)
      return rows.map((row) => {
        if (!equationRowIsNumbered(row, plan)) return null
        eq += 1
        return String(eq)
      })
    },
    figure(hasCaption) {
      if (!hasCaption) return null
      fig += 1
      return String(fig)
    },
    table(hasCaption) {
      if (!hasCaption) return null
      tab += 1
      return String(tab)
    },
  }
}
