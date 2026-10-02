import type { SVGProps } from 'react'

/** Iconos SVG mínimos (stroke currentColor). Centralizados para consistencia. */

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

export const ChevronLeft = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)

export const ChevronRight = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)

export const ChevronDown = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const Check = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const PanelLeft = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </Icon>
)

export const Upload = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </Icon>
)

export const Folder = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Icon>
)

export const FolderPlus = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    <path d="M12 10v6M9 13h6" />
  </Icon>
)

export const Trash = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6" />
  </Icon>
)

export const Download = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
  </Icon>
)

export const Pencil = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
)

export const Copy = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect width="13" height="13" x="9" y="9" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
)

export const Plus = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MoreHorizontal = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Icon>
)
