// vite.config.js
import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { VitePWA }      from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType:  'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name:             'Abdulmula Fashion ERP',
        short_name:       'AF ERP',
        description:      'Premium POS & ERP — Abdulmula Fashion, Juba, South Sudan',
        theme_color:      '#111111',
        background_color: '#111111',
        display:          'standalone',
        orientation:      'portrait-primary',
        start_url:        '/',
        scope:            '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'      },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'POS',       url: '/pos',       icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Dashboard', url: '/dashboard', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/products/,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName:         'products-cache',
              expiration:        { maxEntries: 500, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/api\/customers/,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName:  'customers-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /\/api\/dashboard/,
            handler:    'NetworkFirst',
            options:    { cacheName: 'dashboard-cache', networkTimeoutSeconds: 5 }
          }
        ],
        globPatterns:          ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback:      'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting:           true,
        clientsClaim:          true
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
});
