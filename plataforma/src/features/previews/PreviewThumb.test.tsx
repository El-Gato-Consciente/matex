// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PreviewThumb } from './PreviewThumb'
import { PreviewDialog } from './PreviewDialog'
import type { Preview } from './types'

const A4 = { width: 760, height: 1075 } as const

const twoPages: Preview = {
  pageCount: 9,
  pages: [
    { src: '/previews/templates/t-p1.aaaaaaaa.webp', page: 1, ...A4 },
    { src: '/previews/templates/t-p5.bbbbbbbb.webp', page: 5, ...A4 },
  ],
}

const onePage: Preview = {
  pageCount: 1,
  pages: [{ src: '/previews/templates/u-p1.cccccccc.webp', page: 1, ...A4 }],
}

describe('PreviewThumb', () => {
  it('muestra la portada y avisa al abrir', () => {
    const onOpen = vi.fn()
    render(<PreviewThumb preview={twoPages} title="Tesina" onOpen={onOpen} />)

    const button = screen.getByRole('button', { name: /Tesina/ })
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledOnce()
    // La portada es la primera página, no una cualquiera.
    expect(button.querySelector('img')).toHaveAttribute('src', twoPages.pages[0]!.src)
  })

  it('dice cuántas páginas hay cuando hay más de una', () => {
    render(<PreviewThumb preview={twoPages} title="Tesina" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /2 páginas/ })).toBeInTheDocument()
  })

  it('escala la hoja sin deformarla', () => {
    render(<PreviewThumb preview={onePage} title="Carta" onOpen={vi.fn()} />)
    const sheet = screen.getByRole('button').firstElementChild as HTMLElement
    const ratio = parseFloat(sheet.style.width) / parseFloat(sheet.style.height)
    expect(ratio).toBeCloseTo(A4.width / A4.height, 2)
  })
})

describe('PreviewDialog', () => {
  it('cerrado no renderiza nada', () => {
    render(<PreviewDialog preview={null} title="" onClose={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('muestra todas las páginas capturadas y su número real', () => {
    render(<PreviewDialog preview={twoPages} title="Tesina" onClose={vi.fn()} />)
    expect(screen.getByAltText('Tesina — página 1')).toBeInTheDocument()
    expect(screen.getByAltText('Tesina — página 5')).toBeInTheDocument()
    // No promete mostrar el documento entero: dice cuántas de cuántas hay.
    expect(screen.getByText(/2 páginas representativas de 9/)).toBeInTheDocument()
  })

  it('cierra con Escape', () => {
    const onClose = vi.fn()
    render(<PreviewDialog preview={onePage} title="Carta" onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
