/**
 * **Dónde está el usuario, como dato.** Núcleo puro de la navegación: no toca el DOM ni la
 * `History API` —eso es `useAppLocation`— así que se testea con strings y nada más.
 *
 * Hasta acá la app guardaba su posición en media docena de `useState` sueltos (`section`,
 * `lessonView`, `activeDocumentId`, `activeExemplarId`, `documentsView`). Eso tenía dos costos:
 * combinaciones imposibles representables (un ejemplar abierto *y* un proyecto abierto), y sobre
 * todo **el botón Atrás del navegador no hacía nada**, porque la posición nunca llegaba a la
 * historia del navegador. Modelarla como una unión discriminada arregla lo primero; que la URL
 * sea su representación canónica arregla lo segundo — y de paso hace que cada vista tenga un
 * link que se puede compartir.
 */

/** Sub-vistas de una lección del Curso. */
export type LessonView = 'learn' | 'example' | 'practice' | 'repaso'

/** Secciones de la nav principal. Se **deriva** de la ubicación, no se guarda aparte. */
export type Section = 'curso' | 'wiki' | 'proyectos'

export type AppLocation =
  /** Una lección del curso. `lessonId: null` = «la primera» (la app resuelve cuál es). */
  | { readonly kind: 'lesson'; readonly lessonId: string | null; readonly view: LessonView }
  /** La galería de proyectos del usuario. */
  | { readonly kind: 'projects' }
  /** El selector «Nuevo documento». */
  | { readonly kind: 'newDocument' }
  /** Un proyecto abierto en su workspace (LaTeX o Matex). */
  | { readonly kind: 'project'; readonly projectId: string }
  /** El visor de estudio de un ejemplar de la galería (fuente comentada + PDF). */
  | { readonly kind: 'exemplar'; readonly exemplarId: string }
  /** Una página de la wiki «Cómo funciona». `pageId: null` = la primera. */
  | { readonly kind: 'wiki'; readonly pageId: string | null }

/**
 * Ubicación inicial y destino de lo que no se reconoce: Mis Proyectos. (El Curso está oculto
 * de la nav por ahora, pero sus rutas siguen resolviendo para no romper links compartidos.)
 */
export const HOME: AppLocation = { kind: 'projects' }

/** El curso desde el principio (la app resuelve cuál es la primera lección). */
export const COURSE_START: AppLocation = { kind: 'lesson', lessonId: null, view: 'learn' }

/** Qué pinta la nav principal para esta ubicación. */
export function sectionOf(location: AppLocation): Section {
  if (location.kind === 'lesson') return 'curso'
  if (location.kind === 'wiki') return 'wiki'
  return 'proyectos'
}

/** Segmento de URL de cada sub-vista de lección. `learn` es el default y no lleva segmento. */
const VIEW_SEGMENT: Readonly<Record<Exclude<LessonView, 'learn'>, string>> = {
  example: 'ejemplo',
  practice: 'practicar',
  repaso: 'repaso',
}

/** Segmento → vista. Derivado de `VIEW_SEGMENT` para que no puedan divergir. */
const VIEW_BY_SEGMENT = new Map(
  Object.entries(VIEW_SEGMENT).map(([view, segment]) => [segment, view as LessonView]),
)

/** Ruta canónica de una ubicación. Es la que termina en la barra de direcciones. */
export function locationToPath(location: AppLocation): string {
  switch (location.kind) {
    case 'lesson': {
      const lesson = location.lessonId ? `/curso/${encodeURIComponent(location.lessonId)}` : '/curso'
      return location.view === 'learn' ? lesson : `${lesson}/${VIEW_SEGMENT[location.view]}`
    }
    case 'projects':
      return '/proyectos'
    case 'newDocument':
      return '/proyectos/nuevo'
    case 'project':
      return `/proyectos/${encodeURIComponent(location.projectId)}`
    case 'exemplar':
      return `/ejemplos/${encodeURIComponent(location.exemplarId)}`
    case 'wiki':
      return location.pageId ? `/como-funciona/${encodeURIComponent(location.pageId)}` : '/como-funciona'
  }
}

/**
 * Ruta → ubicación. **Nunca falla**: lo que no reconoce cae en `HOME`.
 *
 * Es deliberado. La URL es entrada de afuera (un link viejo, algo tipeado a mano, el fallback a
 * `index.html` de CloudFront) y un id que ya no existe no debería dar pantalla en blanco. Que el
 * `lessonId` o el `projectId` existan de verdad no se chequea acá: eso lo sabe quien tiene los
 * datos, y ya sabe qué hacer si no están (la primera lección; la galería).
 */
export function parseLocation(pathname: string): AppLocation {
  const [first, second, third] = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => safeDecode(segment))

  if (first === 'curso') {
    if (!second) return COURSE_START
    return { kind: 'lesson', lessonId: second, view: (third && VIEW_BY_SEGMENT.get(third)) || 'learn' }
  }

  if (first === 'proyectos') {
    if (!second) return { kind: 'projects' }
    // `nuevo` es una palabra reservada: los proyectos se identifican con un UUID.
    return second === 'nuevo' ? { kind: 'newDocument' } : { kind: 'project', projectId: second }
  }

  if (first === 'ejemplos' && second) return { kind: 'exemplar', exemplarId: second }

  if (first === 'como-funciona') return { kind: 'wiki', pageId: second ?? null }

  return HOME
}

/** `decodeURIComponent` de un segmento mal escapado tira; un id raro no es motivo de crash. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
