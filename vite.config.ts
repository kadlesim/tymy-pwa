import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Týmový manažer',
        short_name: 'Tymy',
        description: 'Aplikace pro správu sportovního týmu',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: '/icons/icon-96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: '/icons/icon-128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: '/icons/icon-144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: '/icons/icon-152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['sports', 'productivity'],
        screenshots: [],
        shortcuts: [
          {
            name: 'Události',
            short_name: 'Události',
            description: 'Přehled událostí a účast',
            url: '/events',
            icons: [{ src: '/icons/shortcut-events.png', sizes: '192x192' }]
          },
          {
            name: 'Chat',
            short_name: 'Chat',
            description: 'Týmové diskuze',
            url: '/discussions',
            icons: [{ src: '/icons/shortcut-chat.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Same-origin API (production default base path `/api`).
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cross-origin API hosts used during development / alternate deployments.
            urlPattern: ({ url }) => url.origin === 'http://dev.tymy.cz' || url.origin === 'https://tymy.cz',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\.(?:js|css|woff2?)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources'
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!api).*/]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['solid-js', '@solidjs/router']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // dev.tymy.cz serves HTTPS only and sends no CORS headers,
        // so all API traffic must be proxied through the dev server.
        target: 'https://dev.tymy.cz',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost',
        configure: (proxy: any) => {
          // The session is a PHPSESSID cookie, which JS cannot set.
          // In development we relay the stored session key as a cookie upstream.
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            const key = req.headers['x-session-key']
            if (typeof key === 'string' && key) {
              proxyReq.setHeader('cookie', `PHPSESSID=${key}`)
            }
          })
        }
      },
      '/user_pics': {
        target: 'https://dev.tymy.cz',
        changeOrigin: true,
        secure: true
      }
    }
  }
})