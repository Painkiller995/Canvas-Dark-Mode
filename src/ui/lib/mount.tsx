import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { loadState, onStateChange } from '../../shared/storage';
import { applyDocumentLocale } from './i18n';
import { applyUiTheme } from './state';
import '../styles.css';

/** Locale and theme are applied before the first render to avoid a flash. */
export const mount = async (app: () => JSX.Element) => {
  applyDocumentLocale();
  applyUiTheme((await loadState()).preferences.uiTheme);
  onStateChange(({ preferences }) => applyUiTheme(preferences.uiTheme));

  const root = document.getElementById('root');
  if (root) render(app, root);
};
