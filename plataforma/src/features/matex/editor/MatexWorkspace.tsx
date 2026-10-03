import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Panel, PanelGroup, type ImperativePanelHandle } from 'react-resizable-panels'
import { EditorContent, useEditor } from '@tiptap/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronLeft, ChevronRight, PanelLeft, Pencil } from '@/components/icons'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { ResizeHandle } from '@/components/ResizeHandle'
import { HeaderSlotContent } from '@/features/workspace/HeaderSlot'
import { DownloadControl } from '@/features/workspace/DownloadControl'
import { LatexEditor } from '@/features/editor/LatexEditor'
import { downloadFile } from '@/lib/files'
import { CompileLogBar } from '@/features/compiler/CompileLogBar'
import { CompileStatus } from '@/features/compiler/CompileStatus'
import { CompilingIndicator } from '@/features/compiler/CompilingIndicator'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import type { Project, ProjectFile } from '@/features/documents/types'
import type { ProjectStore } from '@/features/documents/ProjectStore'
import { compileToHtml, compileToLatex, MATEX_AST_VERSION, parseMatexDoc, serializeMatexDoc, type MatexDoc } from '../core'
import { NodeSelection } from '@tiptap/pm/state'
import { selectedRect } from '@tiptap/pm/tables'
import { KatexInline } from './plotEditorParts'
import { PlotEditor } from './PlotEditor'
import { MatexFiles } from './MatexFiles'
import { createMathPalette, insertActiveMath } from './mathPalette'
import { astToTiptap, tiptapToAst, type PmNode } from './mapping'
import { MATEX_BIB_EVENT, setBibKeysProvider } from './nodes'
import { useMatexCompile } from './useMatexCompile'
import { buildDataUrls, IMG_ACCEPT, isTextResourceName, MAX_IMAGE_BYTES, safeAssetName, uniqueName, usedFigureSrcs } from './assets'
import * as dl from './downloads'
import { DocumentSettings } from './DocumentSettings'
import * as ins from './insertActions'
import { defaultChartSpec, defaultDiagramSpec, defaultDistSpec, defaultTreeSpec } from './defaultSpecs'
import { BibliographyEditor } from './BibliographyEditor'
import { ChartEditor } from './ChartEditor'
import { DistEditor } from './DistEditor'
import { DiagramEditor } from './DiagramEditor'
import { TreeEditor } from './TreeEditor'
import { Modal } from '@/components/Modal'
import { CoverHeader } from './CoverHeader'
import { matexEditorExtensions } from './editorExtensions'
import { MiniSheet } from '@/features/documents/MiniSheet'
import { docOutline } from '@/features/documents/projectOutline'
import { accentHex } from '../core/policy/accent'
import { SlashMenu, type SlashAnchor } from './SlashMenu'
import { filterInsertItems, INSERT_GROUPS, type InsertItem } from './insertItems'
import { autoKey, documentFamily, emitBibtex } from '../core'
import type { Author, BibEntry, CalloutVariant, ChartForm, ChartSpec, DiagramSpec, DistForm, DistSpec, DocKind, DocMeta, FigureItem, PlotSpec, TableAlign, TheoremVariant, TreeSpec } from '../core'

const PdfPreview = lazy(() =>
  import('@/features/preview/PdfPreview').then((module) => ({ default: module.PdfPreview })),
)

const EMPTY_DOC: MatexDoc = { type: 'doc', version: MATEX_AST_VERSION, content: [{ type: 'paragraph', content: [] }] }

/**
 * Normaliza el AST **persistido** al abrir un proyecto: pasa por `parseMatexDoc`, que
 * valida y **migra** las formas viejas (p. ej. `mathDisplay` v1 con `tex` → v2 con
 * `rows`). Sin esto, un doc guardado antes de la migración rompería el compilador
 * (`rows` no iterable) y perdería su contenido al mapear a TipTap. Si la validación
 * falla, se usa el doc tal cual (no peor que antes de tener el boundary).
 */
function loadDoc(doc: MatexDoc | undefined): MatexDoc {
  if (!doc) return EMPTY_DOC
  try {
    return parseMatexDoc(doc)
  } catch {
    return doc
  }
}

// ── Assets de imagen (figuras) ───────────────────────────────────────────────

/** Spec por defecto de un gráfico categórico recién insertado (datos de ejemplo editables). */


/**
 * **Registry parte → editor** del inspector: según la **familia** de la parte activa de una
 * figura, renderiza su editor. El `switch` sobre `kind` es exhaustivo y type-safe (la `spec` se
 * estrecha por familia) → sumar una familia de gráfico = **un caso más acá**, sin tocar el resto.
 */
function FigurePartInspector({ item, onUpdateSpec }: { item: FigureItem; onUpdateSpec: (spec: PlotSpec | ChartSpec | DistSpec | DiagramSpec | TreeSpec) => void }) {
  switch (item.kind) {
    case 'plot':
      return <PlotEditor spec={item.spec} onPatch={(patch) => onUpdateSpec({ ...item.spec, ...patch })} />
    case 'chart':
      return <ChartEditor spec={item.spec} onChange={onUpdateSpec} />
    case 'distribution':
      return <DistEditor spec={item.spec} onChange={onUpdateSpec} />
    case 'diagram':
      return <DiagramEditor spec={item.spec} onChange={onUpdateSpec} />
    case 'tree':
      return <TreeEditor spec={item.spec} onChange={onUpdateSpec} />
    default:
      return null // 'image': sin inspector
  }
}

/** Nombres de imagen **en uso** por alguna figura del documento (recorre el AST). */
interface MatexWorkspaceProps {
  project: Project
  compiler: LatexCompiler
  store: ProjectStore
  onClose: () => void
}

/**
 * Workspace de un documento **Matex**: editor visual (TipTap sobre el AST, fuente
 * de verdad) + PDF, con toggle al LaTeX generado. Autosava el AST y compila el
 * LaTeX derivado con la pipeline existente. `matex-core` no sabe que TipTap existe.
 */
