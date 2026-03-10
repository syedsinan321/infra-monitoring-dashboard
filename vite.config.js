import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/infra-monitoring-dashboard/',
  server: {
    port: 5173,
  },
})
