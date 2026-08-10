import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // ─── API proxy ────────────────────────────────────────────────────────
      // Forwards /api/* and /ws/* to the Spring Boot backend on :8080.
      //
      // WHY: Without this, every request that carries an Authorization header
      // is cross-origin (frontend :3000 → backend :8080) and the browser sends
      // an OPTIONS preflight first.  The backend handles it correctly, but in
      // dev you see lots of OPTIONS calls with content-length: 0 in the Network
      // tab and the console can log CORS noise.
      //
      // With the proxy the browser sees everything on the same origin (:3000),
      // so no preflight is sent and the "content-length: 0 / white screen"
      // confusion disappears entirely.
      //
      // NOTE: CORS config in SecurityConfig.java is still needed for production
      // where the frontend is hosted separately from the backend.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,           // proxy WebSocket (STOMP/SockJS) connections too
      },
    },
  },
});
