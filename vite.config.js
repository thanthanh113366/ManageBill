import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy OTLP HTTP metrics to Grafana Cloud to avoid browser CORS.
      // Client will send to same-origin "/otlp/v1/metrics".
      '/otlp': {
        target: 'https://otlp-gateway-prod-ap-southeast-1.grafana.net',
        changeOrigin: true,
        secure: true,
      },
    },
  },
}) 