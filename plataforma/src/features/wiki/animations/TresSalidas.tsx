import type { WikiAnimationProps } from './types'

const FAN = [
  { y: 70, label: 'PDF', sub: 'vía LaTeX, para imprimir' },
  { y: 150, label: 'HTML', sub: 'web, se adapta' },
  { y: 230, label: 'SVG', sub: 'gráficos vectoriales' },
] as const

/**
 * «Un documento, tres salidas»: los bloques del documento se vuelcan al modelo
 * (AST) y de ahí salen PDF, HTML y SVG. Puro CSS (ver `wiki.css`, `.wiki-ts-*`).
 */
export function TresSalidas(_: WikiAnimationProps) {
  return (
    <svg viewBox="0 0 720 300" className="wiki-ts block w-full" role="img" aria-label="Un documento Matex pasa por el modelo semántico y sale como PDF, HTML y SVG">
      <defs>
        <linearGradient id="wiki-ts-node" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Documento */}
      <rect x="24" y="40" width="200" height="220" rx="14" className="wiki-svg-card" />
      <text x="44" y="66" className="wiki-svg-mono">documento.mtex</text>
      <g className="wiki-ts-row" style={{ ['--i' as string]: 0 }}>
        <rect x="44" y="82" width="70" height="22" rx="11" className="wiki-svg-chip" />
        <text x="79" y="97" textAnchor="middle" className="wiki-svg-chip-text">Teorema</text>
        <rect x="122" y="90" width="82" height="6" rx="3" className="wiki-svg-line" />
      </g>
      <g className="wiki-ts-row" style={{ ['--i' as string]: 1 }}>
        <text x="44" y="140" className="wiki-svg-math">
          e<tspan dy="-7" fontSize="11">iπ</tspan>
          <tspan dy="7"> + 1 = 0</tspan>
        </text>
      </g>
      <g className="wiki-ts-row" style={{ ['--i' as string]: 2 }}>
        <path d="M44 196 H204 M54 206 V160" className="wiki-svg-axis" />
        <path d="M54 186 C 80 150, 100 150, 124 180 S 170 210, 200 166" className="wiki-svg-curve" />
      </g>
      <g className="wiki-ts-row" style={{ ['--i' as string]: 3 }}>
        <rect x="44" y="222" width="160" height="6" rx="3" className="wiki-svg-line" />
        <rect x="44" y="236" width="118" height="6" rx="3" className="wiki-svg-line" />
      </g>

      {/* Documento → modelo */}
      <path d="M224 150 H326" className="wiki-svg-wire" />
      <path d="M224 150 H326" pathLength={100} className="wiki-ts-flow wiki-ts-flow-in" />

      {/* Modelo (AST) */}
      <circle cx="360" cy="150" r="34" className="wiki-ts-ring" />
      <g className="wiki-ts-node">
        <circle cx="360" cy="150" r="34" fill="url(#wiki-ts-node)" />
        <text x="360" y="156" textAnchor="middle" className="wiki-svg-node-text">AST</text>
      </g>
      <text x="360" y="208" textAnchor="middle" className="wiki-svg-mono">el modelo</text>

      {/* Modelo → salidas */}
      {FAN.map((out, index) => {
        const d = `M394 150 C 450 150, 460 ${out.y}, 520 ${out.y}`
        return (
          <g key={out.label}>
            <path d={d} className="wiki-svg-wire" />
            <path d={d} pathLength={100} className="wiki-ts-flow wiki-ts-flow-out" style={{ ['--i' as string]: index }} />
            <g className="wiki-ts-out" style={{ ['--i' as string]: index }}>
              <rect x="520" y={out.y - 30} width="176" height="60" rx="12" className="wiki-svg-card" />
              <OutputIcon kind={out.label} x={536} y={out.y - 17} />
              <text x="578" y={out.y - 2} className="wiki-svg-title">{out.label}</text>
              <text x="578" y={out.y + 15} className="wiki-svg-sub">{out.sub}</text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

function OutputIcon({ kind, x, y }: { kind: 'PDF' | 'HTML' | 'SVG'; x: number; y: number }) {
  if (kind === 'PDF') {
    return (
      <g transform={`translate(${x} ${y})`} className="wiki-svg-icon">
        <path d="M0 0 H20 L28 8 V34 H0 Z" />
        <path d="M5 14 H23 M5 20 H23 M5 26 H16" />
      </g>
    )
  }
  if (kind === 'HTML') {
    return (
      <g transform={`translate(${x} ${y + 2})`} className="wiki-svg-icon">
        <rect width="30" height="28" rx="4" />
        <path d="M0 8 H30" />
        <path d="M8 16 L4 19 L8 22 M22 16 L26 19 L22 22" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y + 2})`} className="wiki-svg-icon">
      <path d="M2 26 C 8 4, 16 4, 18 15 S 26 26, 30 4" />
      <circle cx="2" cy="26" r="2.5" />
      <circle cx="30" cy="4" r="2.5" />
    </g>
  )
}
