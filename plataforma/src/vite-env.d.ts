/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend de compilación LaTeX (Docker + TeX Live). */
  readonly VITE_COMPILE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
