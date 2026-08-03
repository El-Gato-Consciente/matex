/**
 * **Cónicas semánticas (ME-42).** Genera la(s) polilínea(s) de una cónica declarada por su
 * *definición geométrica* (centro/vértice + radio/semiejes/focal). Puro y headless → coordenadas a
 * los 3 backends (como implícitas/interpolación, sin gnuplot). La hipérbola devuelve **dos ramas**.
 * `angle` (grados) rota alrededor del centro.
 */
import type { PlotConic } from '../ast'

type Pt = [number, number]

/** Muestrea `f(t)` para t en [t0,t1] con N pasos, en coords **locales**, luego rota+traslada. */
function sample(n: number, t0: number, t1: number, f: (t: number) => Pt): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i += 1) out.push(f(t0 + ((t1 - t0) * i) / n))
  return out
}

export function conicCurve(c: PlotConic): Pt[][] {
  const ang = ((c.angle ?? 0) * Math.PI) / 180
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  // local (lx,ly) relativo al centro → mundo (rotado + trasladado)
  const world = (lx: number, ly: number): Pt => [c.cx + lx * cos - ly * sin, c.cy + lx * sin + ly * cos]

  if (c.kind === 'circle') {
    const r = c.r ?? 1
    return [sample(96, 0, 2 * Math.PI, (t) => world(r * Math.cos(t), r * Math.sin(t)))]
  }
  if (c.kind === 'ellipse') {
    const a = c.a ?? 1
    const b = c.b ?? 1
    return [sample(120, 0, 2 * Math.PI, (t) => world(a * Math.cos(t), b * Math.sin(t)))]
  }
  if (c.kind === 'parabola') {
    const p = Math.max(1e-3, c.p ?? 1)
    const opens = c.opens ?? 'up'
    const T = Math.sqrt(400 * p) // alcanza ~coord 100 desde el vértice; la caja recorta
    // `up`: y = x²/(4p) (vértice en el origen local); las demás intercambian/reflejan ejes.
    const branch = (t: number): Pt => {
      const q = (t * t) / (4 * p)
      return opens === 'up' ? [t, q] : opens === 'down' ? [t, -q] : opens === 'right' ? [q, t] : [-q, t]
    }
    return [sample(200, -T, T, (t) => world(...branch(t)))]
  }
  // hipérbola: dos ramas x=±a·cosh u, y=b·sinh u
  const a = c.a ?? 1
  const b = c.b ?? 1
  const U = Math.acosh(Math.max(1.0001, 60 / Math.max(0.1, a)))
  const right = sample(120, -U, U, (u) => world(a * Math.cosh(u), b * Math.sinh(u)))
  const left = sample(120, -U, U, (u) => world(-a * Math.cosh(u), b * Math.sinh(u)))
  return [right, left]
}

/** Ecuación/nombre legible de una cónica (para la leyenda automática). */
export function conicLabel(c: PlotConic): string {
  if (c.kind === 'circle') return `círculo (r=${c.r ?? 1})`
  if (c.kind === 'ellipse') return `elipse (a=${c.a ?? 1}, b=${c.b ?? 1})`
  if (c.kind === 'parabola') return `parábola (p=${c.p ?? 1})`
  return `hipérbola (a=${c.a ?? 1}, b=${c.b ?? 1})`
}
