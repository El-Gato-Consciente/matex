import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronLeft, ChevronRight } from '@/components/icons'
import { Logo } from '@/components/Logo'
import { downloadBlob } from '@/lib/files'
import { buildProjectZip, readProjectZip } from '@/lib/projectZip'
import { createCompiler } from '@/features/compiler/createCompiler'
import { allLessons, findLesson, firstLesson, levels } from '@/features/lessons/content'
import { CourseWorkspace } from '@/features/lessons/CourseWorkspace'
import { LessonHostProvider, type LessonHost } from '@/features/lessons/LessonHost'
import type { LessonDestination } from '@/features/lessons/types'
import { LessonReader } from '@/features/lessons/LessonReader'
import { LessonSwitcher } from '@/features/lessons/LessonSwitcher'
import { HeaderSlotProvider, HeaderSlotTarget } from '@/features/workspace/HeaderSlot'
import { MatexWorkspace } from '@/features/matex/editor/MatexWorkspace'
import { compileToLatex, MATEX_AST_VERSION, parseMatexDoc, type MatexDoc } from '@/features/matex/core'
import { readMatexBundle } from '@/features/matex/bundle'
import {
  COURSE_START,
  sectionOf,
  type AppLocation,
  type LessonView,
  type Section,
} from '@/features/navigation/location'
import { useAppLocation } from '@/features/navigation/useAppLocation'
import { LocalProgressStore } from '@/features/progress/LocalProgressStore'
import { markWelcomed, shouldWelcome } from '@/features/progress/welcome'
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
import { WikiView } from '@/features/wiki/WikiView'
import { AccountMenu } from '@/features/account/AccountMenu'
import { useAccount } from '@/features/account/account'
import { useSync } from '@/features/sync/useSync'
import { isProjectFile } from '@/features/sync/projectFile'

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

const BLANK_TEX = ['\\documentclass{article}', '', '\\begin{document}', '', '\\end{document}', ''].join('\n')

/**
 * Shell de la app: el header y **el ruteo**.
 *
 * Dónde está el usuario no es estado local sino la **URL** (`useAppLocation`): así el botón Atrás
 * del navegador funciona, y cada vista tiene un link que se puede compartir o recargar. Lo que sí
 * es estado de acá son los datos que el header muestra (progreso, repasos pendientes) y la lista
 * de proyectos, que varias vistas comparten.
 */
