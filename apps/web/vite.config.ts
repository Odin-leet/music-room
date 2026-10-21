import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// The HOLY web app. Dev server on :5173 — the origin the API allows by
// default (WEB_ORIGINS in the root .env).
export default defineConfig({
  plugins: [react()],
  // The app version, sent to the API's action log (src/api/clientInfo.ts).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
