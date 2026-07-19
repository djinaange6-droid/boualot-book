import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Dis explicitement à Vite de ne pas toucher ni analyser html2pdf.js
      external: ['html2pdf.js'],
    },
  },
})