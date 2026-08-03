import type { ChartForm, ChartSpec, DiagramSpec, DistForm, DistSpec, TreeSpec } from '../core'

/**
 * **Specs por defecto** al insertar un gráfico (QA-06, slice 5). Puros: dado el tipo, devuelven
 * una especificación de arranque con datos de muestra, para que el gráfico se vea de una y el
 * usuario reemplace. Eran funciones sueltas dentro del God component; acá viven aisladas y
 * testeadas (un default roto = un gráfico que no se puede insertar).
 */

/** Gráfico categórico por defecto: 3 categorías, 1 serie; la torta muestra leyenda. */
export function defaultChartSpec(form: ChartForm): ChartSpec {
  return { form, categories: ['A', 'B', 'C'], series: [{ label: 'Serie 1', values: [3, 5, 2] }], legend: form === 'pie' }
}

/** Distribución por defecto: una muestra de 20 valores (histograma o boxplot). */
export function defaultDistSpec(form: DistForm): DistSpec {
  return { form, data: [{ label: 'muestra 1', samples: [4, 5, 5, 6, 6, 6, 7, 7, 8, 5, 6, 7, 6, 5, 8, 4, 6, 7, 6, 9] }] }
}

/** Árbol por defecto: una raíz con dos hijos. */
export function defaultTreeSpec(): TreeSpec {
  return {
    form: 'tree',
    nodes: [
      { id: 'r', label: 'raíz' },
      { id: 'a', label: 'hijo 1', parent: 'r' },
      { id: 'b', label: 'hijo 2', parent: 'r' },
    ],
  }
}

/** Diagrama por defecto: el cuadrado conmutativo canónico (A→B, A→C, B→D, C→D). */
export function defaultDiagramSpec(): DiagramSpec {
  return {
    form: 'commutative',
    nodes: [
      { id: 'n0_0', label: 'A', row: 0, col: 0 },
      { id: 'n0_1', label: 'B', row: 0, col: 1 },
      { id: 'n1_0', label: 'C', row: 1, col: 0 },
      { id: 'n1_1', label: 'D', row: 1, col: 1 },
    ],
    edges: [
      { from: 'n0_0', to: 'n0_1', label: 'f' },
      { from: 'n0_0', to: 'n1_0', label: 'g' },
      { from: 'n0_1', to: 'n1_1', label: 'h' },
      { from: 'n1_0', to: 'n1_1', label: 'k' },
    ],
  }
}
