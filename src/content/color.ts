/** Perceptual lightness (OKLab L, 0–1) and alpha of a computed CSS color. */
export interface ColorInfo {
  lightness: number;
  alpha: number;
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

const oklabLightness = (r: number, g: number, b: number) => {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
};

const parseAlpha = (value: string | undefined) => {
  if (value === undefined) return 1;
  return value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
};

const parse = (color: string): ColorInfo | null => {
  const match = /^(rgba?|color|oklch|oklab)\((.*)\)$/.exec(color.trim());
  if (!match) return null;

  const [, fn, body] = match;
  const [channelPart, alphaPart] = body.split('/');
  const parts = channelPart.replace(/,/g, ' ').trim().split(/\s+/);

  if (fn === 'rgb' || fn === 'rgba') {
    // Legacy comma syntax carries alpha as a fourth channel.
    const [r, g, b, legacyAlpha] = parts.map(Number.parseFloat);
    if ([r, g, b].some(Number.isNaN)) return null;
    const alpha = alphaPart !== undefined ? parseAlpha(alphaPart.trim()) : (legacyAlpha ?? 1);
    return { lightness: oklabLightness(r / 255, g / 255, b / 255), alpha };
  }

  if (fn === 'color') {
    const [space, ...channels] = parts;
    if (space !== 'srgb') return null;
    const [r, g, b] = channels.map(Number.parseFloat);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { lightness: oklabLightness(r, g, b), alpha: parseAlpha(alphaPart?.trim()) };
  }

  const lightness = parts[0].endsWith('%') ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0]);
  return Number.isNaN(lightness) ? null : { lightness, alpha: parseAlpha(alphaPart?.trim()) };
};

const cache = new Map<string, ColorInfo | null>();
const CACHE_LIMIT = 512;

/** Returns null for unsupported or fully transparent colors. */
export const readColor = (color: string): ColorInfo | null => {
  let info = cache.get(color);
  if (info === undefined) {
    info = parse(color);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(color, info);
  }
  return info && info.alpha > 0 ? info : null;
};
