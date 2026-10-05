import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import manifest from './manifest.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };
import { contentScripts } from './scripts/vite-plugin-content-scripts';

export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox';

  // JSON imports widen literal types (e.g. gecko enums) to string, hence the cast.
  const finalManifest = {
    ...manifest,
    version: pkg.version,
    background: isFirefox ? { scripts: [manifest.background.service_worker], type: 'module' } : manifest.background,
  } as ManifestV3Export;

  return {
    plugins: [
      solidPlugin(),
      crx({ manifest: finalManifest, browser: isFirefox ? 'firefox' : 'chrome' }),
      contentScripts({
        scripts: {
          'content/theme.js': 'src/content/theme.ts',
        },
        styles: {
          'content/theme.css': 'src/content/theme.css',
        },
      }),
    ],
    build: {
      sourcemap: mode === 'development',
    },
    server: {
      port: 3000,
      strictPort: true,
      hmr: { port: 3000 },
      cors: { origin: [/^chrome-extension:\/\//] },
    },
  };
});
