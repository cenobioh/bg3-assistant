import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// For GitHub Pages: base should be '/your-repo-name/' (with trailing slash)
// For custom domain or root deployment: base should be '/'
// This can also be set via environment variable: VITE_BASE_PATH
const basePath = process.env.VITE_BASE_PATH || '/bg3-assistant/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

