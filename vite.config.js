import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa para que funcione en GitHub Pages (usuario.github.io/repo/)
export default defineConfig({
  plugins: [react()],
  base: './',
})
