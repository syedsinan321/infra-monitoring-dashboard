import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/infra-monitoring-dashboard/',
  plugins: [react()],
  server: {
    port: 5173,
  },
})
