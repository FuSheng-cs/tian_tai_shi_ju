/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '天台十句',
        short_name: '天台十句',
        theme_color: '#fafafa',
        background_color: '#fafafa',
        icons: [
          { src: '/assets/images/pixel_city_20261104/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/images/pixel_city_20261104/app-icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
})
