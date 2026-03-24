import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/ai-dev-analytics/',
  define: {
    'import.meta.env.VITE_DEMO': JSON.stringify('true'),
  },
  build: {
    outDir: resolve(__dirname, '../demo-dist'),
    emptyOutDir: true,
  },
})
