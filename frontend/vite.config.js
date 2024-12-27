import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Replace with your backend server's URL and port
        changeOrigin: true,
        secure: false, // Use this if your backend is running on HTTPS and you have self-signed certificates
      }
    }
  }
})
