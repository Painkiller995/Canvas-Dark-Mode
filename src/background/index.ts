import { originFromPattern, patternFor } from '../shared/sites';
import { addSites, loadState, removeSites } from '../shared/storage';
import { syncRegistrations } from './registration';

/** Drops sites whose host access was revoked, e.g. from the browser's site access menu. */
const pruneRevokedSites = async () => {
  const { sites } = await loadState();
  const granted = await Promise.all(
    sites.enabled.map((origin) => chrome.permissions.contains({ origins: [patternFor(origin)] }))
  );
  const revoked = sites.enabled.filter((_, i) => !granted[i]);
  if (revoked.length > 0) await removeSites(revoked);
};

/**
 * Every granted origin is a site to theme, whether granted from the popup or the browser's site
 * access menu. Recorded here because the popup may close while the browser prompt is open.
 */
const adoptGrantedSites = async (patterns: string[]) => {
  const origins = patterns.map(originFromPattern).filter((o): o is string => o !== null);
  if (origins.length > 0) await addSites(origins);
};

/** Palette and interface changes are handled by the pages themselves and don't affect registration. */
const affectsRegistration = (changes: Record<string, chrome.storage.StorageChange>) => {
  if ('sites' in changes) return true;
  const { oldValue, newValue } = changes.preferences ?? {};
  return oldValue?.enabled !== newValue?.enabled;
};

chrome.runtime.onInstalled.addListener(async () => {
  await pruneRevokedSites();
  await syncRegistrations();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegistrations();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && affectsRegistration(changes)) syncRegistrations();
});

chrome.permissions.onAdded.addListener(async ({ origins = [] }) => {
  await adoptGrantedSites(origins);
  // Re-granting a site that is already listed leaves storage unchanged, so sync explicitly.
  await syncRegistrations();
});

chrome.permissions.onRemoved.addListener(() => {
  pruneRevokedSites();
});