export function MatexWorkspace({ project, compiler, store, onClose }: MatexWorkspaceProps) {
  const isNarrow = useMediaQuery('(max-width: 860px)')
  const direction = isNarrow ? 'vertical' : 'horizontal'

  // Migramos el AST persistido una sola vez (mismo objeto para el estado y el editor).
  const initialDoc = useMemo(() => loadDoc(project.ast), [project.ast])
  const [ast, setAst] = useState<MatexDoc>(initialDoc)
  const [name, setName] = useState(project.name)
  const [rightView, setRightView] = useState<'pdf' | 'html' | 'latex' | 'ast'>('pdf')
  // Parte activa de la figura (subfiguras): a qué parte apuntan los controles/editor.
  const [activePart, setActivePart] = useState(0)
  // Explorador de archivos: panel lateral izquierdo colapsable (como en proyectos LaTeX).
  const filesPanelRef = useRef<ImperativePanelHandle | null>(null)
  const [filesCollapsed, setFilesCollapsed] = useState(true)
  // Panel de salida colapsable (como el explorador: toggle propio + riel para reabrir).
  const outputPanelRef = useRef<ImperativePanelHandle | null>(null)
  const [outputCollapsed, setOutputCollapsed] = useState(false)
  // Modales document-level (fuera del lienzo y de la barra contextual), homogéneos entre sí.
  const [bibOpen, setBibOpen] = useState(false)
  const [portadaOpen, setPortadaOpen] = useState(false)
  const [docCfgOpen, setDocCfgOpen] = useState(false)
  // Ancho (px) del inspector derecho (editor del gráfico): arrastrable en su borde izquierdo.
  const [inspectorW, setInspectorW] = useState(480)
  // TipTap v3 no re-renderiza React al mover el cursor; forzamos un tick para que
  // las barras/estados contextuales (p. ej. la de tabla) reflejen la selección.
  const [, bumpSelection] = useState(0)

  // Imágenes del proyecto (figuras): archivos base64 aparte del `main.tex` derivado.
  // Se persisten con el proyecto y se envían al compilar; `assetsRef` mapea nombre →
  // data URL para que el node view muestre la imagen (lectura síncrona, sin re-render).
  const [imageFiles, setImageFiles] = useState<ProjectFile[]>(() =>
    project.files.filter((f) => f.encoding === 'base64'),
  )
  // Recursos de **texto** (ME-12): `.tex` para `\input`, `.bib` de bibliografía, `.dat`/`.csv` de datos.
  // Se excluyen los **derivados** (`main.tex` lo genera el compilador; `refs.bib` sale de `references`).
  const [textFiles, setTextFiles] = useState<ProjectFile[]>(() =>
    project.files.filter((f) => f.encoding !== 'base64' && f.path !== 'main.tex' && f.path !== 'refs.bib'),
  )
  const assetsRef = useRef<Record<string, string>>({})
  const dataUrls = useMemo(() => buildDataUrls(imageFiles), [imageFiles])
  assetsRef.current = dataUrls
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Qué hacer con la próxima imagen elegida: insertar una figura nueva o reemplazar la actual.
  const pendingFigureAction = useRef<'insert' | 'replace' | 'addPart'>('insert')

  const meta = ast.meta ?? {}
  // La bibliografía usa un `refs.bib` real (proyecto multi-archivo); lo agregamos a los archivos.
  const latex = useMemo(() => compileToLatex(ast, { bibFile: 'refs.bib' }), [ast])
  // Segundo backend (LE-03): el MISMO AST → HTML standalone (MathML + SVG + CSS inline).
  // Prueba viva de la tesis semántica: un modelo, dos salidas. Las imágenes viajan como data URL.
  // Preview: forzamos el tema oscuro (la app es dark) para que no se vea "pálido" en el iframe.
  // **Lazy**: solo se compila cuando la vista HTML está activa (los gráficos interactivos con muchos
  // parámetros generan cientos de frames → no queremos ese costo en cada tecla si no se está viendo).
  const html = useMemo(() => (rightView === 'html' ? compileToHtml(ast, { images: dataUrls, theme: 'dark' }) : ''), [ast, dataUrls, rightView])
  const astJson = useMemo(() => serializeMatexDoc(ast), [ast])
  /** Recursos que acompañan al `main.tex` (imágenes + `.tex`/`.bib`/datos subidos + `refs.bib` real). */
  const compiledFiles = useMemo<ProjectFile[]>(
    () =>
      ast.references && ast.references.length > 0
        ? [...imageFiles, ...textFiles, { path: 'refs.bib', content: emitBibtex(ast.references), encoding: 'utf8' as const }]
        : [...imageFiles, ...textFiles],
    [imageFiles, textFiles, ast.references],
  )

  // Descargas (QA-06 slice 3): la lógica vive en `downloads.ts`; acá solo closures que capturan
  // el estado actual (nombre, ast, recursos) para los onClick.
  const downloadAst = () => dl.downloadAst(name, ast)
  const downloadHtml = () => dl.downloadHtml(name, ast, dataUrls)
  const downloadBundle = () => dl.downloadBundle(name, ast, imageFiles, textFiles)
  const downloadTex = () => dl.downloadTex(name, latex, compiledFiles)

  // Menú «/»: el teclado lo atiende el editor (el foco nunca sale del texto). El handler vive
  // en un ref porque `editorProps` se fija al crear el editor y necesita ver el estado al día.
  const slashKeyRef = useRef<(event: KeyboardEvent) => boolean>(() => false)

  // Si el editor no puede representar el documento (un nodo que no conoce, un texto vacío…),
  // TipTap lo abriría VACÍO y el primer cambio pisaría el modelo guardado con eso. Ante contenido
  // inválido: solo lectura y sin tocar el AST — la vista previa sigue mostrando el documento entero.
  const contentInvalid = useRef(false)
  const [contentProblem, setContentProblem] = useState<string | null>(null)

  const editor = useEditor({
    // El resolver lee `assetsRef.current` (ref estable) → siempre ve los assets al día.
    extensions: matexEditorExtensions({ resolveSrc: (src) => assetsRef.current[src] ?? null }),
    content: astToTiptap(initialDoc),
    enableContentCheck: true,
    onContentError: ({ editor, error }) => {
      contentInvalid.current = true
      editor.setEditable(false)
      setContentProblem(error.message)
    },
    // El AST del editor solo lleva `content`; `meta` (portada) y `references` (biblioteca)
    // son nivel documento y viven fuera de TipTap → los preservamos entre cambios.
    onUpdate: ({ editor }) =>
      contentInvalid.current ||
      setAst((prev) => {
        const next = tiptapToAst(editor.getJSON() as unknown as PmNode)
        return {
          ...next,
          ...(prev.meta ? { meta: prev.meta } : {}),
          ...(prev.references ? { references: prev.references } : {}),
        }
      }),
    onSelectionUpdate: () => bumpSelection((n) => n + 1),
    editorProps: {
      attributes: { class: 'matex-prose' },
      handleKeyDown: (_view, event) => slashKeyRef.current(event),
    },
  })

  // ── Menú «/» ──────────────────────────────────────────────────────────────
  // Se abre al escribir `/` al principio de un renglón o después de un espacio, y lo que se
  // tipea después filtra. Esc lo cierra hasta que la búsqueda cambie de lugar.
  const [slash, setSlash] = useState<{ from: number; to: number; query: string; anchor: SlashAnchor } | null>(null)
  const [slashActive, setSlashActive] = useState(0)
  const slashDismissedAt = useRef<number | null>(null)
  useEffect(() => {
    if (!editor) return
    const detect = () => {
      const { selection } = editor.state
      const $from = selection.$from
      const match =
        selection.empty && $from.parent.isTextblock && !$from.parent.type.spec.code
          ? /(?:^|\s)\/([\p{L}\d]*)$/u.exec($from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc'))
          : null
      if (!match) {
        slashDismissedAt.current = null
        setSlash(null)
        return
      }
      const query = match[1] ?? ''
      const from = selection.from - query.length - 1
      if (slashDismissedAt.current === from) {
        setSlash(null)
        return
      }
      const coords = editor.view.coordsAtPos(from)
      setSlash((previous) => {
        if (previous?.query !== query) setSlashActive(0)
        return { from, to: selection.from, query, anchor: { left: coords.left, top: coords.top, bottom: coords.bottom } }
      })
    }
    editor.on('transaction', detect)
    return () => {
      editor.off('transaction', detect)
    }
  }, [editor])


  // Autosave del AST (fuente de verdad), con debounce.
  useEffect(() => {
    const timer = setTimeout(() => store.updateAst(project.id, ast), 600)
    return () => clearTimeout(timer)
  }, [ast, project.id, store])

  // La **biblioteca** (`references`) vive a nivel documento, fuera de ProseMirror. La
  // exponemos a los node views (cita/marcador) vía un provider de claves (bridge estable) y
  // les avisamos con `MATEX_BIB_EVENT` cuando cambia, para que repinten (chips/claves rotas).
  const referencesRef = useRef<BibEntry[]>([])
  referencesRef.current = ast.references ?? []
  useEffect(() => {
    setBibKeysProvider(() => referencesRef.current.map((e) => e.key.trim() || autoKey(e)))
  }, [])
  useEffect(() => {
    document.dispatchEvent(new Event(MATEX_BIB_EVENT))
  }, [ast.references])

  /** Reemplaza la biblioteca de referencias (nivel documento). Vacía → se omite el campo. */
  function updateReferences(entries: BibEntry[]) {
    setAst((prev) => ({ ...prev, references: entries.length > 0 ? entries : undefined }))
  }

  // El explorador arranca **colapsado** (antes del primer paint → sin flash).
  useLayoutEffect(() => {
    filesPanelRef.current?.collapse()
  }, [])

  function toggleFiles() {
    const panel = filesPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  // Orquestación de compilación (QA-06): estado + compilar/staleness/descarga en un hook testeable.
  const {
    result,
    compiling,
    pdf,
    compiled,
    outputStale,
    compile: handleCompile,
    requestPdfDownload,
    downloadVariantPdf,
  } = useMatexCompile({ latex, compiledFiles, compiler, store, projectId: project.id, docName: name })

  // Examen: la versión del docente (con soluciones) es otra **emisión** del mismo documento; no se
  // guarda en el AST ni cambia la vista previa (que sigue siendo la del alumno).
  const isExam = documentFamily(meta) === 'exam'
  const downloadSolutionsPdf = () =>
    void downloadVariantPdf(
      compileToLatex(ast, { bibFile: 'refs.bib', showSolutions: true }),
      `${dl.documentBaseName(name)}${dl.SOLUTIONS_SUFFIX}`,
    )

  function toggleOutput() {
    const panel = outputPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  /** Arrastre del borde izquierdo del inspector para redimensionarlo (px, clampeado). */
  function startInspectorResize(e: ReactMouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = inspectorW
    // El inspector está a la derecha: mover el borde a la izquierda (clientX menor) = más ancho.
    const onMove = (ev: MouseEvent) => setInspectorW(Math.max(340, Math.min(820, startW - (ev.clientX - startX))))
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Compila una vez al abrir, para mostrar el PDF de entrada.
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    void handleCompile()
  }, [handleCompile])

  function commitName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name) store.rename(project.id, trimmed)
  }

  /** Inserta un atom vacío y lo selecciona: su node-view abre la edición inline. */
  function insertAtom(type: 'mathInline' | 'mathDisplay' | 'rawLatex' | 'ref' | 'cite' | 'footnote' | 'include') {
    editor
      ?.chain()
      .focus()
      .insertContent({ type })
      .command(({ tr, dispatch }) => {
        const pos = tr.selection.from - 1
        if (pos >= 0 && dispatch) {
          try {
            tr.setSelection(NodeSelection.create(tr.doc, pos))
          } catch {
            // Si no se puede seleccionar, el usuario abre la edición con un click.
          }
        }
        return true
      })
      .run()
  }

  const insertTheorem = (variant: TheoremVariant) => ins.insertTheorem(editor, variant)
  /** Inserta una derivación (razonamiento paso a paso) con dos pasos de ejemplo. */
  const insertDerivation = () => ins.insertDerivation(editor)
  /** Inserta un razonamiento de dos columnas (2 filas vacías; cada celda es contenido rico). */
  const insertReasoning = () => ins.insertReasoning(editor)
  /** Nodo ancestro de la selección con nombre `name` (para operar sobre el razonamiento/su fila). */
  function ancestorOf(name: string) {
    if (!editor) return null
    const $from = editor.state.selection.$from
    for (let d = $from.depth; d >= 1; d -= 1) {
      if ($from.node(d).type.name === name) return { node: $from.node(d), before: $from.before(d), after: $from.after(d) }
    }
    return null
  }
  function addReasoningRow() {
    const r = ancestorOf('reasoning')
    if (!editor || !r) return
    const cell = { type: 'reasoningCell', content: [{ type: 'paragraph' }] }
    editor.chain().focus().insertContentAt(r.before + r.node.nodeSize - 1, { type: 'reasoningRow', attrs: { boxed: false }, content: [cell, cell] }).run()
  }
  function removeReasoningRow() {
    const row = ancestorOf('reasoningRow')
    const r = ancestorOf('reasoning')
    if (!editor || !row || !r || r.node.childCount <= 1) return
    editor.chain().focus().deleteRange({ from: row.before, to: row.after }).run()
  }
  function toggleReasoningBoxed() {
    const row = ancestorOf('reasoningRow')
    if (!editor || !row) return
    editor.chain().focus().command(({ tr }) => {
      tr.setNodeAttribute(row.before, 'boxed', !row.node.attrs.boxed)
      return true
    }).run()
  }
  function setReasoningTitle(title: string) {
    const r = ancestorOf('reasoning')
    if (!editor || !r) return
    editor.chain().command(({ tr }) => {
      tr.setNodeAttribute(r.before, 'title', title || null)
      return true
    }).run()
  }
  const insertCallout = (variant: CalloutVariant) => ins.insertCallout(editor, variant)

  /** Abre el selector de archivo para insertar una figura nueva. */
  function insertFigure() {
    pendingFigureAction.current = 'insert'
    fileInputRef.current?.click()
  }
  /** Reemplaza la imagen de la figura seleccionada (misma figura, otra imagen). */
  function replaceFigureImage() {
    pendingFigureAction.current = 'replace'
    fileInputRef.current?.click()
  }

  /** Agrega la imagen elegida al proyecto (base64); devuelve su nombre, o `null` si se
   *  rechaza (muy grande o no es imagen). Evita el "Failed to fetch" por body gigante. */
  async function addImageAsset(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      window.alert(`«${file.name}» no parece una imagen.`)
      return null
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert(
        `La imagen «${file.name}» es muy grande (${(file.size / 1_000_000).toFixed(1)} MB). ` +
          `El máximo es ${(MAX_IMAGE_BYTES / 1_000_000).toFixed(0)} MB; comprimila o bajá su resolución.`,
      )
      return null
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    // Dedup contra `assetsRef.current` (no `imageFiles`): al mutarlo síncrono, un batch
    // de varias imágenes con el mismo nombre no colisiona (state es async).
    const name = uniqueName(safeAssetName(file.name), new Set(Object.keys(assetsRef.current)))
    // Actualizamos el ref **de forma síncrona** para que el node view vea la imagen ya.
    assetsRef.current = { ...assetsRef.current, [name]: dataUrl }
    setImageFiles((prev) => [...prev, { path: name, content: base64, encoding: 'base64' }])
    return name
  }

  function insertFigureFrom(assetName: string) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'figure', attrs: { items: [{ kind: 'image', src: assetName, width: 0.7 }] } })
      .run()
  }

  /** Inserta un gráfico de funciones con una spec por defecto (editable en la barra). */
  function insertPlot() {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'figure',
        attrs: { items: [{ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-5, 5], grid: true } }] },
      })
      .run()
  }
  /** Inserta un bloque de código vacío (se compila con `listings`). */
  const insertCodeBlock = () => ins.insertCodeBlock(editor)
  /** Inserta una **diapositiva** (frame de presentación) con un párrafo vacío. */
  const insertSlide = () => ins.insertSlide(editor)
  /** Inserta una **parte** (`\part`, ME-46): la división por encima del capítulo (solo report/book). */
  const insertPart = () => ins.insertPart(editor)
  const insertExamQuestion = () => ins.insertExamQuestion(editor)
  const insertCvEntry = () => ins.insertCvEntry(editor)
  const insertPosterBlock = () => ins.insertPosterBlock(editor)
  /** Inserta un bloque de **dos columnas** (cada una con un párrafo vacío). */
  const insertColumns = () => ins.insertColumns(editor)

  /** Índice de la **parte activa** de la figura, acotado a las partes actuales. */
  function activeIdxNow(items: readonly unknown[]): number {
    return items.length === 0 ? 0 : Math.min(Math.max(activePart, 0), items.length - 1)
  }
  /** Actualiza (mezcla) los atributos de la **parte activa** de la figura. Sin `.focus()`:
   *  los controles viven en la barra contextual (React); refocar el editor mientras se
   *  tipea le mandaría las teclas al lienzo (borrando el nodo seleccionado). */
  function updateActivePart(patch: Record<string, unknown>) {
    if (!editor) return
    const items = editor.getAttributes('figure').items
    if (!Array.isArray(items) || items.length === 0) return
    const idx = activeIdxNow(items)
    if (!items[idx]) return
    editor
      .chain()
      .updateAttributes('figure', { items: items.map((it: unknown, j: number) => (j === idx ? { ...(it as object), ...patch } : it)) })
      .run()
  }
  /** Reemplaza la `spec` de la parte activa (la usa el inspector `FigurePartInspector`). */
  function updatePartSpec(spec: PlotSpec | ChartSpec | DistSpec | DiagramSpec | TreeSpec) {
    updateActivePart({ spec })
  }
  /** Inserta una figura con un gráfico categórico (barras/torta) por defecto. */
  const insertChart = (form: ChartForm) => ins.insertChart(editor, form)
  /** Agrega un gráfico categórico como nueva parte de la figura activa. */
  function addChartPart(form: ChartForm) {
    appendFigurePart({ kind: 'chart', spec: defaultChartSpec(form) })
  }
  /** Inserta una figura con un gráfico de distribución (histograma/boxplot) por defecto. */
  const insertDist = (form: DistForm) => ins.insertDist(editor, form)
  /** Agrega una distribución como nueva parte de la figura activa. */
  function addDistPart(form: DistForm) {
    appendFigurePart({ kind: 'distribution', spec: defaultDistSpec(form) })
  }
  /** Inserta una figura con un diagrama conmutativo (Dominio B) por defecto. */
  const insertDiagram = () => ins.insertDiagram(editor)
  /** Agrega un diagrama conmutativo como nueva parte de la figura activa. */
  function addDiagramPart() {
    appendFigurePart({ kind: 'diagram', spec: defaultDiagramSpec() })
  }
  /** Inserta una figura con un árbol (Dominio B) por defecto. */
  const insertTree = () => ins.insertTree(editor)
  /** Agrega un árbol como nueva parte de la figura activa. */
  function addTreePart() {
    appendFigurePart({ kind: 'tree', spec: defaultTreeSpec() })
  }

  /** Sube recursos al proyecto (ME-12): **texto** (`.tex`/`.bib`/`.dat`/`.csv`) o **imágenes**, según extensión. */
  async function uploadResources(files: File[]) {
    for (const file of files) {
      if (isTextResourceName(file.name)) await addTextAsset(file)
      else await addImageAsset(file)
    }
  }
  /** Agrega un recurso de **texto** (leído como UTF-8) con nombre único; excluye los derivados. */
  async function addTextAsset(file: File): Promise<string | null> {
    const content = await file.text()
    const taken = new Set([...textFiles.map((f) => f.path), 'main.tex', 'refs.bib'])
    const name = uniqueName(safeAssetName(file.name), taken)
    setTextFiles((prev) => [...prev, { path: name, content, encoding: 'utf8' }])
    return name
  }
  function deleteTextFile(path: string) {
    setTextFiles((prev) => prev.filter((f) => f.path !== path))
  }
  function downloadTextFile(path: string) {
    const f = textFiles.find((t) => t.path === path)
    if (f) downloadFile(path, f.content, 'utf8')
  }
  /** Renombra un recurso de texto (conserva la extensión; único). No reescribe los `\input` que lo usen. */
  function renameTextFile(oldPath: string, newName: string) {
    const oldExt = oldPath.includes('.') ? oldPath.slice(oldPath.lastIndexOf('.')) : ''
    let base = newName.trim()
    if (oldExt && !base.toLowerCase().endsWith(oldExt.toLowerCase())) base = `${base.replace(/\.[^.]*$/, '')}${oldExt}`
    const taken = new Set([...textFiles.map((f) => f.path).filter((p) => p !== oldPath), 'main.tex', 'refs.bib'])
    const unique = uniqueName(safeAssetName(base), taken)
    if (unique === oldPath) return
    setTextFiles((prev) => prev.map((f) => (f.path === oldPath ? { ...f, path: unique } : f)))
  }
  /** Inserta un nodo `\input{path}` (IncludeNode) apuntando al `.tex` subido. */
  function insertIncludeFrom(path: string) {
    editor?.chain().focus().insertContent({ type: 'include', attrs: { target: path } }).run()
  }

  /** Descarga una imagen del proyecto (su archivo base64). */
  function downloadImage(assetName: string) {
    const file = imageFiles.find((f) => f.path === assetName)
    if (file) downloadFile(assetName, file.content, 'base64')
  }

  async function onImagePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite re-elegir el mismo archivo
    if (!file || !editor) return
    const name = await addImageAsset(file)
    if (!name) return
    if (pendingFigureAction.current === 'replace' && editor.isActive('figure')) {
      updateActivePart({ kind: 'image', src: name })
    } else if (pendingFigureAction.current === 'addPart' && editor.isActive('figure')) {
      appendFigurePart({ kind: 'image', src: name, width: 0.7 })
    } else {
      insertFigureFrom(name)
    }
  }

  /** Agrega una parte a la figura activa y la deja como parte activa. */
  function appendFigurePart(part: FigureItem) {
    if (!editor) return
    const items = editor.getAttributes('figure').items
    if (!Array.isArray(items)) return
    editor.chain().updateAttributes('figure', { items: [...items, part] }).run()
    setActivePart(items.length) // la nueva parte queda seleccionada
  }
  /** Quita la parte activa (si hay ≥2). */
  function removeActivePart() {
    if (!editor) return
    const items = editor.getAttributes('figure').items
    if (!Array.isArray(items) || items.length <= 1) return
    const idx = activeIdxNow(items)
    editor.chain().updateAttributes('figure', { items: items.filter((_: unknown, j: number) => j !== idx) }).run()
    setActivePart((p) => Math.max(0, Math.min(p, items.length - 2)))
  }
  /** Reordena la parte activa una posición (`dir` = −1 izquierda / +1 derecha). */
  function moveActivePart(dir: -1 | 1) {
    if (!editor) return
    const items = editor.getAttributes('figure').items
    if (!Array.isArray(items)) return
    const idx = activeIdxNow(items)
    const to = idx + dir
    if (to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    editor.chain().updateAttributes('figure', { items: next }).run()
    setActivePart(to)
  }
  function addPlotPart() {
    appendFigurePart({ kind: 'plot', spec: { functions: [{ expr: 'x^2' }], domain: [-5, 5], grid: true } })
  }
  function addImagePart() {
    pendingFigureAction.current = 'addPart'
    fileInputRef.current?.click()
  }

  /**
   * Borra una imagen del proyecto. Si alguna figura la usa, **también elimina esas
   * figuras** (una figura sin su imagen no tiene sentido y rompería el PDF con un
   * `\includegraphics` a un archivo inexistente). Confirma antes.
   */
  function deleteImage(assetName: string) {
    const used = usedFigureSrcs(ast.content).has(assetName)
    if (used && !window.confirm(`«${assetName}» la usa una figura. Al borrarla se eliminará también esa figura. ¿Continuar?`)) {
      return
    }
    if (used && editor) {
      // Borramos los nodos figura que la referencian (de atrás para adelante, para no
      // invalidar las posiciones a medida que borramos).
      const positions: number[] = []
      editor.state.doc.descendants((node, pos) => {
        const items = node.attrs.items as FigureItem[] | undefined
        if (node.type.name === 'figure' && Array.isArray(items) && items.some((it) => it.kind === 'image' && it.src === assetName)) {
          positions.push(pos)
        }
        return true
      })
      if (positions.length > 0) {
        const tr = editor.state.tr
        for (const pos of positions.reverse()) {
          const node = editor.state.doc.nodeAt(pos)
          if (node) tr.delete(pos, pos + node.nodeSize)
        }
        editor.view.dispatch(tr)
      }
    }
    setImageFiles((prev) => prev.filter((f) => f.path !== assetName))
  }

  /** Renombra una imagen: sanea el nombre (conserva la extensión), lo hace único y
   *  **actualiza el `src` de las figuras que la usan** (en el doc del editor). */
  function renameImage(oldName: string, newName: string) {
    const oldExt = oldName.includes('.') ? oldName.slice(oldName.lastIndexOf('.')) : ''
    let base = newName.trim()
    if (oldExt && !base.toLowerCase().endsWith(oldExt.toLowerCase())) base = `${base.replace(/\.[^.]*$/, '')}${oldExt}`
    const unique = uniqueName(safeAssetName(base), new Set(Object.keys(assetsRef.current).filter((k) => k !== oldName)))
    if (unique === oldName) return
    // Reapunta las figuras que usan la imagen vieja.
    if (editor) {
      const tr = editor.state.tr
      let changed = false
      editor.state.doc.descendants((node, pos) => {
        const items = node.attrs.items as FigureItem[] | undefined
        if (node.type.name === 'figure' && Array.isArray(items) && items.some((it) => it.kind === 'image' && it.src === oldName)) {
          tr.setNodeAttribute(pos, 'items', items.map((it) => (it.kind === 'image' && it.src === oldName ? { ...it, src: unique } : it)))
          changed = true
        }
        return true
      })
      if (changed) editor.view.dispatch(tr)
    }
    // Renombra el asset (ref síncrono + estado).
    const dataUrl = assetsRef.current[oldName]
    if (dataUrl) {
      const { [oldName]: _drop, ...rest } = assetsRef.current
      assetsRef.current = { ...rest, [unique]: dataUrl }
    }
    setImageFiles((prev) => prev.map((f) => (f.path === oldName ? { ...f, path: unique } : f)))
  }

  function patchMeta(patch: Partial<DocMeta>) {
    setAst((prev) => ({ ...prev, meta: { ...(prev.meta ?? {}), ...patch } }))
  }
  /**
   * Estructura + portada-en-página-propia (ME-15, resimplificado por LE-02). Antes esto armaba
   * una línea `\documentclass` y otra función la volvía a parsear con regex para poder mostrar
   * el selector; ahora guarda los dos campos semánticos y listo — la clase la deriva el backend.
   */
  function applyDocClass(kind: DocKind, titlePage: boolean) {
    patchMeta({ docKind: kind === 'article' ? undefined : kind, titlePage: titlePage || undefined })
  }

  /** Alinea **toda la columna actual** (attr `align` en cada celda → se ve en el editor). */
  function setColumnAlign(align: TableAlign) {
    if (!editor) return
    try {
      const rect = selectedRect(editor.state)
      const positions = rect.map.cellsInRect({ left: rect.left, right: rect.left + 1, top: 0, bottom: rect.map.height })
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          for (const pos of positions) tr.setNodeAttribute(rect.tableStart + pos, 'align', align)
          return true
        })
        .run()
    } catch {
      // No estamos dentro de una tabla.
    }
  }

  /**
   * Propaga la alineación **por columna** a todas las celdas de esa columna (la del modelo es
   * per-columna, ver `columnAlign` en mapping). Se llama tras agregar fila/columna para que las
   * celdas nuevas —que nacen en `left`— hereden la alineación de su columna (raíz del bug).
   */
  function applyColumnAligns() {
    if (!editor) return
    try {
      const rect = selectedRect(editor.state)
      editor
        .chain()
        .command(({ tr }) => {
          for (let col = 0; col < rect.map.width; col += 1) {
            const positions = rect.map.cellsInRect({ left: col, right: col + 1, top: 0, bottom: rect.map.height })
            // Alineación de la columna = primera celda con align ≠ left (igual criterio que el mapping).
            let colAlign: TableAlign | null = null
            for (const pos of positions) {
              const a = rect.table.nodeAt(pos)?.attrs?.align
              if (a === 'center' || a === 'right') {
                colAlign = a
                break
              }
            }
            for (const pos of positions) tr.setNodeAttribute(rect.tableStart + pos, 'align', colAlign)
          }
          return true
        })
        .run()
    } catch {
      // No estamos dentro de una tabla.
    }
  }
  /** Agrega fila/columna y **hereda** la alineación de columna en las celdas nuevas. */
  function addTableRow() {
    editor?.chain().focus().addRowAfter().run()
    applyColumnAligns()
  }
  function addTableColumn() {
    editor?.chain().focus().addColumnAfter().run()
    applyColumnAligns()
  }

  function toggleTableRules() {
    if (!editor) return
    const none = editor.getAttributes('table').rules === 'none'
    editor.chain().focus().updateAttributes('table', { rules: none ? null : 'none' }).run()
  }

  function setMathAligned(aligned: boolean) {
    // `aligned` es la única decisión de disposición (alinear en `&` vs centrar); el
    // entorno LaTeX lo deriva el compilador. No toca las filas → nunca pierde contenido.
    editor?.chain().updateAttributes('mathDisplay', { aligned }).run()
  }

  // Estado de la tabla activa (para la barra contextual). Se recalcula por render;
  // `bumpSelection` (onSelectionUpdate) garantiza que refleje la selección actual.
  const inTable = editor?.isActive('table') ?? false
  const tableAttrs = inTable && editor ? editor.getAttributes('table') : {}
  const cellAlign =
    inTable && editor
      ? String(editor.getAttributes('tableCell').align ?? editor.getAttributes('tableHeader').align ?? 'left')
      : 'left'
  const inTheorem = editor?.isActive('theorem') ?? false
  const theoremAttrs = inTheorem && editor ? editor.getAttributes('theorem') : {}
  const theoremIsProof = theoremAttrs.variant === 'proof'
  const inCallout = editor?.isActive('callout') ?? false
  const calloutAttrs = inCallout && editor ? editor.getAttributes('callout') : {}
  const inHeading = editor?.isActive('heading') ?? false
  const headingAttrs = inHeading && editor ? editor.getAttributes('heading') : {}
  const inMathInline = editor?.isActive('mathInline') ?? false
  const inCodeBlock = editor?.isActive('codeBlock') ?? false
  const codeBlockAttrs = inCodeBlock && editor ? editor.getAttributes('codeBlock') : {}
  const inMathDisplay = editor?.isActive('mathDisplay') ?? false
  const inDerivation = editor?.isActive('derivation') ?? false
  const inReasoning = editor?.isActive('reasoning') ?? false
  const reasoningTitle = inReasoning && editor ? String(editor.getAttributes('reasoning').title ?? '') : ''
  const reasoningRowBoxed = inReasoning && editor ? editor.getAttributes('reasoningRow').boxed === true : false
  // Editar una fórmula tiene prioridad sobre el contenedor: si hay un nodo math activo, los
  // contenedores (tabla/teorema/caja/título) **ceden** la barra para mostrar la paleta de símbolos.
  const inMathActive = inMathInline || inMathDisplay
  const mathDisplayAttrs = inMathDisplay && editor ? editor.getAttributes('mathDisplay') : {}
  const mathAligned = mathDisplayAttrs.aligned !== false // default true
  const mathRowCount = Array.isArray(mathDisplayAttrs.rows) ? mathDisplayAttrs.rows.length : 1
  const inFigure = editor?.isActive('figure') ?? false
  const figureAttrs = inFigure && editor ? editor.getAttributes('figure') : {}
  const figureItems = (Array.isArray(figureAttrs.items) ? figureAttrs.items : []) as FigureItem[]
  const activeIdx = figureItems.length ? Math.min(Math.max(activePart, 0), figureItems.length - 1) : 0
  const figureItemActive = figureItems[activeIdx]
  const figureWidth = typeof figureItemActive?.width === 'number' ? figureItemActive.width : 1
  // ¿La parte activa tiene inspector (gráfico de funciones o de datos)? La imagen no.
  const partHasInspector = figureItemActive?.kind === 'plot' || figureItemActive?.kind === 'chart' || figureItemActive?.kind === 'distribution' || figureItemActive?.kind === 'diagram' || figureItemActive?.kind === 'tree'

  function setFigureWidth(width: number) {
    updateActivePart({ width })
  }

  // ── Qué se puede insertar: UNA lista para el menú Insertar y para el menú «/» ─────────────
  const insertItems: InsertItem[] = editor
    ? [
        { id: 'math-inline', group: 'Matemática', glyph: 'x²', label: 'Fórmula en línea', description: 'Dentro del párrafo', hint: '$$', keywords: 'ecuacion math inline', run: () => insertAtom('mathInline') },
        { id: 'math-display', group: 'Matemática', glyph: '∑', label: 'Fórmula en bloque', description: 'Centrada, en su propio renglón', keywords: 'ecuacion display', run: () => insertAtom('mathDisplay') },
        { id: 'derivation', group: 'Matemática', glyph: '≡', label: 'Derivación', description: 'Ecuaciones alineadas y numerables', keywords: 'align alineadas ecuaciones', run: insertDerivation },
        { id: 'reasoning', group: 'Matemática', glyph: '⇒', label: 'Razonamiento', description: 'Cada paso con su justificación', keywords: 'dos columnas pasos', run: insertReasoning },
        { id: 'theorem', group: 'Bloques', glyph: 'T', label: 'Teorema', description: 'Enunciado numerado (o lema, corolario…)', keywords: 'lema proposicion corolario', run: () => insertTheorem('theorem') },
        { id: 'definition', group: 'Bloques', glyph: 'D', label: 'Definición', description: 'Un concepto, numerado', run: () => insertTheorem('definition') },
        { id: 'proof', group: 'Bloques', glyph: '∎', label: 'Demostración', description: 'Termina con ∎', keywords: 'prueba', run: () => insertTheorem('proof') },
        { id: 'callout', group: 'Bloques', glyph: '!', label: 'Caja / Nota', description: 'Nota, consejo, cuidado o importante', keywords: 'callout aviso consejo', run: () => insertCallout('note') },
        { id: 'table', group: 'Bloques', glyph: '▦', label: 'Tabla', description: 'Filas y columnas con encabezado', run: () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
        { id: 'code', group: 'Bloques', glyph: '</>', label: 'Bloque de código', description: 'Código con su lenguaje', keywords: 'codigo programa', run: insertCodeBlock },
        { id: 'plot', group: 'Figuras', glyph: '∿', label: 'Gráfico de funciones', description: 'Curvas, parámetros, áreas', keywords: 'grafico funcion plot curva', run: insertPlot },
        { id: 'bar', group: 'Figuras', glyph: '▮', label: 'Barras', description: 'Comparar categorías', keywords: 'grafico chart', run: () => insertChart('bar') },
        { id: 'pie', group: 'Figuras', glyph: '◔', label: 'Torta', description: 'Repartir un total', keywords: 'grafico chart', run: () => insertChart('pie') },
        { id: 'histogram', group: 'Figuras', glyph: '▃', label: 'Histograma', description: 'Ver una distribución', keywords: 'grafico estadistica', run: () => insertDist('histogram') },
        { id: 'boxplot', group: 'Figuras', glyph: '⊟', label: 'Boxplot', description: 'La dispersión de los datos', keywords: 'caja bigotes estadistica', run: () => insertDist('boxplot') },
        { id: 'diagram', group: 'Figuras', glyph: '⇄', label: 'Diagrama conmutativo', description: 'Objetos y flechas', keywords: 'flechas morfismos', run: insertDiagram },
        { id: 'tree', group: 'Figuras', glyph: '⋔', label: 'Árbol', description: 'Una jerarquía', keywords: 'jerarquia', run: insertTree },
        { id: 'image', group: 'Figuras', glyph: '▣', label: 'Imagen', description: 'Una imagen tuya', keywords: 'foto figura', run: insertFigure },
        { id: 'ref', group: 'Referencias', glyph: '↗', label: 'Referencia cruzada', description: 'Nombrar un teorema, ecuación o figura', hint: '@', keywords: 'cref', run: () => insertAtom('ref') },
        { id: 'cite', group: 'Referencias', glyph: '❝', label: 'Cita', description: 'Una obra de la bibliografía', hint: '#', keywords: 'bibliografia', run: () => insertAtom('cite') },
        { id: 'footnote', group: 'Referencias', glyph: '¹', label: 'Nota al pie', description: 'Un comentario al pie de la página', run: () => insertAtom('footnote') },
        ...(meta.docKind === 'report' || meta.docKind === 'book'
          ? [{ id: 'part', group: 'Estructura' as const, glyph: 'Ⅰ', label: 'Parte', description: 'Agrupa capítulos', run: insertPart }]
          : []),
        // Los bloques de cada familia aparecen solo en su familia (en otra no tienen salida).
        ...(documentFamily(meta) === 'exam'
          ? [{ id: 'exam-question', group: 'Estructura' as const, glyph: '?', label: 'Pregunta', description: 'Enunciado, puntaje y solución', keywords: 'examen ejercicio parcial', run: insertExamQuestion }]
          : []),
        ...(documentFamily(meta) === 'cv'
          ? [{ id: 'cv-entry', group: 'Estructura' as const, glyph: '◷', label: 'Entrada de CV', description: 'Período, rol, institución', keywords: 'curriculum trayectoria experiencia', run: insertCvEntry }]
          : []),
        ...(documentFamily(meta) === 'poster'
          ? [{ id: 'poster-block', group: 'Estructura' as const, glyph: '▣', label: 'Bloque de póster', description: 'Un recuadro con título', keywords: 'poster recuadro', run: insertPosterBlock }]
          : []),
        { id: 'slide', group: 'Estructura', glyph: '▭', label: 'Diapositiva', description: 'Para presentaciones', keywords: 'presentacion beamer', run: insertSlide },
        { id: 'columns', group: 'Estructura', glyph: '▥', label: 'Columnas', description: 'Contenido lado a lado', run: insertColumns },
        { id: 'include', group: 'Avanzado', glyph: '⤓', label: 'Incluir archivo', description: 'Un .tex del proyecto', keywords: 'input tex', run: () => insertAtom('include') },
        { id: 'raw', group: 'Avanzado', glyph: '\\', label: 'LaTeX crudo', description: 'Un fragmento escrito a mano', keywords: 'latex', run: () => insertAtom('rawLatex') },
      ]
    : []

  const slashItems = slash ? filterInsertItems(insertItems, slash.query) : []

  function pickSlashItem(item: InsertItem) {
    if (!editor || !slash) return
    // Primero se borra el «/búsqueda» que se tipeó; después se inserta donde quedó el cursor.
    editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run()
    setSlash(null)
    item.run()
  }

  slashKeyRef.current = (event) => {
    if (!slash) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const count = Math.max(slashItems.length, 1)
      setSlashActive((index) => (index + (event.key === 'ArrowDown' ? 1 : count - 1)) % count)
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const item = slashItems[Math.min(slashActive, slashItems.length - 1)]
      if (!item) return false
      pickSlashItem(item)
      return true
    }
    if (event.key === 'Escape') {
      slashDismissedAt.current = slash.from
      setSlash(null)
      return true
    }
    return false
  }

  return (
    <div className="flex h-full flex-col">
      {/* Selector de imagen oculto (figuras): insertar o reemplazar según la acción. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMG_ACCEPT}
        onChange={onImagePicked}
        aria-label="Subir imagen para una figura"
        className="hidden"
      />
      <HeaderSlotContent>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            title="Volver a Mis Proyectos"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft width={14} height={14} /> Mis Proyectos
          </button>
          <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
            <Pencil width={13} height={13} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              aria-label="Nombre del documento"
              className="w-40 rounded bg-transparent px-1 py-0.5 text-sm text-(--color-ink) outline-none hover:bg-(--color-surface-muted) focus:bg-(--color-surface-muted)"
            />
          </label>
          <Sep />
          {editor && (
            <>
              <ToolbarPopover label="Formato">
                <div className="flex items-center gap-1">
                  <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><strong>B</strong></Btn>
                  <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><em>I</em></Btn>
                  <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}><span className="font-mono">{'</>'}</span></Btn>
                  <Sep />
                  <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>H1</Btn>
                  <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</Btn>
                  <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>•</Btn>
                  <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1.</Btn>
                </div>
              </ToolbarPopover>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-ink-muted) outline-none hover:bg-(--color-surface-muted) hover:text-(--color-ink) data-[state=open]:bg-(--color-surface-muted)">
                  Insertar <ChevronDown width={12} height={12} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 max-h-[80vh] w-60 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
                  >
                    {INSERT_GROUPS.map((group, groupIndex) => {
                      const items = insertItems.filter((item) => item.group === group)
                      if (items.length === 0) return null
                      return (
                        <div key={group}>
                          {groupIndex > 0 && <DropdownMenu.Separator className="my-1 h-px bg-(--color-border)" />}
                          {group === 'Figuras' ? (
                            // Una figura se elige por intención (con ≥2 partes = subfiguras).
                            <DropdownMenu.Sub>
                              <DropdownMenu.SubTrigger className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-(--color-ink) outline-none data-[highlighted]:bg-(--color-surface-muted) data-[state=open]:bg-(--color-surface-muted)">
                                <InsLabel glyph="◔">Figura o gráfico</InsLabel>
                                <ChevronRight width={12} height={12} />
                              </DropdownMenu.SubTrigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.SubContent
                                  sideOffset={2}
                                  className="z-50 w-60 rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
                                >
                                  <div className="px-2 pt-1 pb-1.5 text-[11px] text-(--color-ink-muted)">¿Qué querés mostrar?</div>
                                  {items.map((item) => (
                                    <InsItem key={item.id} onRun={item.run}>
                                      <InsLabel glyph={item.glyph} hint={item.hint}>{item.label}</InsLabel>
                                    </InsItem>
                                  ))}
                                </DropdownMenu.SubContent>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Sub>
                          ) : (
                            items.map((item) => (
                              <InsItem key={item.id} onRun={item.run}>
                                <InsLabel glyph={item.glyph} hint={item.hint}>{item.label}</InsLabel>
                              </InsItem>
                            ))
                          )}
                        </div>
                      )
                    })}
                    <div className="mt-1 border-t border-(--color-border) px-2 pt-1.5 pb-0.5 text-[11px] text-(--color-ink-muted)">
                      Atajo: escribí <kbd className="rounded border border-(--color-border) px-1 font-mono">/</kbd> en el texto
                    </div>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <button
                type="button"
                onClick={() => setPortadaOpen(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-ink-muted) outline-none hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
              >
                Portada
              </button>
              <button
                type="button"
                onClick={() => setDocCfgOpen(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-ink-muted) outline-none hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
              >
                Documento
              </button>
              <button
                type="button"
                onClick={() => setBibOpen(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-(--color-ink-muted) outline-none hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
              >
                Bibliografía
              </button>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Estado + Compilar en el header: siempre visible (también en Foco) y única
              fuente de verdad, consistente con el workspace de proyectos LaTeX. */}
          <CompileStatus
            compiling={compiling}
            stale={outputStale}
            compiled={compiled}
            onCompile={() => void handleCompile()}
          />
          <DownloadControl
            pdf={pdf}
            downloadName={name || 'documento'}
            onPdf={requestPdfDownload}
            pdfEnabled
            pdfNote={outputStale ? 'recompila y baja' : !compiled ? 'compila y baja' : undefined}
            extra={[
              ...(isExam
                ? [
                    { label: 'PDF con soluciones', onClick: downloadSolutionsPdf },
                    { label: 'Página web con soluciones', onClick: () => dl.downloadHtml(name, ast, dataUrls, true) },
                  ]
                : []),
              { label: 'Página web (.html)', onClick: downloadHtml },
              { label: 'Proyecto Matex (.zip)', onClick: () => void downloadBundle() },
              { label: 'Matex — solo AST (.mtex)', onClick: downloadAst },
              { label: imageFiles.length > 0 ? 'LaTeX (.zip)' : 'LaTeX (.tex)', onClick: () => void downloadTex() },
            ]}
          />
        </div>
      </HeaderSlotContent>

      {/* Barra contextual de **altura fija** (siempre presente): su contenido cambia
          según dónde esté el cursor, pero la altura no → el lienzo no salta. */}
      <div className="matex-context-bar flex h-9 shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-(--color-border) bg-(--color-surface-muted) px-4 text-xs [&>*]:shrink-0">
        {inTable && editor && !inMathActive ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Tabla</span>
            <Btn onClick={addTableRow}>+Fila</Btn>
            <Btn onClick={() => editor.chain().focus().deleteRow().run()}>−Fila</Btn>
            <Btn onClick={addTableColumn}>+Col</Btn>
            <Btn onClick={() => editor.chain().focus().deleteColumn().run()}>−Col</Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Encabezado</Btn>
            <Sep />
            <span className="text-(--color-ink-muted)">Columna:</span>
            <Btn onClick={() => setColumnAlign('left')} active={cellAlign === 'left'}>Izq</Btn>
            <Btn onClick={() => setColumnAlign('center')} active={cellAlign === 'center'}>Centro</Btn>
            <Btn onClick={() => setColumnAlign('right')} active={cellAlign === 'right'}>Der</Btn>
            <Sep />
            <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
              Caption
              <input
                value={String(tableAttrs.caption ?? '')}
                onChange={(e) => editor.chain().updateAttributes('table', { caption: e.target.value || null }).run()}
                placeholder="(sin caption)"
                aria-label="Caption de la tabla"
                className="w-40 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-(--color-ink-muted)">
              Label
              <input
                value={String(tableAttrs.label ?? '')}
                onChange={(e) => editor.chain().updateAttributes('table', { label: e.target.value || null }).run()}
                placeholder="tab:…"
                aria-label="Etiqueta de la tabla"
                className="w-24 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <Btn onClick={toggleTableRules} active={tableAttrs.rules === 'none'}>Sin reglas</Btn>
            <Sep />
            <Btn onClick={() => editor.chain().focus().deleteTable().run()}>Borrar</Btn>
          </>
        ) : inTheorem && editor && !inMathActive ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">{theoremIsProof ? 'Demostración' : 'Entorno'}</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Cambiar el tipo (teorema/lema/…/demostración).">
              Tipo
              <select
                value={String(theoremAttrs.variant ?? 'theorem')}
                onChange={(e) => editor.chain().updateAttributes('theorem', { variant: e.target.value }).run()}
                aria-label="Tipo de entorno"
                className="rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              >
                <option value="theorem">Teorema</option>
                <option value="lemma">Lema</option>
                <option value="proposition">Proposición</option>
                <option value="corollary">Corolario</option>
                <option value="definition">Definición</option>
                <option value="example">Ejemplo</option>
                <option value="remark">Observación</option>
                <option value="proof">Demostración</option>
              </select>
            </label>
            {theoremIsProof ? (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                Demuestra (\cref)
                <input
                  value={String(theoremAttrs.proves ?? '')}
                  onChange={(e) => editor.chain().updateAttributes('theorem', { proves: e.target.value || null }).run()}
                  placeholder="thm:… (proof diferido)"
                  aria-label="Teorema que demuestra"
                  className="w-44 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
              </label>
            ) : (
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
                Título
                <input
                  value={String(theoremAttrs.title ?? '')}
                  onChange={(e) => editor.chain().updateAttributes('theorem', { title: e.target.value || null }).run()}
                  placeholder="(opcional, p. ej. de Bolzano)"
                  aria-label="Título del entorno"
                  className="w-52 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              Etiqueta
              <input
                value={String(theoremAttrs.label ?? '')}
                onChange={(e) => editor.chain().updateAttributes('theorem', { label: e.target.value || null }).run()}
                placeholder="thm:…"
                aria-label="Etiqueta del entorno"
                className="w-28 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
          </>
        ) : inCallout && editor && !inMathActive ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Caja</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Tipo de caja (color e intención).">
              Tipo
              <select
                value={String(calloutAttrs.variant ?? 'note')}
                onChange={(e) => editor.chain().updateAttributes('callout', { variant: e.target.value }).run()}
                aria-label="Tipo de caja"
                className="rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              >
                <option value="note">📝 Nota</option>
                <option value="tip">💡 Consejo</option>
                <option value="warning">⚠️ Cuidado</option>
                <option value="important">❗ Importante</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              Título
              <input
                value={String(calloutAttrs.title ?? '')}
                onChange={(e) => editor.chain().updateAttributes('callout', { title: e.target.value || null }).run()}
                placeholder="(opcional; si no, el tipo)"
                aria-label="Título de la caja"
                className="w-48 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
          </>
        ) : inHeading && editor && !inMathActive ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Título</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
              Etiqueta
              <input
                value={String(headingAttrs.label ?? '')}
                onChange={(e) => editor.chain().updateAttributes('heading', { label: e.target.value || null }).run()}
                placeholder="sec:…"
                aria-label="Etiqueta del título"
                className="w-40 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <span className="text-(--color-ink-muted)">para referenciarlo con \cref</span>
          </>
        ) : inMathInline && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Fórmula</span>
            <MathPaletteControl />
            <span className="text-(--color-ink-muted)">Insertá símbolos y plantillas típicas.</span>
          </>
        ) : inCodeBlock && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Código</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Lenguaje para el resaltado (opcional; p. ej. Python, C, bash).">
              Lenguaje
              <input
                value={String(codeBlockAttrs.language ?? '')}
                onChange={(e) => editor.chain().updateAttributes('codeBlock', { language: e.target.value || null }).run()}
                placeholder="(ninguno)"
                aria-label="Lenguaje del bloque de código"
                className="w-32 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <span className="text-(--color-ink-muted)">Escribí el código; se compila con listings.</span>
          </>
        ) : inMathDisplay && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Ecuación</span>
            <label
              className="inline-flex items-center gap-1.5 text-(--color-ink-muted)"
              title="Alinea las filas en el & (p. ej. poné a &= b para alinear en el =). Con una sola fila no tiene efecto. Destildado: cada fila se centra."
            >
              <input type="checkbox" checked={mathAligned} onChange={(e) => setMathAligned(e.target.checked)} />
              Alinear en&nbsp;<code className="rounded bg-(--color-surface-muted) px-1">&amp;</code>
            </label>
            <Sep />
            <MathPaletteControl />
            <CasesBuilder />
            <Sep />
            <span className="text-(--color-ink-muted)">
              {mathRowCount > 1
                ? 'Hacé clic en la fórmula para editar cada fila, numerarla (Nº) o agregar filas.'
                : 'Hacé clic en la fórmula para editarla, numerarla (Nº) o agregar más filas.'}
            </span>
          </>
        ) : inDerivation && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Derivación</span>
            <MathPaletteControl />
            <span className="text-(--color-ink-muted)">Un paso por renglón (matemática + justificación). Usá <code className="rounded bg-(--color-surface-muted) px-1">&amp;</code> para alinear en el =, y ▭ para recuadrar.</span>
          </>
        ) : inFigure && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Figura</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Epígrafe (necesario para numerarla y referenciarla).">
              Epígrafe
              <input
                value={String(figureAttrs.caption ?? '')}
                onChange={(e) => editor.chain().updateAttributes('figure', { caption: e.target.value || null }).run()}
                placeholder="Descripción…"
                aria-label="Epígrafe de la figura"
                className="w-48 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            {partHasInspector && <span className="text-(--color-ink-muted)">· editá en el inspector (derecha) ·</span>}
            <Sep />
            <span className="text-(--color-ink-muted)">Tamaño</span>
            <Btn active={Math.abs(figureWidth - 0.4) < 0.01} title="40% del ancho de texto" onClick={() => setFigureWidth(0.4)}>
              Chica
            </Btn>
            <Btn active={Math.abs(figureWidth - 0.7) < 0.01} title="70% del ancho de texto" onClick={() => setFigureWidth(0.7)}>
              Mediana
            </Btn>
            <Btn active={Math.abs(figureWidth - 1) < 0.01} title="Ancho de texto completo" onClick={() => setFigureWidth(1)}>
              Grande
            </Btn>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={Number(figureWidth.toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v > 0) setFigureWidth(Math.min(1, Math.max(0.1, v)))
              }}
              title="Fracción del ancho de texto (0.1–1)"
              aria-label="Fracción del ancho de texto"
              className="w-16 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
            <Sep />
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Etiqueta para referenciarla con \cref (opcional; si no, se genera sola).">
              Etiqueta
              <input
                value={String(figureAttrs.label ?? '')}
                onChange={(e) => editor.chain().updateAttributes('figure', { label: e.target.value || null }).run()}
                placeholder="fig:…"
                aria-label="Etiqueta de la figura"
                className="w-32 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <span className="text-(--color-ink-muted)">· gestioná las partes abajo ·</span>
          </>
        ) : inReasoning && editor ? (
          <>
            <span className="mr-1 font-medium text-(--color-ink)">Razonamiento</span>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Título del razonamiento (opcional).">
              Título
              <input
                value={reasoningTitle}
                onChange={(e) => setReasoningTitle(e.target.value)}
                placeholder="(opcional)"
                aria-label="Título del razonamiento"
                className="w-40 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
            </label>
            <Sep />
            <Btn onClick={addReasoningRow}>+ fila</Btn>
            <Btn onClick={removeReasoningRow}>− fila</Btn>
            <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Recuadrar esta fila (destacar un resultado).">
              <input type="checkbox" checked={reasoningRowBoxed} onChange={toggleReasoningBoxed} />
              recuadrar fila
            </label>
            <Sep />
            <span className="text-(--color-ink-muted)">Escribí libre en cada celda; insertá fórmulas, tablas o figuras con «Insertar».</span>
          </>
        ) : (
          <span className="text-(--color-ink-muted)">
            Poné el cursor en un título, una tabla, un entorno o una ecuación en bloque para ver sus controles.
          </span>
        )}
      </div>

      {/* Panel de **partes** de la figura (subfiguras): envuelve en varias filas (no scroll). */}
      {inFigure && editor && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--color-border) bg-(--color-surface-muted) px-4 py-2 text-xs">
          <span className="font-medium text-(--color-ink)" title="Partes de la figura (con ≥2 se compilan como subfiguras a/b/…).">Partes</span>
          <div className="flex flex-wrap items-center gap-1">
            {figureItems.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActivePart(i)}
                title={`${it.kind === 'plot' ? 'Gráfico de funciones' : it.kind === 'chart' ? (it.spec.form === 'pie' ? 'Torta' : 'Barras') : it.kind === 'distribution' ? (it.spec.form === 'boxplot' ? 'Boxplot' : 'Histograma') : it.kind === 'diagram' ? 'Diagrama conmutativo' : it.kind === 'tree' ? 'Árbol' : 'Imagen'}${figureItems.length > 1 ? ` (${String.fromCharCode(97 + i)})` : ''} — parte activa`}
                className={[
                  'inline-flex items-center gap-1 rounded border px-2 py-1',
                  i === activeIdx
                    ? 'border-(--color-primary) bg-(--color-primary) text-(--color-primary-ink)'
                    : 'border-(--color-border) text-(--color-ink-muted) hover:bg-(--color-surface)',
                ].join(' ')}
              >
                <span>{it.kind === 'plot' ? '∿' : it.kind === 'chart' ? (it.spec.form === 'pie' ? '◔' : '▤') : it.kind === 'distribution' ? (it.spec.form === 'boxplot' ? '⊟' : '▥') : it.kind === 'diagram' ? '⇄' : it.kind === 'tree' ? '⌸' : '▦'}</span>
                {figureItems.length > 1 && <span>{String.fromCharCode(97 + i)}</span>}
              </button>
            ))}
            <Btn onClick={addPlotPart} title="Agregar un gráfico de funciones como nueva parte">+ funciones</Btn>
            <Btn onClick={() => addChartPart('bar')} title="Agregar un gráfico de barras como nueva parte">+ barras</Btn>
            <Btn onClick={() => addChartPart('pie')} title="Agregar una torta como nueva parte">+ torta</Btn>
            <Btn onClick={() => addDistPart('histogram')} title="Agregar un histograma como nueva parte">+ histograma</Btn>
            <Btn onClick={() => addDistPart('boxplot')} title="Agregar un boxplot como nueva parte">+ boxplot</Btn>
            <Btn onClick={addDiagramPart} title="Agregar un diagrama conmutativo como nueva parte">+ diagrama</Btn>
            <Btn onClick={addTreePart} title="Agregar un árbol como nueva parte">+ árbol</Btn>
            <Btn onClick={addImagePart} title="Agregar una imagen como nueva parte">+ imagen</Btn>
          </div>
          {figureItems.length > 1 && (
            <>
              <Sep />
              <div className="flex items-center gap-1">
                <span className="text-(--color-ink-muted)">parte ({String.fromCharCode(97 + activeIdx)}):</span>
                <Btn onClick={() => moveActivePart(-1)} title="Mover la parte a la izquierda">←</Btn>
                <Btn onClick={() => moveActivePart(1)} title="Mover la parte a la derecha">→</Btn>
                <Btn onClick={removeActivePart} title="Quitar la parte activa">✕</Btn>
              </div>
              <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)" title="Subepígrafe de esta parte (aparece como (a), (b)…).">
                Subepígrafe
                <input
                  value={String(figureItemActive?.subcaption ?? '')}
                  onChange={(e) => updateActivePart({ subcaption: e.target.value || undefined })}
                  placeholder={`(${String.fromCharCode(97 + activeIdx)})`}
                  aria-label="Subepígrafe de la parte"
                  className="w-44 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
              </label>
            </>
          )}
          {figureItemActive?.kind === 'image' && (
            <Btn onClick={replaceFigureImage} title="Elegir otra imagen para esta parte">
              Reemplazar imagen
            </Btn>
          )}
        </div>
      )}


      <div className="flex min-h-0 flex-1">
        {/* Riel para reabrir el panel colapsado (mismo patrón que los proyectos LaTeX). */}
        {filesCollapsed && (
          <button
            type="button"
            onClick={toggleFiles}
            aria-label="Mostrar archivos"
            title="Mostrar archivos"
            className="flex w-7 shrink-0 justify-center border-r border-(--color-border) bg-(--color-surface) pt-3 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <PanelLeft />
          </button>
        )}
        <PanelGroup key={direction} direction={direction} autoSaveId={`matex-visual-${direction}`} className="min-h-0 flex-1">
        <Panel
          ref={filesPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={20}
          minSize={15}
          onCollapse={() => setFilesCollapsed(true)}
          onExpand={() => setFilesCollapsed(false)}
          className="min-h-0 overflow-auto bg-(--color-surface)"
        >
          <MatexFiles
            docName={(name || 'documento').trim()}
            images={imageFiles}
            textFiles={textFiles}
            usedSrcs={usedFigureSrcs(ast.content)}
            onUpload={(files) => void uploadResources(files)}
            onInsertFigure={insertFigureFrom}
            onDeleteImage={deleteImage}
            onDownloadImage={downloadImage}
            onRename={renameImage}
            onInsertInclude={insertIncludeFrom}
            onDeleteText={deleteTextFile}
            onDownloadText={downloadTextFile}
            onRenameText={renameTextFile}
            onDownloadMtex={downloadAst}
            onCollapse={toggleFiles}
          />
        </Panel>
        <ResizeHandle direction={direction} />
        <Panel minSize={25} className="min-h-0 bg-(--color-surface)">
          {/* Lienzo + **inspector** a la derecha (aparece al seleccionar una figura con gráfico):
              editor contextual sin robar ancho al lienzo salvo cuando hace falta. */}
          <div className="flex h-full min-h-0">
            <div className="matex-desk h-full min-w-0 flex-1 overflow-auto">
              {/* La hoja: el documento se escribe sobre una página, con su portada arriba. */}
              {/* La hoja toma el diseño y el acento del documento: se escribe viendo cómo va a salir. */}
              {contentProblem && (
                <div role="alert" className="mx-auto mt-6 max-w-[50rem] rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  <strong>Este documento tiene contenido que el editor visual no reconoce.</strong> Para no perder
                  nada, quedó en solo lectura y no se guardan cambios. La vista previa lo muestra completo, y podés
                  descargarlo como <code>.mtex</code> desde «Descargar».
                  <span className="mt-1 block text-xs opacity-75">Detalle técnico: {contentProblem}</span>
                </div>
              )}
              <div
                className={`matex-sheet matex-sheet--${meta.style ?? 'standard'}`}
                style={{ '--doc-accent': accentHex(meta.accent), '--doc-font-scale': (meta.baseFontSize ?? 11) / 11 } as CSSProperties}
              >
                <CoverHeader meta={meta} onPatch={patchMeta} onEditCover={() => setPortadaOpen(true)} />
                <EditorContent editor={editor} />
              </div>
            </div>
            {slash && (
              <SlashMenu
                items={slashItems}
                query={slash.query}
                active={Math.min(slashActive, Math.max(slashItems.length - 1, 0))}
                anchor={slash.anchor}
                onPick={pickSlashItem}
                onHover={setSlashActive}
              />
            )}
            {inFigure && partHasInspector && figureItemActive && editor && (
              <aside style={{ width: inspectorW }} className="flex h-full shrink-0 border-l border-(--color-border)">
                {/* Handle de redimensión (borde izquierdo del inspector). */}
                <div
                  onMouseDown={startInspectorResize}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Redimensionar el inspector"
                  className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-(--color-primary)"
                />
                <div className="min-w-0 flex-1 overflow-auto">
                  <FigurePartInspector key={activeIdx} item={figureItemActive} onUpdateSpec={updatePartSpec} />
                </div>
              </aside>
            )}
          </div>
        </Panel>
        <ResizeHandle direction={direction} />
        <Panel
          ref={outputPanelRef}
          collapsible
          collapsedSize={0}
          minSize={25}
          onCollapse={() => setOutputCollapsed(true)}
          onExpand={() => setOutputCollapsed(false)}
          className="min-h-0"
        >
          <div className="relative h-full">
            {/* Control flotante de la salida: colapsar + switch de vista. El estado y el botón
                Compilar viven en el header (una sola fuente). */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              {rightView === 'pdf' && outputStale && !compiling && (
                <span className="rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-[11px] text-amber-600 shadow-sm">
                  ● desactualizado
                </span>
              )}
              <div className="flex rounded-md border border-(--color-border) bg-(--color-surface) p-0.5 text-xs shadow-sm">
                <SegBtn active={rightView === 'pdf'} onClick={() => setRightView('pdf')}>PDF</SegBtn>
                <SegBtn active={rightView === 'html'} onClick={() => setRightView('html')}>HTML</SegBtn>
                <SegBtn active={rightView === 'latex'} onClick={() => setRightView('latex')}>LaTeX</SegBtn>
                <SegBtn active={rightView === 'ast'} onClick={() => setRightView('ast')}>AST</SegBtn>
              </div>
              <button
                type="button"
                onClick={toggleOutput}
                aria-label="Colapsar panel de salida"
                title="Colapsar panel"
                className="rounded-md border border-(--color-border) bg-(--color-surface) p-1 text-(--color-ink-muted) shadow-sm hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
              >
                <ChevronRight width={15} height={15} />
              </button>
            </div>
            {rightView === 'ast' ? (
              <LatexEditor value={astJson} onChange={() => {}} readOnly />
            ) : rightView === 'html' ? (
              // 2º backend en vivo: se recompila con cada cambio del AST (no necesita el backend
              // LaTeX). `srcDoc` aísla los estilos del documento; MathML/SVG renderizan nativo.
              // `allow-scripts` para los sliders interactivos (ME-36 B2); el contenido lo generamos
              // nosotros (no es HTML de terceros), así que el combo con same-origin es seguro acá.
              <iframe title="Vista HTML" srcDoc={html} className="h-full w-full border-0 bg-white" sandbox="allow-same-origin allow-scripts" />
            ) : rightView === 'latex' ? (
              <LatexEditor value={latex} onChange={() => {}} readOnly />
            ) : compiling ? (
              <CompilingIndicator label="Compilando" />
            ) : pdf ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-(--color-surface-muted) text-sm text-(--color-ink-muted)">
                    Cargando visor…
                  </div>
                }
              >
                <PdfPreview pdf={pdf} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center bg-(--color-surface-muted) p-6 text-center text-sm text-(--color-ink-muted)">
                Tocá <span className="mx-1 font-medium text-(--color-ink)">Compilar</span> para ver el PDF.
              </div>
            )}
          </div>
        </Panel>
        </PanelGroup>
        {/* Riel para reabrir el panel de salida cuando está colapsado (como el explorador). */}
        {outputCollapsed && (
          <button
            type="button"
            onClick={toggleOutput}
            aria-label="Mostrar salida"
            title="Mostrar salida (PDF / LaTeX / Matex)"
            className="flex w-7 shrink-0 justify-center border-l border-(--color-border) bg-(--color-surface) pt-3 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)"
          >
            <ChevronLeft width={15} height={15} />
          </button>
        )}
      </div>

      <CompileLogBar result={result} />

      {/* Modales document-level (homogéneos): Portada y Bibliografía. */}
      <Modal open={portadaOpen} onClose={() => setPortadaOpen(false)} title="Portada" width="max-w-lg">
        <div className="flex flex-col gap-3 text-xs">
          <MetaInput label="Título" value={meta.title ?? ''} onChange={(v) => patchMeta({ title: v || undefined })} />
          <div className="flex flex-col gap-1">
            <span className="text-(--color-ink-muted)">Autores</span>
            <AuthorsEditor
              authors={meta.authors ?? (meta.author ? [{ name: meta.author }] : [])}
              onChange={(a) => patchMeta({ authors: a.length > 0 ? a : undefined, author: undefined })}
            />
          </div>
          <MetaInput label="Institución" value={meta.institution ?? ''} onChange={(v) => patchMeta({ institution: v || undefined })} />
          <label className="flex flex-col gap-1 text-(--color-ink-muted)">
            Resumen
            <textarea
              value={meta.abstract ?? ''}
              onChange={(e) => patchMeta({ abstract: e.target.value || undefined })}
              rows={4}
              placeholder="Resumen del documento (opcional)"
              className="w-full resize-y rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-1 text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
          </label>
          <MetaInput label="Fecha" value={meta.date ?? ''} onChange={(v) => patchMeta({ date: v || undefined })} />
          <p className="text-(--color-ink-muted)">La clase, los márgenes, el índice y la portada en página propia están en <strong className="text-(--color-ink)">Documento</strong>.</p>
        </div>
      </Modal>

      {/* Configuración estructural del documento (ME-15): consolida clase, márgenes, índice y
          portada-en-página-propia, antes repartidos entre Portada y el modelo (AST). */}
      <Modal open={docCfgOpen} onClose={() => setDocCfgOpen(false)} title="Documento" width="max-w-2xl">
        <DocumentSettings
          meta={meta}
          onPatch={patchMeta}
          onApplyDocClass={applyDocClass}
          preview={<MiniSheet outline={docOutline(ast, name || 'Documento')} />}
        />
      </Modal>

      <Modal open={bibOpen} onClose={() => setBibOpen(false)} title="Bibliografía" width="max-w-2xl">
        <BibliographyEditor
          entries={ast.references ?? []}
          onEntries={updateReferences}
          style={meta.bibStyle ?? 'numeric'}
          onStyle={(s) => patchMeta({ bibStyle: s })}
          title={meta.bibTitle ?? ''}
          onTitle={(t) => patchMeta({ bibTitle: t || undefined })}
        />
      </Modal>
    </div>
  )
}

