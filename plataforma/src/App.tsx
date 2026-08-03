import { useMemo, useRef, useState } from 'react'
import { type ImperativePanelHandle } from 'react-resizable-panels'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronLeft, ChevronRight } from '@/components/icons'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { downloadBlob } from '@/lib/files'
import { buildProjectZip, readProjectZip } from '@/lib/projectZip'
import { createCompiler } from '@/features/compiler/createCompiler'
import { safeCompile } from '@/features/compiler/safeCompile'
import type { CompileResult } from '@/features/compiler/types'
import { lessonCompileInput } from '@/features/lessons/compile'
import { allLessons, findLesson, firstLesson, levels } from '@/features/lessons/content'
import { ExamplePanel } from '@/features/lessons/ExamplePanel'
import { LessonPanel } from '@/features/lessons/LessonPanel'
import { LessonReader } from '@/features/lessons/LessonReader'
import { LessonSwitcher } from '@/features/lessons/LessonSwitcher'
import { Workspace } from '@/features/workspace/Workspace'
import { HeaderSlotProvider, HeaderSlotTarget } from '@/features/workspace/HeaderSlot'
import { MatexWorkspace } from '@/features/matex/editor/MatexWorkspace'
import { compileToLatex, MATEX_AST_VERSION, parseMatexDoc, type MatexDoc } from '@/features/matex/core'
import { readMatexBundle } from '@/features/matex/bundle'
import { LocalProgressStore } from '@/features/progress/LocalProgressStore'
import { LocalReviewStore } from '@/features/srs/LocalReviewStore'
import { allQuestions } from '@/features/quiz/pool'
import { QuizSession } from '@/features/quiz/QuizSession'
import type { Template } from '@/features/templates/types'
import { LocalProjectStore } from '@/features/documents/LocalProjectStore'
import { DocumentsGallery } from '@/features/documents/DocumentsGallery'
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace'
import { NewDocumentPicker } from '@/features/documents/NewDocumentPicker'
import { mainContent } from '@/features/documents/types'
import { exemplars, findExemplar } from '@/features/showcase/data'
import type { Exemplar } from '@/features/showcase/types'
import { ShowcaseViewer } from '@/features/showcase/ShowcaseViewer'

/** Secciones de la app (nav principal). */
type Section = 'curso' | 'proyectos'

/** Documento de ejemplo para probar el editor visual Matex (beta). */
const MATEX_SAMPLE: MatexDoc = {
  type: 'doc',
  version: MATEX_AST_VERSION,
  meta: { title: 'Mi primer documento Matex', author: 'Estudiante' },
  content: [
    { type: 'heading', level: 1, content: [{ type: 'text', text: 'Bienvenido a Matex' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Escribí como en un procesador y mirá el ' },
        { type: 'text', text: 'LaTeX', marks: ['emph'] },
        { type: 'text', text: ' generarse a la derecha. Por ejemplo, la identidad de Euler:' },
      ],
    },
    { type: 'mathDisplay', rows: [{ tex: 'e^{i\\pi} + 1 = 0' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'También en línea, como ' },
        { type: 'mathInline', tex: 'a^2 + b^2 = c^2' },
        { type: 'text', text: '. Hacé clic en una fórmula para editarla.' },
      ],
    },
    {
      type: 'bulletList',
      items: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Negrita, cursiva y listas.' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Exportá a un proyecto para compilar a PDF.' }] }] },
      ],
    },
  ],
}
/** Sub-vistas dentro de una lección del Curso (incluye Repasar). */
type LessonView = 'learn' | 'example' | 'practice' | 'repaso'

const BLANK_TEX = ['\\documentclass{article}', '', '\\begin{document}', '', '\\end{document}', ''].join('\n')

