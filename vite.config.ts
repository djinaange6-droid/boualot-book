import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['html2pdf.js', 'jspdf', 'lucide-react', 'framer-motion'],
    },
  },
});