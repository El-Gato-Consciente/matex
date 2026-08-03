// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAppLocation } from './useAppLocation'

/**
 * El test que le importa al usuario es el último: **Atrás vuelve**. Los demás describen el
 * contrato del que depende (la URL manda, y navegar al mismo lugar no apila historia).
 */
describe('useAppLocation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/curso/l0-1')
  })

  it('arranca leyendo la URL', () => {
    window.history.replaceState(null, '', '/proyectos/nuevo')
    const { result } = renderHook(() => useAppLocation())
    expect(result.current[0]).toEqual({ kind: 'newDocument' })
  })

  it('navegar cambia la URL y la ubicación', () => {
    const { result } = renderHook(() => useAppLocation())
    act(() => result.current[1]({ kind: 'project', projectId: 'abc' }))

    expect(window.location.pathname).toBe('/proyectos/abc')
    expect(result.current[0]).toEqual({ kind: 'project', projectId: 'abc' })
  })

  it('navegar al mismo lugar no apila entradas en la historia', () => {
    const { result } = renderHook(() => useAppLocation())
    const before = window.history.length
    act(() => result.current[1]({ kind: 'lesson', lessonId: 'l0-1', view: 'learn' }))
    expect(window.history.length).toBe(before)
  })

  it('`replace` no deja entrada nueva', () => {
    const { result } = renderHook(() => useAppLocation())
    const before = window.history.length
    act(() => result.current[1]({ kind: 'projects' }, { replace: true }))

    expect(window.location.pathname).toBe('/proyectos')
    expect(window.history.length).toBe(before)
  })

  it('el botón Atrás del navegador vuelve a la vista anterior', async () => {
    const { result } = renderHook(() => useAppLocation())
    act(() => result.current[1]({ kind: 'projects' }))
    act(() => result.current[1]({ kind: 'newDocument' }))
    expect(result.current[0]).toEqual({ kind: 'newDocument' })

    act(() => window.history.back())
    await waitFor(() => expect(result.current[0]).toEqual({ kind: 'projects' }))

    act(() => window.history.back())
    await waitFor(() =>
      expect(result.current[0]).toEqual({ kind: 'lesson', lessonId: 'l0-1', view: 'learn' }),
    )
  })
})
