import { evalExprXY, parseExprXY, type ExprNode, type ExprSyntax } from '../plotExpr'

/**
 * Parsea una ecuación implícita `"LHS = RHS"` (o solo `F`, `=0` implícito) en las variables
 * `x, y` → el nodo `F = LHS − RHS` (la curva es `F = 0`), o `null` si no parsea.
 */
export function parseImplicit(equation: string, syntax: ExprSyntax = 'both'): ExprNode | null {
  const parts = equation.split('=')
  const lhs = parseExprXY(parts[0] ?? '', syntax)
  if (!lhs.ok) return null
  const rhsSrc = parts.length > 1 ? parts.slice(1).join('=').trim() : ''
  if (rhsSrc === '' || rhsSrc === '0') return lhs.node
  const rhs = parseExprXY(rhsSrc, syntax)
  return rhs.ok ? { t: 'bin', op: '-', a: lhs.node, b: rhs.node } : null
}

/**
 * **Curvas implícitas** `F(x, y) = 0` (familia A4, subtipo). No hay forma explícita `y=f(x)`, así
 * que se **computa la curva en JS** (marching squares + refinamiento por bisección/secante) y se
 * emite como **polilíneas** → coordenadas a pgfplots (PDF) y `<polyline>` al SVG (preview): el mismo
 * cálculo alimenta ambos backends ("lo que se ve = lo que compila"), **sin `gnuplot`/shell-escape**.
 * Ver `matex/03-modelo-semantico/proyecto-multiarchivo.md` y `matex/07-informes/metodos_graficar_implicitas.md`.
 *
 * Método (líneas base del informe): grilla uniforme N×N, signo de `F` en los vértices, y por celda
 * las 16 configuraciones de marching squares; cada cruce por arista se **refina** (secante acotada)
 * para quitar el facetado. Los saddles (5/10) se resuelven por el signo del centro. Las celdas con
 * un vértice no finito (asíntotas) se saltan. Los segmentos se **enlazan** en polilíneas.
 */

export interface Viewport {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}
export type Point = [number, number]

/** Polilíneas de la curva `F=0` dentro del viewport. `resolution` = celdas por eje. */
export function implicitCurve(node: ExprNode, vp: Viewport, resolution = 140): Point[][] {
  const N = Math.max(20, Math.min(400, Math.round(resolution)))
  const f = (x: number, y: number): number => evalExprXY(node, x, y)
  const dx = (vp.xmax - vp.xmin) / N
  const dy = (vp.ymax - vp.ymin) / N
  const xAt = (i: number): number => vp.xmin + i * dx
  const yAt = (j: number): number => vp.ymin + j * dy

  // Grilla de valores de F.
  const val: number[][] = Array.from({ length: N + 1 }, (_, i) => {
    const row = new Array<number>(N + 1)
    for (let j = 0; j <= N; j += 1) row[j] = f(xAt(i), yAt(j))
    return row
  })

  /** Cruce por cero refinado (secante acotada) en el segmento A→B donde f cambia de signo. */
  const cross = (ax: number, ay: number, fa: number, bx: number, by: number, fb: number): Point => {
    let lo = 0
    let hi = 1
    let flo = fa
    let fhi = fb
    let t = fa / (fa - fb)
    for (let k = 0; k < 6; k += 1) {
      if (!(fhi !== flo)) break
      t = lo + ((0 - flo) / (fhi - flo)) * (hi - lo)
      const px = ax + t * (bx - ax)
      const py = ay + t * (by - ay)
      const fm = f(px, py)
      if (!Number.isFinite(fm) || Math.abs(fm) < 1e-12) break
      if ((fm < 0) === (flo < 0)) {
        lo = t
        flo = fm
      } else {
        hi = t
        fhi = fm
      }
    }
    return [ax + t * (bx - ax), ay + t * (by - ay)]
  }

  const segs: [Point, Point][] = []
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const v0 = val[i]![j]! // bottom-left
      const v1 = val[i + 1]![j]! // bottom-right
      const v2 = val[i + 1]![j + 1]! // top-right
      const v3 = val[i]![j + 1]! // top-left
      if (!(Number.isFinite(v0) && Number.isFinite(v1) && Number.isFinite(v2) && Number.isFinite(v3))) continue
      const code = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0)
      if (code === 0 || code === 15) continue
      const x0 = xAt(i)
      const x1 = xAt(i + 1)
      const y0 = yAt(j)
      const y1 = yAt(j + 1)
      // Cruces por arista: e0 abajo, e1 derecha, e2 arriba, e3 izquierda.
      const e = [
        (): Point => cross(x0, y0, v0, x1, y0, v1),
        (): Point => cross(x1, y0, v1, x1, y1, v2),
        (): Point => cross(x0, y1, v3, x1, y1, v2),
        (): Point => cross(x0, y0, v0, x0, y1, v3),
      ]
      const seg = (a: number, b: number): void => {
        segs.push([e[a]!(), e[b]!()])
      }
      switch (code) {
        case 1: case 14: seg(3, 0); break
        case 2: case 13: seg(0, 1); break
        case 3: case 12: seg(1, 3); break
        case 4: case 11: seg(1, 2); break
        case 6: case 9: seg(0, 2); break
        case 7: case 8: seg(2, 3); break
        case 5: {
          if ((f((x0 + x1) / 2, (y0 + y1) / 2) < 0) === (v0 < 0)) { seg(3, 0); seg(1, 2) } else { seg(0, 1); seg(2, 3) }
          break
        }
        case 10: {
          if ((f((x0 + x1) / 2, (y0 + y1) / 2) < 0) === (v1 < 0)) { seg(0, 1); seg(2, 3) } else { seg(3, 0); seg(1, 2) }
          break
        }
      }
    }
  }
  return linkSegments(segs)
}

/** Enlaza segmentos que comparten extremo en **polilíneas** (para trazos continuos, no cientos de rayitas). */
function linkSegments(segs: readonly [Point, Point][]): Point[][] {
  const key = (p: Point): string => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`
  const at = new Map<string, number[]>() // clave de punto → índices de segmentos que lo tocan
  segs.forEach(([a, b], i) => {
    for (const k of [key(a), key(b)]) {
      const arr = at.get(k)
      if (arr) arr.push(i)
      else at.set(k, [i])
    }
  })
  const used = new Array<boolean>(segs.length).fill(false)
  const polylines: Point[][] = []

  /** Extiende `poly` desde su extremo `tail` siguiendo segmentos sin usar. */
  const extend = (poly: Point[], tailFromEnd: boolean): void => {
    for (;;) {
      const tail = tailFromEnd ? poly[poly.length - 1]! : poly[0]!
      const cand = (at.get(key(tail)) ?? []).find((s) => !used[s])
      if (cand === undefined) break
      used[cand] = true
      const [a, b] = segs[cand]!
      const next = key(a) === key(tail) ? b : a
      if (tailFromEnd) poly.push(next)
      else poly.unshift(next)
    }
  }

  for (let s = 0; s < segs.length; s += 1) {
    if (used[s]) continue
    used[s] = true
    const poly: Point[] = [segs[s]![0], segs[s]![1]]
    extend(poly, true)
    extend(poly, false)
    polylines.push(poly)
  }
  return polylines
}
