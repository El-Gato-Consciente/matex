import { describe, expect, it } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'
import { DEFAULT_PREFS, loadPrefs, pathProblem, pathSegments, savePrefs } from './storagePrefs'

describe('storagePrefs', () => {
  it('sin nada guardado, Matex en las carpetas por defecto', () => {
    expect(loadPrefs('ana', createFakeStorage())).toEqual(DEFAULT_PREFS)
  })

  it('se guarda por cuenta y normaliza las rutas', () => {
    const storage = createFakeStorage()
    savePrefs('ana', { defaultStorage: 'drive', s3Path: ' /facu/ análisis/ ', drivePath: 'Matex/ Facultad ' }, storage)
    expect(loadPrefs('ana', storage)).toEqual({ defaultStorage: 'drive', s3Path: 'facu/análisis', drivePath: 'Matex/Facultad' })
    expect(loadPrefs('beto', storage)).toEqual(DEFAULT_PREFS)
  })

  it('valida las carpetas como la lambda (tildes sí; «..», vacíos y raros no)', () => {
    expect(pathProblem('Facultad/Análisis 2')).toBeNull()
    expect(pathProblem('  ')).toBe('Elegí una carpeta.')
    expect(pathProblem('a/../b')).toMatch(/no permitidos/)
    expect(pathProblem('a/b:c')).toMatch(/no permitidos/)
    expect(pathProblem('1/2/3/4/5/6/7')).toMatch(/6 niveles/)
    expect(pathSegments('/a//b/')).toEqual(['a', 'b'])
  })
})
