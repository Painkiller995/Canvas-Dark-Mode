import { readColor } from './color';

/**
 * Much of Canvas, and the tools embedded in it, uses generated class names that change between
 * releases. Instead of chasing selectors, the engine tags elements by their computed colors and
 * passes the original color to CSS, which remaps it against the palette, so palette switches
 * never need a rescan.
 */

const ATTR = 'data-cdm';
const OFF_ATTR = 'data-cdm-off';

const Token = {
  Background: 'bg',
  Text: 'fg',
  Border: 'bd',
  Line: 'ln',
  Gradient: 'gr',
  Hover: 'hv',
} as const;

type Token = (typeof Token)[keyof typeof Token];

const SOURCE_VAR: Partial<Record<Token, string>> = {
  [Token.Background]: '--cdm-src-bg',
  [Token.Text]: '--cdm-src-fg',
  [Token.Border]: '--cdm-src-bd',
  [Token.Hover]: '--cdm-src-hv',
};

/** OKLab lightness thresholds. Mid-tones in between are brand colors and are left alone. */
const LIGHT_SURFACE = 0.8;
const LIGHT_BORDER = 0.7;
const DARK_BORDER = 0.22;
const DARK_TEXT = 0.62;
const MIN_ALPHA = 0.1;

const OPAQUE_TAGS = new Set([
  'IMG',
  'PICTURE',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'IFRAME',
  'FRAME',
  'OBJECT',
  'EMBED',
  'SCRIPT',
  'STYLE',
  'LINK',
  'META',
  'TEMPLATE',
  'NOSCRIPT',
  'HEAD',
]);

const SVG_NS = 'http://www.w3.org/2000/svg';
const SLICE_SIZE = 300;
const FRAME_BUDGET_MS = 8;
const HOVER_DEPTH = 4;
/** Bound on how many descendants a single class change may re-evaluate. */
const RESTYLE_LIMIT = 400;
const BACKGROUND_FLUSH_MS = 150;
const RESCAN_DELAY_MS = 120;

type Decision = Array<[Token, string]>;

/**
 * Elements we must never annotate: media, SVG internals, and editable content.
 * Editable regions matter most: attributes added there would be saved into the user's submission.
 */
const isExcluded = (el: Element): boolean =>
  OPAQUE_TAGS.has(el.tagName) || el.namespaceURI === SVG_NS || (el as HTMLElement).isContentEditable === true;

const isLightSurface = (value: string) => {
  const color = readColor(value);
  return color !== null && color.alpha >= MIN_ALPHA && color.lightness >= LIGHT_SURFACE;
};

/**
 * Returns the first color stop of a gradient whose stops are all light and opaque enough to read as
 * a surface. Gradients with transparent stops are fades layered over content and are left alone,
 * as are any containing images.
 */
const lightGradientStop = (backgroundImage: string): string | null => {
  if (!backgroundImage.includes('gradient(') || backgroundImage.includes('url(')) return null;
  const stops = backgroundImage.match(/(?:rgba?|color|oklch|oklab)\([^)]*\)/g);
  return stops?.every(isLightSurface) ? stops[0] : null;
};

const isDarkText = (value: string) => {
  const color = readColor(value);
  return color !== null && color.lightness < DARK_TEXT;
};

const inspect = (el: Element): Decision => {
  const style = getComputedStyle(el);
  const decision: Decision = [];

  const gradientStop = lightGradientStop(style.backgroundImage);
  if (gradientStop) decision.push([Token.Gradient, gradientStop], [Token.Background, gradientStop]);
  else if (isLightSurface(style.backgroundColor)) decision.push([Token.Background, style.backgroundColor]);

  // Only tag where a dark color is declared; descendants then inherit the remapped value.
  if (isDarkText(style.color)) {
    const parent = el.parentElement;
    if (!parent || getComputedStyle(parent).color !== style.color) decision.push([Token.Text, style.color]);
  }

  for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
    if (style[`border${side}Style`] === 'none' || Number.parseFloat(style[`border${side}Width`]) === 0) continue;
    const value = style[`border${side}Color`];
    const border = readColor(value);
    if (border && border.lightness >= LIGHT_BORDER) decision.push([Token.Border, value]);
    else if (border && border.alpha >= MIN_ALPHA && border.lightness < DARK_BORDER) decision.push([Token.Line, value]);
    break;
  }

  return decision;
};

