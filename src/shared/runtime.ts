/** Paths of the standalone content-script bundles emitted by the `contentScripts` Vite plugin. */
export const CONTENT_FILES = {
  themeScript: 'content/theme.js',
  themeStyle: 'content/theme.css',
} as const;

/** Set on the isolated world of every frame the theme engine runs in. */
export const ENGINE_FLAG = '__canvasDarkModeEngine';
