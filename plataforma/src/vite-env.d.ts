/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend de compilación LaTeX (Docker + TeX Live). */
  readonly VITE_COMPILE_API_URL?: string
  /** Client ID de Google (cuenta del ecosistema). Sin él, no hay login ni sincronización. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
