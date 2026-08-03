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

/** El `<select>` de familia (el primero del modal). */
const familySelect = () => screen.getByRole('combobox', { name: /Familia/i })

describe('DocumentSettings · elección de familia (ME-47)', () => {
  it('elegir una familia setea `meta.family` con su metadata vacía', () => {
    const { onPatch } = setup()
    fireEvent.change(familySelect(), { target: { value: 'letter' } })
    expect(onPatch).toHaveBeenCalledWith({ family: { kind: 'letter', letter: {} } })
  })

  it('volver a "documento normal" borra la familia', () => {
    const { onPatch } = setup({ family: { kind: 'cv', cv: {} } })
    fireEvent.change(familySelect(), { target: { value: 'document' } })
    expect(onPatch).toHaveBeenCalledWith({ family: undefined })
  })

  it('presentación no tiene metadata (solo el kind)', () => {
    const { onPatch } = setup()
    fireEvent.change(familySelect(), { target: { value: 'presentation' } })
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
