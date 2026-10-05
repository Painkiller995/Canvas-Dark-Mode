import { CONTENT_FILES, ENGINE_FLAG } from '../shared/runtime';
import { originOf, patternFor } from '../shared/sites';
import { loadState, type StoredState } from '../shared/storage';

const THEME_SCRIPT_ID = 'theme';

type Registration = chrome.scripting.RegisteredContentScript;

const themeRegistration = ({ preferences, sites }: StoredState): Registration | null => {
  if (!preferences.enabled || sites.enabled.length === 0) return null;
  return {
    id: THEME_SCRIPT_ID,
    matches: sites.enabled.map(patternFor),
    excludeMatches: sites.paused.map(patternFor),
    css: [CONTENT_FILES.themeStyle],
    js: [CONTENT_FILES.themeScript],
    runAt: 'document_start',
    allFrames: true,
    // Also covers about:blank and srcdoc frames, e.g. the rich content editor.
    matchOriginAsFallback: true,
    persistAcrossSessions: true,
  };
};

const register = async (registration: Registration) => {
  try {
    await chrome.scripting.registerContentScripts([registration]);
  } catch {
    // `matchOriginAsFallback` is Chromium-only; Firefox uses `matchAboutBlank` instead.
    const { matchOriginAsFallback: _, ...rest } = registration;
    await chrome.scripting.registerContentScripts([{ ...rest, matchAboutBlank: true }]);
  }
};

const injectIntoOpenTabs = async (state: StoredState, matches: string[]) => {
  const tabs = await chrome.tabs.query({ url: matches });
  await Promise.all(
    tabs.map(async ({ id: tabId, url }) => {
      const origin = originOf(url);
      if (tabId === undefined || !origin || state.sites.paused.includes(origin)) return;

      try {
        const probes = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: (flag: string) => {
            const engine = (globalThis as unknown as Record<string, { isAlive?: () => boolean } | undefined>)[flag];
            return { running: engine?.isAlive?.() === true, url: location.href };
          },
          args: [ENGINE_FLAG],
        });

        const frameIds = probes
          .filter(({ result }) => {
            if (!result || result.running) return false;
            const frameOrigin = originOf(result.url);
            // Frames without their own origin (about:blank, srcdoc) inherit the tab's.
            return frameOrigin === null || state.sites.enabled.includes(frameOrigin);
          })
          .map(({ frameId }) => frameId);

        if (frameIds.length === 0) return;
        await chrome.scripting.insertCSS({ target: { tabId, frameIds }, files: [CONTENT_FILES.themeStyle] });
        await chrome.scripting.executeScript({ target: { tabId, frameIds }, files: [CONTENT_FILES.themeScript] });
      } catch {
        // Tab closed, discarded, showing an error page, or otherwise not scriptable.
      }
    })
  );
};

const sync = async () => {
  const state = await loadState();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [THEME_SCRIPT_ID] });
  if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [THEME_SCRIPT_ID] });

  const registration = themeRegistration(state);
  if (!registration) return;
  await register(registration);
  await injectIntoOpenTabs(state, registration.matches ?? []);
};

let pending: Promise<void> = Promise.resolve();

/** Serialized so bursts of storage or permission events can't interleave. */
export const syncRegistrations = (): Promise<void> => {
  pending = pending.then(sync).catch((error) => console.error('[Canvas Dark Mode] Sync failed', error));
  return pending;
};
