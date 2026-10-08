import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { '/api/v2': { target: 'http://127.0.0.1:8082', changeOrigin: false } },
  },
  preview: {
    proxy: { '/api/v2': { target: 'http://127.0.0.1:8082', changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
