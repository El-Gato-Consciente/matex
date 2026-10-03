import { describe, expect, it } from 'vitest'
import {
  COURSE_START,
  HOME,
  locationToPath,
  parseLocation,
  sectionOf,
  type AppLocation,
} from './location'

const CASES: ReadonlyArray<readonly [string, AppLocation]> = [
  ['/curso', COURSE_START],
  ['/curso/l0-1', { kind: 'lesson', lessonId: 'l0-1', view: 'learn' }],
  ['/curso/l0-1/ejemplo', { kind: 'lesson', lessonId: 'l0-1', view: 'example' }],
  ['/curso/l0-1/practicar', { kind: 'lesson', lessonId: 'l0-1', view: 'practice' }],
  ['/curso/l0-1/repaso', { kind: 'lesson', lessonId: 'l0-1', view: 'repaso' }],
  ['/proyectos', { kind: 'projects' }],
  ['/proyectos/nuevo', { kind: 'newDocument' }],
  ['/proyectos/2a1c-uuid', { kind: 'project', projectId: '2a1c-uuid' }],
  ['/ejemplos/ex-paper-biseccion', { kind: 'exemplar', exemplarId: 'ex-paper-biseccion' }],
  ['/como-funciona', { kind: 'wiki', pageId: null }],
  ['/como-funciona/graficos', { kind: 'wiki', pageId: 'graficos' }],
  ['/compartido/Ab3_x-9', { kind: 'shared', shareId: 'Ab3_x-9' }],
]

describe('parseLocation', () => {
  it.each(CASES)('%s', (path, expected) => {
    expect(parseLocation(path)).toEqual(expected)
  })

  it('cae en HOME (Mis Proyectos) ante una ruta desconocida (link viejo, URL tipeada a mano)', () => {
    expect(HOME.kind).toBe('projects')
    for (const path of ['/', '', '/cualquiera', '/ejemplos']) {
      expect(parseLocation(path).kind).toBe(HOME.kind)
    }
  })

  it('ignora los segmentos de más en vez de descartar la ruta entera', () => {
    expect(parseLocation('/proyectos/nuevo/de/mas').kind).toBe('newDocument')
    expect(parseLocation('/ejemplos/ex-cv-moderncv/otra')).toEqual({
      kind: 'exemplar',
      exemplarId: 'ex-cv-moderncv',
    })
  })

  it('una sub-vista desconocida es la vista por defecto, no un error', () => {
    expect(parseLocation('/curso/l0-1/inventada')).toEqual({
      kind: 'lesson',
      lessonId: 'l0-1',
      view: 'learn',
    })
  })

  it('«nuevo» no se confunde con un proyecto', () => {
    expect(parseLocation('/proyectos/nuevo').kind).toBe('newDocument')
  })

  it('sobrevive a un segmento mal escapado', () => {
    expect(parseLocation('/proyectos/100%')).toEqual({ kind: 'project', projectId: '100%' })
  })
})

describe('locationToPath', () => {
  it.each(CASES)('%s', (path, location) => {
    expect(locationToPath(location)).toBe(path)
  })

  it('escapa los ids (un nombre con espacios no rompe la URL)', () => {
    expect(locationToPath({ kind: 'project', projectId: 'a b/c' })).toBe('/proyectos/a%20b%2Fc')
  })

  it('ida y vuelta: parsear la ruta canónica devuelve la misma ubicación', () => {
    for (const [, location] of CASES) {
      expect(parseLocation(locationToPath(location))).toEqual(location)
    }
  })
})

describe('sectionOf', () => {
  it('las lecciones son «curso», la wiki es «wiki» y todo lo demás «proyectos»', () => {
    expect(sectionOf({ kind: 'lesson', lessonId: null, view: 'learn' })).toBe('curso')
    expect(sectionOf({ kind: 'wiki', pageId: null })).toBe('wiki')
    expect(sectionOf({ kind: 'projects' })).toBe('proyectos')
    expect(sectionOf({ kind: 'newDocument' })).toBe('proyectos')
    expect(sectionOf({ kind: 'project', projectId: 'x' })).toBe('proyectos')
    expect(sectionOf({ kind: 'exemplar', exemplarId: 'x' })).toBe('proyectos')
  })
})
