import { useEffect, useState } from 'react'
import type { WikiAnimationProps } from './types'

const W = 640
const H = 250
const X0 = 40
const X1 = 600
const CY = 118
const UNIT_Y = 40
const X_MIN = -2 * Math.PI
const X_MAX = 2 * Math.PI
const SAMPLES = 160

const px = (x: number) => X0 + ((x - X_MIN) / (X_MAX - X_MIN)) * (X1 - X0)
const py = (y: number) => CY - y * UNIT_Y

/** Rango de cada parámetro (como el min/max que convierte un parámetro en slider). */
const A_RANGE = [0.5, 2] as const
const B_RANGE = [0.5, 1.5] as const

function params(t: number) {
  return { a: 1.25 + 0.55 * Math.sin(t * 0.9), b: 1 + 0.32 * Math.sin(t * 0.6 + 1) }
}

function pathOf(f: (x: number) => number, from = X_MIN, to = X_MAX): string {
  let d = ''
  for (let i = 0; i <= SAMPLES; i++) {
    const x = from + ((to - from) * i) / SAMPLES
    d += `${i === 0 ? 'M' : 'L'}${px(x).toFixed(1)} ${py(f(x)).toFixed(1)}`
  }
  return d
}

/**
 * Módulo de gráficos: f(x) = a·sin(bx) con parámetros que se mueven solos (en la
 * vista HTML son sliders), su derivada como curva con rol «derivada», el área bajo
 * la primera loma y un punto que recorre la curva con su tangente.
 */
export function Grafico({ playing }: WikiAnimationProps) {
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      setT((value) => value + (now - last) / 1000)
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const { a, b } = params(t)
  const f = (x: number) => a * Math.sin(b * x)
  const df = (x: number) => a * b * Math.cos(b * x)

  // Área bajo la primera loma positiva: de 0 a π/b.
  const areaTo = Math.PI / b
  const area = `${pathOf(f, 0, areaTo)} L${px(areaTo)} ${py(0)} L${px(0)} ${py(0)} Z`

  // Punto que recorre la curva, con su recta tangente.
  const xp = X_MIN + 0.5 + ((t * 0.9) % (X_MAX - X_MIN - 1))
  const yp = f(xp)
  const slope = df(xp)
  const dx = 0.9
  const tangent = `M${px(xp - dx)} ${py(yp - slope * dx)} L${px(xp + dx)} ${py(yp + slope * dx)}`

  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="wiki-plot block w-full" role="img" aria-label="Gráfico de f(x) = a·sin(bx), su derivada y el área bajo la curva">
        <g className="wiki-plot-grid">
          {[-2, -1, 1, 2].map((y) => (
            <path key={y} d={`M${X0} ${py(y)} H${X1}`} />
          ))}
          {[-2, -1, 1, 2].map((k) => (
            <path key={`v${k}`} d={`M${px(k * Math.PI)} ${py(2.6)} V${py(-2.6)}`} />
          ))}
        </g>
        <path d={`M${X0} ${CY} H${X1} M${px(0)} ${py(2.7)} V${py(-2.7)}`} className="wiki-plot-axes" pathLength={1} />
        {[-2, -1, 1, 2].map((k) => (
          <text key={`l${k}`} x={px(k * Math.PI)} y={CY + 18} textAnchor="middle" className="wiki-plot-tick">
            {k === 1 ? 'π' : k === -1 ? '−π' : `${k < 0 ? '−' : ''}${Math.abs(k)}π`}
          </text>
        ))}

        <path d={area} className="wiki-plot-area" />
        <path d={pathOf(df)} className="wiki-plot-derivative" />
        <path d={pathOf(f)} className="wiki-plot-curve" />
        <path d={tangent} className="wiki-plot-tangent" />
        <circle cx={px(xp)} cy={py(yp)} r={5} className="wiki-plot-point" />

        <text x={X0 + 8} y={22} className="wiki-plot-label">
          f(x) = {a.toFixed(2)} · sin({b.toFixed(2)} x)
        </text>
        <text x={X0 + 8} y={42} className="wiki-plot-label wiki-plot-label--derivative">
          f′(x)
        </text>
        <text x={px(areaTo / 2)} y={py(0) - 10} textAnchor="middle" className="wiki-plot-label wiki-plot-label--area">
          ∫
        </text>
      </svg>

      <div className="mt-2 grid gap-3 px-2 sm:grid-cols-2" aria-hidden="true">
        <Slider name="a" value={a} range={A_RANGE} />
        <Slider name="b" value={b} range={B_RANGE} />
      </div>
    </div>
  )
}

function Slider({ name, value, range }: { name: string; value: number; range: readonly [number, number] }) {
  const ratio = (value - range[0]) / (range[1] - range[0])
  return (
    <div className="flex items-center gap-3 text-xs text-(--color-ink-muted)">
      <span className="wiki-serif w-3 text-sm italic text-(--color-ink)">{name}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-(--color-border)">
        <div className="absolute inset-y-0 left-0 rounded-full bg-(--color-primary)" style={{ width: `${ratio * 100}%` }} />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--color-primary) bg-(--color-ink)"
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono">{value.toFixed(2)}</span>
    </div>
  )
}
