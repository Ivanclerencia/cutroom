import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Identificador de cada publicación: la app lo compara con version.json para
// saber si hay una versión nueva y recargarse sola.
const BUILD_ID = new Date().toISOString()

const versionFile = () => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
  },
})

// base relativa para que funcione en GitHub Pages (usuario.github.io/repo/)
export default defineConfig({
  plugins: [react(), versionFile()],
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