export default function App() {
  // El compilador entra como PUERTO; el factory elige Mock o Remote (Docker/WASM).
  const compiler = useMemo(() => createCompiler(), [])
  const progress = useMemo(() => new LocalProgressStore(), [])
  const reviewStore = useMemo(() => new LocalReviewStore(), [])
  const projectStore = useMemo(() => new LocalProjectStore(), [])

  const lessonPanelRef = useRef<ImperativePanelHandle>(null)
  const isNarrow = useMediaQuery('(max-width: 860px)')
  const direction = isNarrow ? 'vertical' : 'horizontal'

  const [section, setSection] = useState<Section>('curso')
  const [lessonView, setLessonView] = useState<LessonView>('learn')
  const [selectedLessonId, setSelectedLessonId] = useState(firstLesson.id)
  const [source, setSource] = useState(firstLesson.challenge?.starter ?? firstLesson.example)
  // Archivo activo en el editor del Curso (multi-archivo): el principal o un acompañante.
  const [lessonActivePath, setLessonActivePath] = useState(firstLesson.mainFile)
  const [compiling, setCompiling] = useState(false)
  const [result, setResult] = useState<CompileResult | null>(null)
  const [lessonCollapsed, setLessonCollapsed] = useState(false)
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(
    () => new Set(progress.all().map((entry) => entry.lessonId)),
  )
  const [projects, setProjects] = useState(() => projectStore.list())
  const [folders, setFolders] = useState(() => projectStore.listFolders())
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [documentsView, setDocumentsView] = useState<'list' | 'new'>('list')
  const [activeExemplarId, setActiveExemplarId] = useState<string | null>(null)

  const lesson = findLesson(selectedLessonId) ?? firstLesson
  const currentIndex = allLessons.findIndex((entry) => entry.id === selectedLessonId)
  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : undefined
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : undefined
  const activeProject = activeDocumentId ? projectStore.get(activeDocumentId) : undefined
  const activeExemplar = activeExemplarId ? findExemplar(activeExemplarId) : undefined

  // Editor del Curso: el principal (editable = `source`) o un acompañante (solo lectura).
  const lessonIsMainActive = lessonActivePath === lesson.mainFile
  const lessonActiveContent = lessonIsMainActive
    ? source
    : (lesson.files.find((file) => file.path === lessonActivePath)?.content ?? source)

  const completedCount = useMemo(
    () => allLessons.filter((entry) => completedIds.has(entry.id)).length,
    [completedIds],
  )
  const [dueCount, setDueCount] = useState(
    () => allQuestions.filter((question) => reviewStore.isDue(question.id)).length,
  )
  const refreshDueCount = () =>
    setDueCount(allQuestions.filter((question) => reviewStore.isDue(question.id)).length)

  async function handleCompile() {
    setCompiling(true)
    try {
      setResult(await safeCompile(compiler, lessonCompileInput(lesson, source)))
    } finally {
      setCompiling(false)
    }
  }

  function selectLesson(lessonId: string) {
    setSelectedLessonId(lessonId)
    const target = findLesson(lessonId)
    if (target) {
      setSource(target.challenge?.starter ?? target.example)
      setLessonActivePath(target.mainFile)
    }
    setResult(null)
    setSection('curso')
    // Al cambiar de lección se empieza leyendo, salvo que estés repasando.
    setLessonView((current) => (current === 'repaso' ? 'repaso' : 'learn'))
  }

  /** Cambia la sub-vista de la lección cargando en el editor la fuente correcta. */
  function changeLessonView(nextView: LessonView) {
    if (nextView === lessonView && section === 'curso') return
    if (nextView === 'example') {
      setSource(lesson.example)
      setResult(null)
    } else if (nextView === 'practice') {
      setSource(lesson.challenge?.starter ?? lesson.example)
      setResult(null)
    }
    setLessonActivePath(lesson.mainFile)
    setLessonView(nextView)
    setSection('curso')
  }

  function handleChallengePassed(lessonId: string) {
    progress.markCompleted(lessonId)
    setCompletedIds((previous) => new Set(previous).add(lessonId))
  }

  function toggleLesson() {
    const panel = lessonPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  // ── Galería ───────────────────────────────────────────────────────────────
  function openExemplarAsLatex(exemplar: Exemplar) {
    const project = projectStore.create({
      name: exemplar.title,
      files: [{ path: exemplar.mainFile, content: exemplar.source }, ...exemplar.files],
      mainFile: exemplar.mainFile,
      folderId: selectedFolderId,
    })
    setActiveExemplarId(null)
    openProject(project.id)
    setSection('proyectos')
  }

  /** Usa el ejemplar como punto de partida en el modo elegido (visual o LaTeX). */
  function startFromExemplar(exemplar: Exemplar, asMatex: boolean) {
    if (asMatex && exemplar.matex) openExemplarAsMatex(exemplar)
    else openExemplarAsLatex(exemplar)
  }

  /** Abre la **versión Matex** del ejemplar en el editor visual (ME-23): crea un proyecto `matex`. */
  function openExemplarAsMatex(exemplar: Exemplar) {
    if (!exemplar.matex) return
    const project = projectStore.create({
      name: `${exemplar.title} (Matex)`,
      kind: 'matex',
      ast: exemplar.matex,
      mainContent: compileToLatex(exemplar.matex),
      folderId: selectedFolderId,
    })
    setActiveExemplarId(null)
    openProject(project.id)
    setSection('proyectos')
  }

  // ── Mis Proyectos ───────────────────────────────────────────────────────
  function openProject(id: string) {
    setProjects(projectStore.list())
    setActiveDocumentId(id)
    setDocumentsView('list')
  }

  /** Crea un documento **Matex** (visual) y lo abre. */
  function createMatex() {
    const project = projectStore.create({
      name: 'Documento Matex',
      kind: 'matex',
      ast: MATEX_SAMPLE,
      mainContent: compileToLatex(MATEX_SAMPLE),
      folderId: selectedFolderId,
    })
    openProject(project.id)
  }

  function createBlank() {
    openProject(
      projectStore.create({ name: 'Proyecto sin título', mainContent: BLANK_TEX, folderId: selectedFolderId }).id,
    )
  }

  function createFromTemplate(template: Template, asMatex?: boolean) {
    // Plantilla con versión Matex → arranca en el **editor visual** (ME-23), no en LaTeX crudo.
    if (asMatex && template.matex) {
      openProject(
        projectStore.create({
          name: template.title,
          kind: 'matex',
          ast: template.matex,
          mainContent: compileToLatex(template.matex),
          folderId: selectedFolderId,
        }).id,
      )
      return
    }
    const mainFile = template.mainFile ?? 'main.tex'
    const project =
      template.files && template.files.length > 0
        ? projectStore.create({
            name: template.title,
            files: [{ path: mainFile, content: template.source }, ...template.files],
            mainFile,
            folderId: selectedFolderId,
          })
        : projectStore.create({ name: template.title, mainContent: template.source, folderId: selectedFolderId })
    openProject(project.id)
  }

  async function importZip(file: File) {
    const name = file.name.replace(/\.zip$/i, '').trim() || 'Proyecto importado'
    // Si el .zip es un **bundle Matex** (trae un .mtex), lo importamos como documento
    // Matex con sus imágenes; si no, es un proyecto LaTeX normal.
    let bundle: Awaited<ReturnType<typeof readMatexBundle>>
    try {
      bundle = await readMatexBundle(file)
    } catch {
      window.alert('El .zip contiene un .mtex inválido.')
      return
    }
    if (bundle) {
      const files = [
        { path: 'main.tex', content: compileToLatex(bundle.ast), encoding: 'utf8' as const },
        ...bundle.images,
        ...bundle.textFiles,
      ]
      openProject(
        projectStore.create({ name, kind: 'matex', ast: bundle.ast, files, folderId: selectedFolderId }).id,
      )
      return
    }
    const { files, mainFile } = await readProjectZip(file)
    if (files.length === 0) {
      window.alert('El .zip no contiene archivos.')
      return
    }
    openProject(projectStore.create({ name, files, mainFile, folderId: selectedFolderId }).id)
  }

  /** Importa un documento **Matex** desde su AST (`.mtex`): valida y crea el proyecto. */
  async function importMatex(file: File) {
    let ast: MatexDoc
    try {
      ast = parseMatexDoc(JSON.parse(await file.text()))
    } catch {
      window.alert('El archivo no es un documento Matex (.mtex) válido.')
      return
    }
    const name = file.name.replace(/\.(mtex|json)$/i, '').trim() || 'Documento Matex'
    openProject(
      projectStore.create({
        name,
        kind: 'matex',
        ast,
        mainContent: compileToLatex(ast),
        folderId: selectedFolderId,
      }).id,
    )
  }

  function openDocument(id: string) {
    setActiveDocumentId(id)
    setSection('proyectos')
  }

  function renameDocument(id: string) {
    const current = projectStore.get(id)
    const name = window.prompt('Nuevo nombre del proyecto:', current?.name ?? '')
    if (name && name.trim()) {
      projectStore.rename(id, name.trim())
      setProjects(projectStore.list())
    }
  }

  function duplicateDocument(id: string) {
    const current = projectStore.get(id)
    if (!current) return
    projectStore.create({
      name: `${current.name} (copia)`,
      mainContent: mainContent(current),
      folderId: current.folderId,
    })
    setProjects(projectStore.list())
  }

  function deleteDocument(id: string) {
    if (!window.confirm('¿Eliminar este proyecto? No se puede deshacer.')) return
    projectStore.remove(id)
    setProjects(projectStore.list())
  }

  async function downloadProjectZip(id: string) {
    const project = projectStore.get(id)
    if (!project) return
    const blob = await buildProjectZip(project.files)
    downloadBlob(blob, `${project.name.trim() || 'proyecto'}.zip`)
  }

  function moveProject(id: string, folderId: string | null) {
    projectStore.moveProject(id, folderId)
    setProjects(projectStore.list())
  }

  function closeDocument() {
    setActiveDocumentId(null)
    setDocumentsView('list')
    setProjects(projectStore.list())
  }

  // ── Carpetas ──────────────────────────────────────────────────────────────
  function createFolder(parentId: string | null) {
    const name = window.prompt('Nombre de la carpeta:')
    if (name && name.trim()) {
      projectStore.createFolder(name.trim(), parentId)
      setFolders(projectStore.listFolders())
    }
  }

  function renameFolder(id: string) {
    const current = folders.find((folder) => folder.id === id)
    const name = window.prompt('Nuevo nombre de la carpeta:', current?.name ?? '')
    if (name && name.trim()) {
      projectStore.renameFolder(id, name.trim())
      setFolders(projectStore.listFolders())
    }
  }

  function deleteFolder(id: string) {
    if (!window.confirm('¿Eliminar la carpeta? Su contenido sube a la carpeta padre.')) return
    const parentId = folders.find((folder) => folder.id === id)?.parentId ?? null
    projectStore.removeFolder(id)
    setFolders(projectStore.listFolders())
    setProjects(projectStore.list())
    if (selectedFolderId === id) setSelectedFolderId(parentId)
  }

  /** Cambia de sección y vuelve a la grilla/lista (deselecciona el ítem abierto). */
  function goSection(next: Section) {
    setActiveExemplarId(null)
    if (next === 'proyectos') {
      setActiveDocumentId(null)
      setDocumentsView('list')
    }
    setSection(next)
  }

  return (
    <HeaderSlotProvider>
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-(--color-border) bg-(--color-surface) px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-(--color-primary) text-sm font-bold text-(--color-primary-ink)">
            M
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">Matex</span>
        </div>

        <PrimaryNav section={section} onChange={goSection} />

        {section === 'curso' && (
          <>
            <div className="mx-1 h-5 w-px bg-(--color-border)" />
            <NavButton label="Lección anterior" disabled={!prev} onClick={() => prev && selectLesson(prev.id)}>
              <ChevronLeft />
            </NavButton>
            <LessonSwitcher
              levels={levels}
              currentLessonId={selectedLessonId}
              isCompleted={(lessonId) => completedIds.has(lessonId)}
              onSelect={selectLesson}
            />
            <NavButton label="Lección siguiente" disabled={!next} onClick={() => next && selectLesson(next.id)}>
              <ChevronRight />
            </NavButton>
            {/* Solo Repasar vive en el header; Aprender/Ejemplo/Practicar se navegan
                desde el cuerpo de la lección (CTAs del lector y botones de panel). */}
            <RepasoButton
              active={lessonView === 'repaso'}
              dueCount={dueCount}
              onToggle={() => changeLessonView(lessonView === 'repaso' ? 'learn' : 'repaso')}
            />
            <span className="hidden text-xs text-(--color-ink-muted) lg:inline">
              {completedCount}/{allLessons.length}
            </span>
          </>
        )}

        {/* Destino ÚNICO de la toolbar contextual: Compilar/Descargar quedan a la
            derecha (cada Workspace los porta acá). */}
        <HeaderSlotTarget className="flex min-w-0 flex-1 items-center justify-end gap-2" />
      </header>

      {section === 'curso' ? (
        lessonView === 'learn' ? (
          <main className="min-h-0 flex-1 bg-(--color-surface)">
            <LessonReader
              lesson={lesson}
              onExample={() => changeLessonView('example')}
              onPractice={() => changeLessonView('practice')}
            />
          </main>
        ) : lessonView === 'repaso' ? (
          <main className="min-h-0 flex-1">
            <QuizSession
              key={selectedLessonId}
              store={reviewStore}
              lessonId={selectedLessonId}
              level={lesson.level}
              onAnswered={refreshDueCount}
            />
          </main>
        ) : (
          <main className="min-h-0 flex-1">
          <Workspace
            direction={direction}
            autoSaveId={`matex-lesson-${direction}`}
            leftPanel={
              lessonView === 'example' ? (
                <ExamplePanel
                  key={lesson.id}
                  lesson={lesson}
                  activePath={lessonActivePath}
                  onSelectFile={setLessonActivePath}
                  onReset={() => setSource(lesson.example)}
                  onCollapse={toggleLesson}
                  onGoLearn={() => changeLessonView('learn')}
                  onGoPractice={lesson.challenge ? () => changeLessonView('practice') : undefined}
                />
              ) : (
                <LessonPanel
                  key={lesson.id}
                  lesson={lesson}
                  activePath={lessonActivePath}
                  onSelectFile={setLessonActivePath}
                  currentSource={source}
                  onLoadIntoEditor={setSource}
                  onChallengePassed={handleChallengePassed}
                  onCollapse={toggleLesson}
                  onGoLearn={() => changeLessonView('learn')}
                  onGoExample={() => changeLessonView('example')}
                />
              )
            }
            leftPanelRef={lessonPanelRef}
            expandKey={`${selectedLessonId}-${lessonView}`}
            leftCollapsed={lessonCollapsed}
            onToggleLeft={toggleLesson}
            onLeftCollapse={() => setLessonCollapsed(true)}
            onLeftExpand={() => setLessonCollapsed(false)}
            source={lessonActiveContent}
            onSourceChange={lessonIsMainActive ? setSource : () => {}}
            readOnly={!lessonIsMainActive}
            filePaths={[lesson.mainFile, ...lesson.files.map((file) => file.path)]}
            onOpenPath={setLessonActivePath}
            result={result}
            compiling={compiling}
            onCompile={handleCompile}
            downloadName={lesson.id}
          />
          </main>
        )
      ) : (
        <main className="min-h-0 flex-1">
          {/* El **visor de estudio** de un ejemplar (fuente comentada + PDF) ya no es una sección
              propia: se abre desde «Nuevo documento» con "Ver por dentro" y vuelve ahí. */}
          {activeExemplar ? (
            <ShowcaseViewer
              key={activeExemplar.id}
              exemplar={activeExemplar}
              compiler={compiler}
              onBack={() => setActiveExemplarId(null)}
              onUseAsBase={openExemplarAsLatex}
              onOpenMatex={openExemplarAsMatex}
            />
          ) : activeProject ? (
            activeProject.kind === 'matex' ? (
              <MatexWorkspace
                key={activeProject.id}
                project={activeProject}
                compiler={compiler}
                store={projectStore}
                onClose={closeDocument}
              />
            ) : (
              <DocumentWorkspace
                key={activeProject.id}
                project={activeProject}
                compiler={compiler}
                store={projectStore}
                onClose={closeDocument}
              />
            )
          ) : documentsView === 'new' ? (
            <NewDocumentPicker
              onBlank={createBlank}
              onMatex={createMatex}
              onTemplate={createFromTemplate}
              exemplars={exemplars}
              onUseExemplar={startFromExemplar}
              onStudyExemplar={setActiveExemplarId}
              onCancel={() => setDocumentsView('list')}
            />
          ) : (
            <DocumentsGallery
              projects={projects}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onNew={() => setDocumentsView('new')}
              onImportZip={importZip}
              onImportMatex={importMatex}
              onOpen={openDocument}
              onRename={renameDocument}
              onDuplicate={duplicateDocument}
              onDelete={deleteDocument}
              onDownloadZip={downloadProjectZip}
              onMove={moveProject}
            />
          )}
        </main>
      )}
    </div>
    </HeaderSlotProvider>
  )
}

interface PrimaryNavProps {
  section: Section
  onChange: (section: Section) => void
}

const NAV_ITEMS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: 'curso', label: 'Curso' },
  { value: 'proyectos', label: 'Mis Proyectos' },
]

