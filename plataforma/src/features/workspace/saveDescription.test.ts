import { describe, expect, it } from 'vitest'
import { describeSave } from './saveDescription'

const cloud = { syncing: false, synced: false, failed: false }

describe('describeSave', () => {
  it('mientras no guardó localmente, dice «Guardando» aunque la nube esté al día', () => {
    expect(describeSave(false, { ...cloud, synced: true }).label).toBe('Guardando…')
  })

  it('sin sesión: guardado en este equipo, e invita a iniciar sesión', () => {
    const out = describeSave(true)
    expect(out.label).toBe('Guardado en este equipo')
    expect(out.detail).toContain('Iniciá sesión')
  })

  it('con sesión y la nube al día: guardado en la nube', () => {
    expect(describeSave(true, { ...cloud, synced: true })).toMatchObject({ tone: 'cloud', label: 'Guardado en la nube' })
  })

  it('nunca dice «en la nube» si el último cambio no subió', () => {
    for (const state of [cloud, { ...cloud, syncing: true }, { ...cloud, failed: true }]) {
      expect(describeSave(true, state).label).not.toBe('Guardado en la nube')
    }
  })

  it('subiendo, pendiente y con error se distinguen', () => {
    expect(describeSave(true, { ...cloud, syncing: true }).label).toBe('Subiendo a la nube…')
    expect(describeSave(true, cloud).detail).toContain('en unos segundos')
    expect(describeSave(true, { ...cloud, failed: true })).toMatchObject({ tone: 'warn', label: 'Guardado en este equipo, sin subir' })
  })
})
