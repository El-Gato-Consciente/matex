// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DocumentSettings } from './DocumentSettings'
import type { DocMeta } from '../core'

afterEach(cleanup)

function setup(meta: DocMeta = {}) {
  const onPatch = vi.fn()
  const onApplyDocClass = vi.fn()
  render(<DocumentSettings meta={meta} onPatch={onPatch} onApplyDocClass={onApplyDocClass} />)
  return { onPatch, onApplyDocClass }
}

/** Los mosaicos de familia son botones con su nombre. */
const familyTile = (name: string) => screen.getByRole('button', { name })

describe('DocumentSettings · elección de familia (ME-47)', () => {
  it('elegir una familia setea `meta.family` con su metadata vacía', () => {
    const { onPatch } = setup()
    fireEvent.click(familyTile('Carta'))
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'letter', letter: {} } })
  })

  it('volver a "documento normal" borra la familia', () => {
    const { onPatch } = setup({ family: { kind: 'cv', cv: {} } })
    fireEvent.click(familyTile('Documento'))
    expect(onPatch).toHaveBeenCalledWith({ family: undefined })
  })

  it('presentación no tiene metadata (solo el kind)', () => {
    const { onPatch } = setup()
    fireEvent.click(familyTile('Presentación'))
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'presentation' } })
  })
})

describe('DocumentSettings · edición de campos de familia (ME-47, el reporte del usuario)', () => {
  it('los campos de la CARTA ahora se pueden editar (antes: cero UI)', () => {
    const { onPatch } = setup({ family: { kind: 'letter', letter: { from: 'Ana' } } })
    // El destinatario se edita y patchea family.letter preservando lo demás.
    fireEvent.change(screen.getByRole('textbox', { name: 'Destinatario' }), { target: { value: 'Dr. Pérez' } })
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'letter', letter: { from: 'Ana', to: 'Dr. Pérez' } } })
  })

  it('la consigna del EXAMEN se edita', () => {
    const { onPatch } = setup({ family: { kind: 'exam', exam: {} } })
    fireEvent.change(screen.getByRole('textbox', { name: /Consigna/i }), { target: { value: 'Justificar todo.' } })
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'exam', exam: { instructions: 'Justificar todo.' } } })
  })

  it('el email del CV se edita, preservando el resto', () => {
    const { onPatch } = setup({ family: { kind: 'cv', cv: { subtitle: 'Lic.' } } })
    fireEvent.change(screen.getByRole('textbox', { name: /Email/i }), { target: { value: 'a@b.c' } })
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'cv', cv: { subtitle: 'Lic.', email: 'a@b.c' } } })
  })

  it('un documento normal no muestra campos de familia; sí el toggle de dos columnas', () => {
    setup({})
    expect(screen.queryByRole('textbox', { name: /Destinatario/i })).toBeNull()
    expect(screen.getByRole('checkbox', { name: /Dos columnas/i })).toBeTruthy()
  })

  it('una carta NO muestra el toggle de dos columnas (tiene su propio layout)', () => {
    setup({ family: { kind: 'letter', letter: {} } })
    expect(screen.queryByRole('checkbox', { name: /Dos columnas/i })).toBeNull()
  })
})

describe('DocumentSettings · diseño visual', () => {
  it('la familia elegida queda marcada', () => {
    setup({ family: { kind: 'cv', cv: {} } })
    expect(familyTile('CV').getAttribute('aria-pressed')).toBe('true')
    expect(familyTile('Carta').getAttribute('aria-pressed')).toBe('false')
  })

  it('el acento se elige con su círculo, y «Del diseño» lo borra', () => {
    const { onPatch } = setup({ accent: 'blue' })
    fireEvent.click(screen.getByRole('button', { name: 'Naranja' }))
    expect(onPatch).toHaveBeenCalledWith({ accent: 'orange' })
    fireEvent.click(screen.getByRole('button', { name: 'Del diseño' }))
    expect(onPatch).toHaveBeenCalledWith({ accent: undefined })
  })

  it('Estándar es el diseño por defecto (no se guarda)', () => {
    const { onPatch } = setup({ style: 'modern' })
    fireEvent.click(screen.getByRole('button', { name: /Clásico/ }))
    expect(onPatch).toHaveBeenCalledWith({ style: 'classic' })
    fireEvent.click(screen.getByRole('button', { name: /Estándar/ }))
    expect(onPatch).toHaveBeenCalledWith({ style: undefined })
  })

  it('márgenes y estructura', () => {
    const { onPatch, onApplyDocClass } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Estrecho' }))
    expect(onPatch).toHaveBeenCalledWith({ margin: '2cm' })
    fireEvent.click(screen.getByRole('button', { name: /Informe/ }))
    expect(onApplyDocClass).toHaveBeenCalledWith('report', false)
  })
})

describe('DocumentSettings · papel y tamaño de letra', () => {
  it('Carta y 12 pt se guardan; A4 y 11 pt son el default y no', () => {
    const { onPatch } = setup({ paperSize: 'letter', baseFontSize: 12 })
    expect(screen.getByRole('button', { name: /^Carta 8/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '12 pt' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^A4/ }))
    expect(onPatch).toHaveBeenCalledWith({ paperSize: undefined })
    fireEvent.click(screen.getByRole('button', { name: '11 pt' }))
    expect(onPatch).toHaveBeenCalledWith({ baseFontSize: undefined })
    fireEvent.click(screen.getByRole('button', { name: '10 pt' }))
    expect(onPatch).toHaveBeenCalledWith({ baseFontSize: 10 })
  })
})
