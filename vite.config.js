import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

// <meta name="commit"> con el hash del build: permite ver qué versión sirve el
// dominio (Ver código fuente / document.querySelector) — clave para diagnosticar
// cachés viejas de SW/CDN. Normado en CONVENCIONES-APPS §3.
function commitMeta () {
  let hash = 'dev'
  try { hash = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* sin git */ }
  return {
    name: 'commit-meta',
    transformIndexHtml: (html) =>
      html.replace('</head>', `  <meta name="commit" content="${hash}" />\n  </head>`),
  }
}

export default defineConfig(({ command }) => ({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    // Los `dotrino-*` son Web Components (custom elements), no componentes Vue.
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dotrino-') } } }),
    // HTTPS autofirmado en desarrollo (contexto seguro para portapapeles / WebRTC).
    basicSsl(),
    commitMeta(),
    VitePWA({
      // serve (dev): SW autodestructivo → contenido siempre fresco.
      // build (prod): SW real, instalable y offline.
      selfDestroying: command === 'serve',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'og.jpg', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'Mi IP',
        short_name: 'Mi IP',
        description: 'Descubre tu IP pública y datos de tu conexión, sin anuncios ni rastreo. Tu información, en tu servidor.',
        lang: 'es',
        theme_color: '#0e1116',
        background_color: '#0e1116',
        display: 'standalone',
        start_url: './',
        scope: './',
        launch_handler: { client_mode: 'focus-existing' },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Navegación network-first (los deploys se ven de inmediato).
        navigateFallback: null,
      },
    }),
  ],
  server: {
    host: true,
    port: 3140,
    allowedHosts: ['.ts.net', '.local', 'localhost'],
  },
}))