/**
 * Marks an element under evaluation; the stylesheet suspends its transitions. Otherwise a
 * `transition` on the page would report in-between colors while an element is re-read, and would
 * visibly fade it from light to dark once remapped.
 */
const STILL = 'still';

const apply = (el: Element, decision: Decision) => {
  const { style } = el as HTMLElement;
  if (!style) return;
  for (const [token, value] of decision) {
    const property = SOURCE_VAR[token];
    if (property) style.setProperty(property, value);
  }
  el.setAttribute(ATTR, [...decision.map(([token]) => token), STILL].join(' '));
};

const tokensOf = (el: Element) => el.getAttribute(ATTR)?.split(' ') ?? [];

export interface Engine {
  start(): void;
  stop(): void;
}

export const createEngine = (doc: Document): Engine => {
  const pending = new Set<Element>();
  let frame = 0;
  let fallback = 0;
  let running = false;

  const walk = (start: Element, limit = Number.POSITIVE_INFINITY) => {
    if (isExcluded(start)) return;
    const walker = doc.createTreeWalker(start, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => (isExcluded(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let count = 0;
    for (let node: Node | null = start; node && count < limit; node = walker.nextNode(), count++) {
      pending.add(node as Element);
    }
  };

  const still = new Set<Element>();
  let releaseFrame = 0;
  let releaseFallback = 0;
  const release = () => {
    cancelAnimationFrame(releaseFrame);
    clearTimeout(releaseFallback);
    releaseFrame = releaseFallback = 0;
    for (const el of still) {
      const tokens = tokensOf(el).filter((token) => token !== STILL);
      if (tokens.length > 0) el.setAttribute(ATTR, tokens.join(' '));
      else el.removeAttribute(ATTR);
    }
    still.clear();
  };

  /** Reads and writes are batched so each slice costs only a few style recalculations. */
  const evaluate = (batch: Element[]) => {
    for (const el of batch) el.setAttribute(ATTR, STILL);
    const decisions = batch.map(inspect);
    for (let i = 0; i < batch.length; i++) apply(batch[i], decisions[i]);

    // Text matching its parent's dark color was assumed to be inherited. With ancestors now
    // remapped, anything still dark declares that color itself and needs its own remap.
    for (let i = 0; i < batch.length; i++) {
      const decision = decisions[i];
      if (decision.some(([token]) => token === Token.Text)) continue;
      const { color } = getComputedStyle(batch[i]);
      if (isDarkText(color)) apply(batch[i], [...decision, [Token.Text, color]]);
    }

    // Commit the final colors while transitions are suspended, and restore them next frame.
    for (const el of batch) {
      getComputedStyle(el).color;
      still.add(el);
    }
    // Hidden tabs never render a frame, so a timer releases them; nothing animates there anyway.
    if (releaseFrame === 0) {
      releaseFrame = requestAnimationFrame(release);
      releaseFallback = window.setTimeout(release, BACKGROUND_FLUSH_MS);
    }
  };

  /**
   * Elements are judged by their computed colors, which are only final once the page's stylesheets
   * have loaded. Canvas loads and injects much of its CSS after the markup it styles, so every
   * stylesheet arrival triggers a full, debounced re-check.
   */
  let rescanTimer = 0;
  const requestRescan = () => {
    clearTimeout(rescanTimer);
    rescanTimer = window.setTimeout(() => {
      if (!doc.body) return;
      walk(doc.body);
      schedule();
    }, RESCAN_DELAY_MS);
  };

  const isStylesheet = (node: Node) =>
    node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.relList.contains('stylesheet'));

  const absorb = (records: MutationRecord[]) => {
    for (const record of records) {
      if (record.type === 'childList') {
        if (isStylesheet(record.target)) requestRescan();
        record.addedNodes.forEach((node) => {
          if (isStylesheet(node)) {
            requestRescan();
            node.addEventListener('load', requestRescan, { once: true });
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walk(node as Element);
          }
        });
      } else if (record.target.nodeType === Node.ELEMENT_NODE) {
        const target = record.target as Element;
        // Class changes can restyle descendants; inline style changes only affect the element itself.
        if (record.attributeName === 'class') walk(target, RESTYLE_LIMIT);
        else if (!isExcluded(target)) pending.add(target);
      }
    }
  };

  const flush = () => {
    cancelAnimationFrame(frame);
    clearTimeout(fallback);
    frame = fallback = 0;
    absorb(observer.takeRecords());

    const deadline = performance.now() + FRAME_BUDGET_MS;
    let batch: Element[] = [];
    for (const el of pending) {
      pending.delete(el);
      if (el.isConnected) batch.push(el);
      if (batch.length === SLICE_SIZE) {
        evaluate(batch);
        batch = [];
        if (performance.now() > deadline) break;
      }
    }
    if (batch.length > 0) evaluate(batch);

    // Discard the inline-style mutations we just caused ourselves.
    observer.takeRecords();
    if (pending.size > 0) schedule();
  };

  /**
   * Flushing on the next animation frame lands before paint, so new content never flashes light.
   * Animation frames don't run in background tabs, so a timer finishes the work there too.
   */
  const schedule = () => {
    if (!running || frame !== 0) return;
    frame = requestAnimationFrame(flush);
    fallback = window.setTimeout(flush, BACKGROUND_FLUSH_MS);
  };

  const observer = new MutationObserver((records) => {
    absorb(records);
    schedule();
  });

  /**
   * Hover colors only exist while hovered, so they're sampled on demand and applied
   * through a `:hover`-scoped rule, keeping the element's resting state untouched.
   */
  let hoverFrame = 0;
  const onPointerOver = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || hoverFrame !== 0) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      // Keep the page's pending mutations; only the ones caused below are discarded.
      absorb(observer.takeRecords());
      schedule();
      let el: Element | null = target;
      for (let depth = 0; el && el !== doc.body && depth < HOVER_DEPTH; depth++, el = el.parentElement) {
        if (isExcluded(el)) return;
        const tokens = tokensOf(el);
        if (tokens.includes(Token.Background) || tokens.includes(Token.Hover)) continue;
        const { backgroundColor } = getComputedStyle(el);
        if (!isLightSurface(backgroundColor)) continue;
        (el as HTMLElement).style?.setProperty('--cdm-src-hv', backgroundColor);
        el.setAttribute(ATTR, [...tokens, Token.Hover].join(' '));
      }
      observer.takeRecords();
    });
  };

  return {
    start() {
      if (running) return;
      running = true;
      doc.documentElement?.removeAttribute(OFF_ATTR);
      observer.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
      doc.addEventListener('pointerover', onPointerOver, { capture: true, passive: true });
      doc.addEventListener('DOMContentLoaded', requestRescan);
      window.addEventListener('load', requestRescan);
      if (doc.body) walk(doc.body);
      schedule();
    },
    stop() {
      if (!running) return;
      running = false;
      doc.documentElement?.setAttribute(OFF_ATTR, '');
      observer.disconnect();
      doc.removeEventListener('pointerover', onPointerOver, { capture: true });
      doc.removeEventListener('DOMContentLoaded', requestRescan);
      window.removeEventListener('load', requestRescan);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hoverFrame);
      clearTimeout(fallback);
      clearTimeout(rescanTimer);
      release();
      frame = hoverFrame = fallback = rescanTimer = 0;
      pending.clear();
    },
  };
};