/**
 * Popover de toolbar propio (no Radix): un disparador + un panel flotante que cierra al
 * click-afuera. Se usa para "Formato" y "Portada" — los controles de adentro conservan
 * su comportamiento exacto (Radix DropdownMenu intercepta el teclado, malo para inputs).
 */
function ToolbarPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex items-center gap-1 rounded px-2 py-1 text-xs outline-none',
          open
            ? 'bg-(--color-surface-muted) text-(--color-ink)'
            : 'text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)',
        ].join(' ')}
      >
        {label} <ChevronDown width={12} height={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-2 shadow-xl">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Control **"Símbolos ▾"** de la barra contextual: abre la paleta de fórmulas (asistente)
 * en un panel **`position: fixed`** (escapa al `overflow` de la barra). Inserta en la
 * fórmula que está abierta en su popover vía el puente `insertActiveMath`. Vive dentro de
 * `.matex-context-bar`, que el popover de la fórmula excluye de su cierre por click-afuera.
 */
function MathPaletteControl() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const t = event.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  useEffect(() => {
    const el = panelRef.current
    if (!open || !el) return
    el.replaceChildren(createMathPalette((snippet) => insertActiveMath(snippet)))
    return () => el.replaceChildren()
  }, [open])

  function toggle() {
    const r = btnRef.current?.getBoundingClientRect()
    // Clamp para que el panel (ancho ~460px) no se desborde por el borde derecho.
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 468)), top: r.bottom + 4 })
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()} // no roba el foco del input de la fórmula
        onClick={toggle}
        className={[
          'inline-flex items-center gap-1 rounded px-2 py-1 text-xs outline-none',
          open
            ? 'bg-(--color-surface) text-(--color-ink)'
            : 'text-(--color-ink-muted) hover:bg-(--color-surface) hover:text-(--color-ink)',
        ].join(' ')}
      >
        Símbolos <ChevronDown width={12} height={12} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="matex-bar-palette fixed max-h-[85vh] overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface) p-2 shadow-xl"
          style={{ left: pos.left, top: pos.top, zIndex: 70 }}
        />
      )}
    </>
  )
}

