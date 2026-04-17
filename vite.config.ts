import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@core':     resolve(__dirname, 'src/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@ui':       resolve(__dirname, 'src/ui'),
      '@design':   resolve(__dirname, 'src/design'),
    },
  },
  build: {
    target: 'es2022',
  },
})