export default function App() {
  // El compilador entra como PUERTO; el factory elige Mock o Remote (Docker/WASM).
  const compiler = useMemo(() => createCompiler(), [])
  const progress = useMemo(() => new LocalProgressStore(), [])
  const reviewStore = useMemo(() => new LocalReviewStore(), [])
  const projectStore = useMemo(() => new LocalProjectStore(), [])

  const [location, navigate] = useAppLocation()

  // La primera visita a la raíz va a «Cómo funciona» (la wiki); después, la raíz es Mis
  // Proyectos. Antes de pintar, para que no parpadee la galería. Un link directo se respeta.
  useLayoutEffect(() => {
    const isRoot = window.location.pathname === '/'
    if (isRoot && shouldWelcome({ completedLessons: progress.all().length, projects: projectStore.list().length })) {
      navigate({ kind: 'wiki', pageId: null }, { replace: true })
    }
    markWelcomed()
    // Solo al montar: es la primera entrada al sitio, no cada navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(
    () => new Set(progress.all().map((entry) => entry.lessonId)),
  )
  const [projects, setProjects] = useState(() => projectStore.list())
  const [folders, setFolders] = useState(() => projectStore.listFolders())

  // Sincronización con la cuenta (opcional: sin sesión no hace nada). No le pisa el contenido al
  // proyecto abierto en el editor; cuando trae cambios de otro equipo, la galería se relee.
  const account = useAccount()
  const sync = useSync({
    account,
    store: projectStore,
    apiBaseUrl: import.meta.env.VITE_COMPILE_API_URL,
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    isBusy: (projectId) => location.kind === 'project' && location.projectId === projectId,
    onChange: () => {
      setProjects(projectStore.list())
      setFolders(projectStore.listFolders())
    },
  })
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  const section = sectionOf(location)
  const lessonView: LessonView = location.kind === 'lesson' ? location.view : 'learn'
  // Un id que ya no existe (link viejo) cae en la primera lección en vez de dar pantalla blanca.
  const lesson =
    (location.kind === 'lesson' && location.lessonId ? findLesson(location.lessonId) : undefined) ??
    firstLesson

  // Volver al Curso desde Mis Proyectos retoma la última lección visitada. No va en la URL: es
  // memoria de la sesión, como la posición del scroll, no un lugar al que se pueda linkear.
  const lastLesson = useRef<AppLocation>(COURSE_START)
  useEffect(() => {
    if (location.kind === 'lesson') lastLesson.current = location
  }, [location])

  const currentIndex = allLessons.findIndex((entry) => entry.id === lesson.id)
  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : undefined
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : undefined

  // Un id que no resuelve (proyecto borrado, ejemplar renombrado) simplemente no abre nada: la
  // cadena de abajo cae en la galería.
  const activeProject = location.kind === 'project' ? projectStore.get(location.projectId) : undefined
  const activeExemplar = location.kind === 'exemplar' ? findExemplar(location.exemplarId) : undefined

  const completedCount = useMemo(
    () => allLessons.filter((entry) => completedIds.has(entry.id)).length,
    [completedIds],
  )
  const [dueCount, setDueCount] = useState(
    () => allQuestions.filter((question) => reviewStore.isDue(question.id)).length,
  )
  const refreshDueCount = () =>
    setDueCount(allQuestions.filter((question) => reviewStore.isDue(question.id)).length)

  // ── Curso ─────────────────────────────────────────────────────────────────
  function selectLesson(lessonId: string) {
    // Al cambiar de lección se empieza leyendo, salvo que estés repasando.
    navigate({ kind: 'lesson', lessonId, view: lessonView === 'repaso' ? 'repaso' : 'learn' })
  }

  function changeLessonView(nextView: LessonView) {
    navigate({ kind: 'lesson', lessonId: lesson.id, view: nextView })
  }

  function completeLesson(lessonId: string) {
    progress.markCompleted(lessonId)
    setCompletedIds((previous) => new Set(previous).add(lessonId))
  }

  /** Destinos de los bloques `destinations` de una lección. */
  function navigateFromLesson(to: LessonDestination) {
    switch (to) {
      case 'ejemplo':
        return changeLessonView('example')
      case 'practica':
        return changeLessonView('practice')
      case 'repaso':
        return changeLessonView('repaso')
      case 'proyectos':
        return navigate({ kind: 'projects' })
      case 'nuevo':
        return navigate({ kind: 'newDocument' })
    }
  }

  const lessonHost: LessonHost = {
    compiler,
    reviewStore,
    navigate: navigateFromLesson,
    onAnswered: refreshDueCount,
    // Con desafío, la lección la completa el desafío; sin él, el chequeo.
    onCheckPassed: (lessonId) => {
      if (!findLesson(lessonId)?.challenge) completeLesson(lessonId)
    },
  }

  // ── Galería ───────────────────────────────────────────────────────────────
  function openExemplarAsLatex(exemplar: Exemplar) {
    const project = projectStore.create({
      name: exemplar.title,
      files: [{ path: exemplar.mainFile, content: exemplar.source }, ...exemplar.files],
      mainFile: exemplar.mainFile,
      folderId: selectedFolderId,
    })
    openProject(project.id)
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
    openProject(project.id)
  }

  // ── Mis Proyectos ───────────────────────────────────────────────────────
  function openProject(id: string) {
    setProjects(projectStore.list())
    navigate({ kind: 'project', projectId: id })
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
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch {
      window.alert('El archivo no es un documento Matex (.mtex) válido.')
      return
    }
    // Un `.mtex` de proyecto (el que se guarda en Drive) trae el proyecto entero: se importa como
    // copia nueva, con sus archivos e imágenes. Si no, es un `.mtex` suelto (solo el documento).
    if (isProjectFile(json)) {
      const source = json.project
      openProject(
        projectStore.create({
          name: source.name,
          kind: source.kind,
          files: source.files,
          mainFile: source.mainFile,
          folderId: selectedFolderId,
          ...(source.ast ? { ast: parseMatexDoc(source.ast) } : {}),
        }).id,
      )
      return
    }
    try {
      ast = parseMatexDoc(json)
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
    setProjects(projectStore.list())
    navigate({ kind: 'projects' })
    sync.syncNow() // al cerrar un documento es cuando más cambios hay para subir
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

  /** Cambia de sección: al Curso se vuelve donde estabas; a la wiki, a su portada; a Proyectos, a la lista. */
  function goSection(next: Section) {
    if (next === 'curso') navigate(lastLesson.current)
    else if (next === 'wiki') navigate({ kind: 'wiki', pageId: null })
    else navigate({ kind: 'projects' })
  }

  return (
    <HeaderSlotProvider>
    <LessonHostProvider value={lessonHost}>
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-(--color-border) bg-(--color-surface) px-4 py-2.5">
        {/* El logo lleva a Mis Proyectos. Es un link de verdad: Ctrl/⌘+clic o la rueda abren
            otra pestaña; el clic común navega sin recargar. */}
        <a
          href="/proyectos"
          aria-label="Ir a Mis Proyectos"
          title="Mis Proyectos"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            navigate({ kind: 'projects' })
          }}
          className="flex items-center rounded-md text-base outline-offset-4 transition-opacity hover:opacity-85"
        >
          <Logo anchor wordmarkClassName="hidden sm:inline-flex" />
        </a>

        <PrimaryNav section={section} onChange={goSection} />

        {section === 'curso' && (
          <>
            <div className="mx-1 h-5 w-px bg-(--color-border)" />
            <NavButton label="Lección anterior" disabled={!prev} onClick={() => prev && selectLesson(prev.id)}>
              <ChevronLeft />
            </NavButton>
            <LessonSwitcher
              levels={levels}
              currentLessonId={lesson.id}
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
        <AccountMenu sync={sync} />
      </header>

      {location.kind === 'wiki' ? (
        <main className="min-h-0 flex-1 bg-(--color-surface)">
          <WikiView
            pageId={location.pageId}
            onSelectPage={(pageId) => navigate({ kind: 'wiki', pageId })}
            onStartMatex={createMatex}
            onGoProjects={() => navigate({ kind: 'projects' })}
          />
        </main>
      ) : location.kind === 'lesson' ? (
        location.view === 'learn' ? (
          <main className="min-h-0 flex-1 bg-(--color-surface)">
            <LessonReader
              lesson={lesson}
              onExample={() => changeLessonView('example')}
              onPractice={() => changeLessonView('practice')}
            />
          </main>
        ) : location.view === 'repaso' ? (
          <main className="min-h-0 flex-1">
            <QuizSession
              key={lesson.id}
              store={reviewStore}
              lessonId={lesson.id}
              level={lesson.level}
              onAnswered={refreshDueCount}
            />
          </main>
        ) : (
          <main className="min-h-0 flex-1">
            {/* La `key` reinicia la sesión de edición al cambiar de lección o de vista —
                incluso yendo Atrás con el navegador. */}
            <CourseWorkspace
              key={`${lesson.id}:${location.view}`}
              lesson={lesson}
              view={location.view}
              compiler={compiler}
              onChallengePassed={completeLesson}
              onGoLearn={() => changeLessonView('learn')}
              onGoExample={() => changeLessonView('example')}
              onGoPractice={() => changeLessonView('practice')}
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
              onBack={() => navigate({ kind: 'newDocument' })}
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
          ) : location.kind === 'newDocument' ? (
            <NewDocumentPicker
              onBlank={createBlank}
              onMatex={createMatex}
              onTemplate={createFromTemplate}
              exemplars={exemplars}
              onUseExemplar={startFromExemplar}
              onStudyExemplar={(id) => navigate({ kind: 'exemplar', exemplarId: id })}
              onCancel={() => navigate({ kind: 'projects' })}
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
              onNew={() => navigate({ kind: 'newDocument' })}
              onImportZip={importZip}
              onImportMatex={importMatex}
              onOpen={(id) => navigate({ kind: 'project', projectId: id })}
              onRename={renameDocument}
              onDuplicate={duplicateDocument}
              onDelete={deleteDocument}
              onDownloadZip={downloadProjectZip}
              onMove={moveProject}
              cloud={
                account.status === 'signed-in'
                  ? { storageOf: sync.storageOf, isMoving: sync.isMoving, moveTo: sync.moveProject }
                  : undefined
              }
            />
          )}
        </main>
      )}
    </div>
    </LessonHostProvider>
    </HeaderSlotProvider>
  )
}

interface PrimaryNavProps {
  section: Section
  onChange: (section: Section) => void
}

/** El Curso está oculto por ahora: su código y sus rutas siguen vivos; volver a mostrarlo es poner `true`. */
const COURSE_VISIBLE = false

const NAV_ITEMS: ReadonlyArray<{ value: Section; label: string }> = [
  ...(COURSE_VISIBLE ? [{ value: 'curso' as const, label: 'Curso' }] : []),
  { value: 'wiki', label: 'Cómo funciona' },
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
