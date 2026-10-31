import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The managed preview host; localhost remains available for normal development.
  server: { allowedHosts: ['terminal.local'] }
})
