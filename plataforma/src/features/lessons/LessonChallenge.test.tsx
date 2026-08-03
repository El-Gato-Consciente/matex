// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LessonChallenge } from './LessonChallenge'
import type { Lesson } from './types'

const baseLesson: Lesson = {
  id: 'l-demo',
  level: 0,
  title: 'Demo',
  capa: 'semantica',
  objective: '',
  prerequisites: [],
  content: [],
  example: '\\section{Sol}',
  files: [],
  mainFile: 'main.tex',
  seeAlso: [],
  challenge: {
    prompt: 'Agregá una sección',
    starter: 'empezá acá',
    mustInclude: ['\\section'],
    hints: ['Usá \\section{...}'],
    solution: '\\section{Resuelto}',
  },
}

function setup(currentSource: string) {
  const onLoadIntoEditor = vi.fn()
  const onChallengePassed = vi.fn()
  render(
    <LessonChallenge
      lesson={baseLesson}
      currentSource={currentSource}
      onLoadIntoEditor={onLoadIntoEditor}
      onChallengePassed={onChallengePassed}
    />,
  )
  return { onLoadIntoEditor, onChallengePassed }
}

describe('LessonChallenge', () => {
  it('muestra la consigna y no corrige hasta verificar', () => {
    setup('texto sin nada')
    expect(screen.getByText('Agregá una sección')).toBeInTheDocument()
    expect(screen.queryByText(/falta incluir/i)).not.toBeInTheDocument()
  })

  it('al verificar una fuente incompleta, lista lo que falta y no aprueba', () => {
    const { onChallengePassed } = setup('texto sin la sección')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(screen.getByText(/falta incluir/i)).toBeInTheDocument()
    expect(screen.getByText('\\section')).toBeInTheDocument()
    expect(onChallengePassed).not.toHaveBeenCalled()
  })

  it('al verificar una fuente válida, aprueba y registra el progreso', () => {
    const { onChallengePassed } = setup('mi \\section{Hola}')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(screen.getByText(/Lección completada/i)).toBeInTheDocument()
    expect(onChallengePassed).toHaveBeenCalledWith('l-demo')
  })

  it('"Ver solución" carga la solución de referencia en el editor', () => {
    const { onLoadIntoEditor } = setup('')
    fireEvent.click(screen.getByRole('button', { name: 'Ver solución' }))
    expect(onLoadIntoEditor).toHaveBeenCalledWith('\\section{Resuelto}')
  })

  it('"Reiniciar" carga el starter en el editor', () => {
    const { onLoadIntoEditor } = setup('')
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar' }))
    expect(onLoadIntoEditor).toHaveBeenCalledWith('empezá acá')
  })

  it('las pistas se muestran y ocultan con el botón', () => {
    setup('')
    expect(screen.queryByText('Usá \\section{...}')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver pistas' }))
    expect(screen.getByText('Usá \\section{...}')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar pistas' }))
    expect(screen.queryByText('Usá \\section{...}')).not.toBeInTheDocument()
  })
})