/**
 * Constructor **"Casos ▾"**: arma una función por casos (`\begin{cases}`) con filas
 * *valor · condición* y la inserta en la fórmula en bloque activa vía `insertActiveMath`
 * (el mismo puente que la paleta). Es generación en un sentido (construir → insertar):
 * después se puede seguir editando el LaTeX crudo de la fila como cualquier otro.
 */
function CasesBuilder() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [branches, setBranches] = useState<{ value: string; cond: string }[]>([
    { value: '', cond: '' },
    { value: '', cond: '' },
  ])
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const t = event.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  const buildTex = (): string => {
    const body = branches
      .filter((b) => b.value.trim() || b.cond.trim())
      .map((b) => (b.cond.trim() ? `${b.value.trim()} & \\text{si } ${b.cond.trim()}` : b.value.trim()))
      .join(' \\\\ ')
    return body ? `\\begin{cases} ${body} \\end{cases}` : ''
  }

  function toggle() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4 })
    setOpen((v) => !v)
  }
  function insert() {
    const tex = buildTex()
    if (tex) insertActiveMath(tex)
    setOpen(false)
  }
  const patch = (i: number, p: Partial<{ value: string; cond: string }>) =>
    setBranches((bs) => bs.map((b, j) => (j === i ? { ...b, ...p } : b)))

  const tex = buildTex()
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()} // no roba el foco del input de la fórmula
        onClick={toggle}
        className={[
          'inline-flex items-center gap-1 rounded px-2 py-1 text-xs outline-none',
          open ? 'bg-(--color-surface) text-(--color-ink)' : 'text-(--color-ink-muted) hover:bg-(--color-surface) hover:text-(--color-ink)',
        ].join(' ')}
      >
        Casos <ChevronDown width={12} height={12} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="fixed w-96 rounded-lg border border-(--color-border) bg-(--color-surface) p-3 text-xs shadow-xl"
          style={{ left: pos.left, top: pos.top, zIndex: 70 }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-(--color-ink)">Función por casos</span>
            <span className="min-w-0 overflow-x-auto whitespace-nowrap text-(--color-ink-muted)">
              {tex ? <KatexInline tex={tex} /> : <span className="italic">completá las ramas</span>}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {branches.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={b.value}
                  onChange={(e) => patch(i, { value: e.target.value })}
                  placeholder="valor (x^2)"
                  aria-label={`Valor de la rama ${i + 1}`}
                  className="w-32 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
                <span className="text-(--color-ink-muted)">si</span>
                <input
                  value={b.cond}
                  onChange={(e) => patch(i, { cond: e.target.value })}
                  placeholder="condición (x<0)"
                  aria-label={`Condición de la rama ${i + 1}`}
                  className="w-32 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 font-mono text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
                {branches.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBranches((bs) => bs.filter((_, j) => j !== i))}
                    title="Quitar rama"
                    className="rounded px-1 text-(--color-ink-muted) hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBranches((bs) => [...bs, { value: '', cond: '' }])}
              className="rounded px-1.5 py-0.5 text-(--color-primary) hover:bg-(--color-surface-muted)"
            >
              + rama
            </button>
            <button
              type="button"
              onClick={insert}
              disabled={!tex}
              className="rounded-md bg-(--color-primary) px-3 py-1 font-medium text-(--color-primary-ink) hover:opacity-90 disabled:opacity-40"
            >
              Insertar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'rounded px-2 py-1 text-xs',
        active
          ? 'bg-(--color-primary) text-(--color-primary-ink)'
          : 'text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Ítem del menú "Insertar": difiere la acción un tick para que Radix cierre y no
 *  pelee el foco con el editor/popover que la inserción abre. */
function InsItem({ onRun, children }: { onRun: () => void; children: ReactNode }) {
  return (
    <DropdownMenu.Item
      onSelect={() => setTimeout(onRun, 0)}
      className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-(--color-ink) outline-none data-[highlighted]:bg-(--color-surface-muted)"
    >
      {children}
    </DropdownMenu.Item>
  )
}

/** Renglón de un ítem del menú Insertar: signo, nombre y, si tiene, su atajo. */
function InsLabel({ glyph, hint, children }: { glyph: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <span className="flex w-full items-center gap-2.5">
      <span className="w-5 shrink-0 text-center text-[13px] text-(--color-ink-muted)" aria-hidden="true">
        {glyph}
      </span>
      <span className="flex-1">{children}</span>
      {hint && <kbd className="rounded border border-(--color-border) px-1 font-mono text-[10.5px] text-(--color-ink-muted)">{hint}</kbd>}
    </span>
  )
}

function SegBtn({ onClick, active, children }: { onClick: () => void; active: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded px-2.5 py-0.5',
        active ? 'bg-(--color-primary) text-(--color-primary-ink)' : 'text-(--color-ink-muted) hover:text-(--color-ink)',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-(--color-border)" />
}

function MetaInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-(--color-ink-muted)">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36 rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)"
      />
    </label>
  )
}

/** Editor de **autores** de la portada: lista de {nombre, afiliación, correo} con agregar/quitar. */
function AuthorsEditor({ authors, onChange }: { authors: Author[]; onChange: (authors: Author[]) => void }) {
  const cls = 'w-full rounded border border-(--color-border) bg-(--color-surface) px-1.5 py-0.5 text-(--color-ink) outline-none focus:border-(--color-primary)'
  const set = (i: number, patch: Partial<Author>): void => onChange(authors.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  return (
    <div className="flex flex-col gap-1.5">
      {authors.map((a, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-(--color-border) bg-(--color-surface-muted) p-1.5">
          <div className="flex items-center gap-1">
            <input value={a.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nombre y apellido" className={cls} />
            <button type="button" onClick={() => onChange(authors.filter((_, j) => j !== i))} title="Quitar autor" className="shrink-0 rounded px-1 text-(--color-ink-muted) hover:bg-(--color-surface)">✕</button>
          </div>
          <input value={a.affiliation ?? ''} onChange={(e) => set(i, { affiliation: e.target.value || undefined })} placeholder="Afiliación / institución" className={cls} />
          <input value={a.email ?? ''} onChange={(e) => set(i, { email: e.target.value || undefined })} placeholder="Correo (opcional)" className={cls} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...authors, { name: '' }])} className="self-start rounded border border-(--color-border) px-2 py-1 text-(--color-ink) hover:bg-(--color-surface-muted)">
        + Autor
      </button>
    </div>
  )
}