/** Navegación principal: un **selector único** (ocupa poco lugar en la toolbar). */
function PrimaryNav({ section, onChange }: PrimaryNavProps) {
  const currentLabel = NAV_ITEMS.find((item) => item.value === section)?.label ?? 'Curso'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-(--color-ink) outline-none hover:bg-(--color-surface-muted) data-[state=open]:bg-(--color-surface-muted)">
        {currentLabel}
        <ChevronDown width={14} height={14} className="text-(--color-ink-muted)" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-44 rounded-lg border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl"
        >
          {NAV_ITEMS.map((item) => (
            <DropdownMenu.Item
              key={item.value}
              onSelect={() => onChange(item.value)}
              className={[
                'cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-(--color-surface-muted)',
                section === item.value ? 'font-medium text-(--color-ink)' : 'text-(--color-ink-muted)',
              ].join(' ')}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface RepasoButtonProps {
  /** ¿Estamos en el modo Repasar? El botón funciona como toggle. */
  active: boolean
  dueCount: number
  onToggle: () => void
}

/**
 * Único "modo" que vive en el header. Aprender/Ejemplo/Practicar se navegan desde
 * el cuerpo de la lección (CTAs del lector y botones de los paneles), para no
 * llenar la barra. Como toggle: al entrar al repaso, el botón ofrece volver.
 */
function RepasoButton({ active, dueCount, onToggle }: RepasoButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Volver a la lección' : 'Repasar con preguntas'}
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1 text-sm',
        active
          ? 'border-transparent bg-(--color-primary) text-(--color-primary-ink)'
          : 'border-(--color-border) text-(--color-ink-muted) hover:text-(--color-ink)',
      ].join(' ')}
    >
      {active ? 'Volver a la lección' : 'Repasar'}
      {!active && dueCount > 0 && (
        <span className="rounded-full bg-(--color-primary) px-1.5 text-xs text-(--color-primary-ink)">
          {dueCount}
        </span>
      )}
    </button>
  )
}

interface NavButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}

function NavButton({ label, disabled, onClick, children }: NavButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-(--color-ink-muted) hover:bg-(--color-surface-muted) hover:text-(--color-ink) disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
