import { createSignal, onCleanup } from 'solid-js';
import { loadState, onStateChange, type StoredState, type UiTheme } from '../../shared/storage';

export const useStoredState = () => {
  const [state, setState] = createSignal<StoredState>();
  loadState().then(setState);
  onCleanup(onStateChange(setState));
  return state;
};

/** `system` defers to `prefers-color-scheme` in CSS. */
export const applyUiTheme = (theme: UiTheme) => {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
};
