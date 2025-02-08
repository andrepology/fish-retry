import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve(process.cwd(), 'node_modules/react'),
      'react-dom': resolve(process.cwd(), 'node_modules/react-dom')
    }
  }
})
