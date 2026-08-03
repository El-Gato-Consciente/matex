import { useRef, useState } from 'react'
import { type ImperativePanelHandle } from 'react-resizable-panels'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { LatexCompiler } from '@/features/compiler/LatexCompiler'
import { safeCompile } from '@/features/compiler/safeCompile'
import type { CompileResult } from '@/features/compiler/types'
import { Workspace } from '@/features/workspace/Workspace'
import { lessonCompileInput } from './compile'
import { ExamplePanel } from './ExamplePanel'
import { LessonPanel } from './LessonPanel'
import type { Lesson } from './types'

interface CourseWorkspaceProps {
  lesson: Lesson
  /** Las dos sub-vistas de una lección que traen editor. */
  view: 'example' | 'practice'
  compiler: LatexCompiler
  onChallengePassed: (lessonId: string) => void
  onGoLearn: () => void
  onGoExample: () => void
  onGoPractice: () => void
}

/**
 * El taller de una lección: panel de la lección + editor + PDF.
 *
 * **Es dueño de todo el estado de la sesión de edición** (la fuente, el resultado de la última
 * compilación, qué archivo está abierto) y se monta con `key={lección + vista}`. Ese detalle es
 * el que hace que el botón Atrás del navegador funcione bien acá: cuando la URL cambia de lección
 * o de vista, este componente se **remonta** y la fuente se recarga desde la lección nueva. Con
 * el estado en `App`, volver atrás cambiaba el enunciado y dejaba en el editor el código de la
 * lección anterior.
 */
export function CourseWorkspace({
  lesson,
  view,
  compiler,
  onChallengePassed,
  onGoLearn,
  onGoExample,
  onGoPractice,
}: CourseWorkspaceProps) {
  const isNarrow = useMediaQuery('(max-width: 860px)')
  const direction = isNarrow ? 'vertical' : 'horizontal'
  const lessonPanelRef = useRef<ImperativePanelHandle>(null)

  const [source, setSource] = useState(() => initialSource(lesson, view))
  const [activePath, setActivePath] = useState(lesson.mainFile)
  const [result, setResult] = useState<CompileResult | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // El editor muestra el archivo principal (editable) o un acompañante (solo lectura).
  const isMainActive = activePath === lesson.mainFile
  const activeContent = isMainActive
    ? source
    : (lesson.files.find((file) => file.path === activePath)?.content ?? source)

  async function handleCompile(): Promise<void> {
    setCompiling(true)
    try {
      setResult(await safeCompile(compiler, lessonCompileInput(lesson, source)))
    } finally {
      setCompiling(false)
    }
  }

  function toggleLesson(): void {
    const panel = lessonPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  return (
    <Workspace
      direction={direction}
      autoSaveId={`matex-lesson-${direction}`}
      leftPanel={
        view === 'example' ? (
          <ExamplePanel
            lesson={lesson}
            activePath={activePath}
            onSelectFile={setActivePath}
            onReset={() => setSource(lesson.example)}
            onCollapse={toggleLesson}
            onGoLearn={onGoLearn}
            onGoPractice={lesson.challenge ? onGoPractice : undefined}
          />
        ) : (
          <LessonPanel
            lesson={lesson}
            activePath={activePath}
            onSelectFile={setActivePath}
            currentSource={source}
            onLoadIntoEditor={setSource}
            onChallengePassed={onChallengePassed}
            onCollapse={toggleLesson}
            onGoLearn={onGoLearn}
            onGoExample={onGoExample}
          />
        )
      }
      leftPanelRef={lessonPanelRef}
      leftCollapsed={collapsed}
      onToggleLeft={toggleLesson}
      onLeftCollapse={() => setCollapsed(true)}
      onLeftExpand={() => setCollapsed(false)}
      source={activeContent}
      onSourceChange={isMainActive ? setSource : () => {}}
      readOnly={!isMainActive}
      filePaths={[lesson.mainFile, ...lesson.files.map((file) => file.path)]}
      onOpenPath={setActivePath}
      result={result}
      compiling={compiling}
      onCompile={handleCompile}
      downloadName={lesson.id}
    />
  )
}

/** Con qué arranca el editor: el ejemplo resuelto, o el esqueleto del desafío. */
function initialSource(lesson: Lesson, view: 'example' | 'practice'): string {
  return view === 'example' ? lesson.example : (lesson.challenge?.starter ?? lesson.example)
}
