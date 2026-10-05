import { ENGINE_FLAG } from '../shared/runtime';
import { originOf } from '../shared/sites';
import { isActiveOn, loadState, onStateChange, type StoredState } from '../shared/storage';
import { createEngine, type Engine } from './engine';

/**
 * The stylesheet is injected alongside this script and applies immediately, so the page never
 * paints light; this script then confirms the frame should be themed and runs the engine.
 */

interface EngineHandle {
  isAlive(): boolean;
  dispose(): void;
}

const scope = globalThis as unknown as Record<string, EngineHandle | undefined>;

const isContextAlive = () => {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
};

/** The top-level page decides pausing for every frame in it, including embedded tools. */
const topOrigin = (): string | null => {
  const ancestors = location.ancestorOrigins;
  return originOf(ancestors?.length ? `${ancestors[ancestors.length - 1]}/` : location.href);
};

const boot = () => {
  const engine: Engine = createEngine(document);
  const frameOrigin = originOf(location.href) ?? topOrigin();
  const pageOrigin = topOrigin() ?? frameOrigin;

  const render = (state: StoredState) => {
    if (!isContextAlive()) return;
    document.documentElement?.setAttribute('data-cdm-palette', state.preferences.palette);
    const active =
      frameOrigin !== null &&
      isActiveOn(frameOrigin, state) &&
      (pageOrigin === null || !state.sites.paused.includes(pageOrigin));
    if (active) engine.start();
    else engine.stop();
  };

  // Registration already implies the frame is covered; start now and correct once settings load.
  engine.start();
  loadState().then(render, () => engine.stop());
  const unsubscribe = onStateChange(render);

  scope[ENGINE_FLAG] = {
    isAlive: isContextAlive,
    dispose() {
      engine.stop();
      try {
        unsubscribe();
      } catch {
        // The extension context that owned the listener is already gone.
      }
    },
  };
};

// After an extension update the previous instance is orphaned; replace it instead of running twice.
const previous = scope[ENGINE_FLAG];
if (!previous?.isAlive()) {
  previous?.dispose();
  boot();
}
