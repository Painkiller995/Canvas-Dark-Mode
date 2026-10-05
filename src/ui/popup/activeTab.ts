import { detectCanvas } from '../../shared/detect';
import { hostOf, isCanvasDomain, originOf, patternFor } from '../../shared/sites';
import type { StoredState } from '../../shared/storage';

export type ActiveTab =
  | { kind: 'none' }
  | { kind: 'site'; origin: string; host: string; hasAccess: boolean; looksLikeCanvas: boolean };

/** Runs the Canvas fingerprint in the tab. `activeTab` grants the access for this while the popup is open. */
const probeCanvas = async (tabId: number): Promise<boolean> => {
  try {
    const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: detectCanvas });
    return frame?.result === true;
  } catch {
    return false;
  }
};

export const readActiveTab = async (): Promise<ActiveTab> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = originOf(tab?.url);
  if (tab?.id === undefined || !origin) return { kind: 'none' };

  const [hasAccess, fingerprinted] = await Promise.all([
    chrome.permissions.contains({ origins: [patternFor(origin)] }),
    probeCanvas(tab.id),
  ]);
  return {
    kind: 'site',
    origin,
    host: hostOf(origin),
    hasAccess,
    looksLikeCanvas: fingerprinted || isCanvasDomain(origin),
  };
};

export type SiteStatus = 'none' | 'off' | 'active' | 'paused' | 'needs-access' | 'detected' | 'unrecognized';

export const siteStatus = (tab: ActiveTab, state: StoredState): SiteStatus => {
  if (tab.kind === 'none') return 'none';
  if (!state.preferences.enabled) return 'off';
  if (!state.sites.enabled.includes(tab.origin)) return tab.looksLikeCanvas ? 'detected' : 'unrecognized';
  if (!tab.hasAccess) return 'needs-access';
  return state.sites.paused.includes(tab.origin) ? 'paused' : 'active';
};
