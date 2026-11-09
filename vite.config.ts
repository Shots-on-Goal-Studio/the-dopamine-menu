// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from 'vite';
import path from 'node:path';

// Populate server runtime env only; the preset still exposes only VITE_* to browsers.
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), ''));

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // Modern consumers use extensionless subpaths; resolve them before the
        // root alias so they never become nonexistent entities/decode files.
        'entities/decode': path.resolve('node_modules/entities/lib/esm/decode.js'),
        'entities/encode': path.resolve('node_modules/entities/lib/esm/encode.js'),
        'entities/escape': path.resolve('node_modules/entities/lib/esm/escape.js'),
        'entities/lib/decode.js': path.resolve('node_modules/entities/lib/decode.js'),
        'entities/lib/encode.js': path.resolve('node_modules/entities/lib/encode.js'),
        entities: path.resolve('node_modules/entities'),
      },
    },
    optimizeDeps: {
      exclude: ["zod"],
    },
  },
});
