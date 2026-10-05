import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { transform } from 'lightningcss';
import { build, type Plugin, type ResolvedConfig, type Rolldown } from 'vite';

/**
 * Bundles content scripts as standalone IIFE files at fixed paths.
 *
 * The background worker registers them with `chrome.scripting.registerContentScripts` and injects
 * them with `executeScript`, which need self-contained classic scripts at known paths. CRXJS's
 * content-script loader instead imports ES modules asynchronously, which would delay the theme
 * engine past first paint and expose the files to every site as web-accessible resources.
 */

/** Matches `minimum_chrome_version`, so nesting and relative colors are kept as written. */
const STYLE_TARGETS = { chrome: 120 << 16 };

export interface ContentScriptsOptions {
  /** Output path → TypeScript entry, e.g. `{ 'content/theme.js': 'src/content/theme.ts' }`. */
  scripts: Record<string, string>;
  /** Output path → stylesheet, minified in production. */
  styles: Record<string, string>;
}

interface Emitted {
  fileName: string;
  source: string;
  watchFiles: string[];
}

export const contentScripts = ({ scripts, styles }: ContentScriptsOptions): Plugin => {
  let config: ResolvedConfig;
  let emitted: Emitted[] = [];

  const bundleScript = async (fileName: string, entry: string): Promise<Emitted> => {
    const isDev = config.mode === 'development';
    const result = await build({
      configFile: false,
      logLevel: 'warn',
      mode: config.mode,
      root: config.root,
      build: {
        write: false,
        emptyOutDir: false,
        copyPublicDir: false,
        minify: !isDev,
        sourcemap: isDev ? 'inline' : false,
        lib: {
          entry: resolve(config.root, entry),
          formats: ['iife'],
          name: 'canvasDarkMode',
          fileName: () => fileName,
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
    const chunk = outputs.flatMap(({ output }) => output).find((item) => item.type === 'chunk');
    if (!chunk || chunk.type !== 'chunk') throw new Error(`No output produced for ${entry}`);
    return { fileName, source: chunk.code, watchFiles: chunk.moduleIds.filter((id) => !id.includes('\0')) };
  };

  const bundleStyle = async (fileName: string, entry: string): Promise<Emitted> => {
    const path = resolve(config.root, entry);
    const source = await readFile(path);
    if (config.mode === 'development') return { fileName, source: source.toString('utf8'), watchFiles: [path] };
    const { code } = transform({ filename: path, code: source, minify: true, targets: STYLE_TARGETS });
    return { fileName, source: Buffer.from(code).toString('utf8'), watchFiles: [path] };
  };

  const bundleAll = () =>
    Promise.all([
      ...Object.entries(scripts).map(([fileName, entry]) => bundleScript(fileName, entry)),
      ...Object.entries(styles).map(([fileName, entry]) => bundleStyle(fileName, entry)),
    ]);

  return {
    name: 'canvas-dark-mode:content-scripts',

    configResolved(resolved) {
      config = resolved;
    },

    async buildStart() {
      if (config.command !== 'build') return;
      emitted = await bundleAll();
      for (const file of emitted.flatMap(({ watchFiles }) => watchFiles)) this.addWatchFile(file);
    },

    generateBundle() {
      for (const { fileName, source } of emitted) this.emitFile({ type: 'asset', fileName, source });
    },

    // The dev server never runs `generateBundle`, so the files are written into the folder CRXJS serves.
    // Writing waits briefly after startup because CRXJS clears that folder when the server starts.
    configureServer(server) {
      const outDir = resolve(config.root, config.build.outDir);
      let watched = new Set<string>();

      const writeAll = async () => {
        try {
          const files = await bundleAll();
          watched = new Set(files.flatMap(({ watchFiles }) => watchFiles.map((file) => resolve(file))));
          await Promise.all(
            files.map(async ({ fileName, source }) => {
              const target = resolve(outDir, fileName);
              await mkdir(dirname(target), { recursive: true });
              await writeFile(target, source);
            })
          );
        } catch (error) {
          config.logger.error(`[content-scripts] ${(error as Error).message}`);
        }
      };

      server.httpServer?.once('listening', () => setTimeout(writeAll, 500));
      server.watcher.on('change', (file) => {
        if (watched.has(resolve(file))) writeAll();
      });
    },
  };
};
