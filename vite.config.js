import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['avgh_logo.png', 'certificado-fondo-principal.jpg', 'certificado-fondo-anverso.jpg', 'firma-nombre-1.png', 'firma-nombre-2.png', 'afiliado-logo-1.png', 'afiliado-logo-2.png'],
      manifest: {
        name: 'AVGH App',
        short_name: 'AVGH',
        description: 'Plataforma de cursos, talleres y eventos de la AVGH',
        lang: 'es',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    assetsInlineLimit: 2000000
  },
  server: {
    watch: {
      // Los archivos temporales de Office (~$*.docx, *.tmp) bloquean el watcher
      // en Windows y tumban el servidor de desarrollo.
      ignored: ['**/*.tmp', '**/~$*']
    }
  }
})