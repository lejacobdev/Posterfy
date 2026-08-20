import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Mounts the same request handler the production Node server uses, so `npm run dev`
 * and `npm start` expose an identical `/api` surface.
 */
function apiDevServer(): Plugin {
  return {
    name: 'posterfy-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }
        const { handleApiRequest } = await server.ssrLoadModule('/server/api.js');
        const handled = await handleApiRequest(req, res);
        if (!handled) next();
      });
    },
  };
}

/**
 * GitHub Pages serves project sites from a sub-path, and its static host has no
 * SPA rewrite rule. Copying the shell to `404.html` makes deep links work.
 */
function spaFallback(): Plugin {
  return {
    name: 'posterfy-spa-fallback',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url));
      const index = join(dist, 'index.html');
      if (existsSync(index)) copyFileSync(index, join(dist, '404.html'));
    },
  };
}

/**
 * Stamps the build id into the service worker.
 *
 * Without this the cache name is a constant, so `activate` can never delete the
 * previous deploy's caches and clients can be pinned to stale assets forever.
 */
function serviceWorkerBuildId(): Plugin {
  return {
    name: 'posterfy-sw-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = join(fileURLToPath(new URL('./dist', import.meta.url)), 'sw.js');
      if (!existsSync(swPath)) return;
      const buildId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
      writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId));
    },
  };
}

export default defineConfig({
  // Set VITE_BASE_PATH=/Posterfy/ when deploying to a project sub-path.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), apiDevServer(), spaFallback(), serviceWorkerBuildId()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'router';
            if (id.includes('react')) return 'react';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/**/types.ts'],
    },
  },
});
