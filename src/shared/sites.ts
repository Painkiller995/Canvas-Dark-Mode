/**
 * Canvas is self-hosted under countless domains, so no site is covered by default. Each one is
 * enabled from the popup, which requests host access to that single origin at runtime.
 */

/** Domains that only serve Canvas; the popup treats them as recognized even on pages without app markup. */
const CANVAS_DOMAINS = ['instructure.com', 'canvaslms.com'];

export const originOf = (url: string | undefined | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
};

export const hostOf = (origin: string): string => new URL(origin).hostname;

export const patternFor = (origin: string): string => `${origin}/*`;

export const originFromPattern = (pattern: string): string | null => {
  const match = /^https:\/\/([^/*]+)\/\*$/.exec(pattern);
  return match ? `https://${match[1]}` : null;
};

export const isCanvasDomain = (origin: string): boolean => {
  const host = hostOf(origin);
  return CANVAS_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
};
