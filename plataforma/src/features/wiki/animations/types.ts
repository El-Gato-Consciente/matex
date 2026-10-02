/** Lo que recibe cada animación de la wiki. */
export interface WikiAnimationProps {
  /** ¿Está en pantalla? Las animaciones con JS (requestAnimationFrame) se detienen si no. */
  readonly playing: boolean
}
