import { PALETTES, type Palette } from './palettes';

/**
 * Preferences and site lists live under separate keys so that the background worker (which
 * records newly granted sites) and the UI (which edits preferences) never overwrite each other.
 */

export type UiTheme = 'system' | 'light' | 'dark';

export interface Preferences {
  enabled: boolean;
  palette: Palette;
  uiTheme: UiTheme;
}

export interface Sites {
  enabled: string[];
  /** Always a subset of `enabled`. */
  paused: string[];
}

export interface StoredState {
  preferences: Preferences;
  sites: Sites;
}

const DEFAULT_PREFERENCES: Preferences = { enabled: true, palette: 'graphite', uiTheme: 'system' };

const area = chrome.storage.sync;

const normalizePreferences = (value: unknown): Preferences => {
  const stored = (value ?? {}) as Partial<Preferences>;
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_PREFERENCES.enabled,
    palette: PALETTES.includes(stored.palette as Palette) ? (stored.palette as Palette) : DEFAULT_PREFERENCES.palette,
    uiTheme: ['system', 'light', 'dark'].includes(stored.uiTheme as string)
      ? (stored.uiTheme as UiTheme)
      : DEFAULT_PREFERENCES.uiTheme,
  };
};

const normalizeSites = (value: unknown): Sites => {
  const stored = (value ?? {}) as Partial<Sites>;
  const list = (input: unknown) =>
    Array.isArray(input) ? input.filter((v): v is string => typeof v === 'string') : [];
  return { enabled: list(stored.enabled), paused: list(stored.paused) };
};

export const loadState = async (): Promise<StoredState> => {
  const { preferences, sites } = await area.get(['preferences', 'sites']);
  return { preferences: normalizePreferences(preferences), sites: normalizeSites(sites) };
};

export const updatePreferences = async (patch: Partial<Preferences>): Promise<void> => {
  const { preferences } = await loadState();
  await area.set({ preferences: { ...preferences, ...patch } });
};

const updateSites = async (update: (sites: Sites) => Sites): Promise<void> => {
  const { sites } = await loadState();
  const next = update(sites);
  const enabled = [...new Set(next.enabled)].sort();
  const paused = [...new Set(next.paused)].filter((origin) => enabled.includes(origin)).sort();
  await area.set({ sites: { enabled, paused } });
};

export const addSites = (origins: string[]) =>
  updateSites((sites) => ({ ...sites, enabled: [...sites.enabled, ...origins] }));

export const removeSites = (origins: string[]) =>
  updateSites((sites) => ({ ...sites, enabled: sites.enabled.filter((o) => !origins.includes(o)) }));

export const setSitePaused = (origin: string, paused: boolean) =>
  updateSites((sites) => ({
    ...sites,
    paused: paused ? [...sites.paused, origin] : sites.paused.filter((o) => o !== origin),
  }));

/** Reload failures are ignored: they only occur once the extension context has been invalidated. */
export const onStateChange = (listener: (state: StoredState) => void): (() => void) => {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'sync' || !('preferences' in changes || 'sites' in changes)) return;
    loadState().then(listener, () => {});
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};

export const isActiveOn = (origin: string, { preferences, sites }: StoredState): boolean =>
  preferences.enabled && sites.enabled.includes(origin) && !sites.paused.includes(origin);
