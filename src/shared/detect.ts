/**
 * Fingerprints a document as Canvas LMS by markup that every Canvas deployment ships,
 * regardless of the domain it is served from.
 *
 * Must stay self-contained (no imports, no outer references): the popup passes it to
 * `chrome.scripting.executeScript({ func })`, which serializes the function body.
 */
export function detectCanvas(): boolean {
  const strong = [
    // Canvas compiles per-institution theme CSS into this path.
    'link[href*="/dist/brandable_css/"]',
    // Root of the Canvas app shell.
    '#application.ic-app',
    // Smart banner for the "Canvas Student" iOS app.
    'meta[name="apple-itunes-app"][content*="480883488"]',
  ];
  if (strong.some((selector) => document.querySelector(selector))) return true;

  const weak = [
    '.ic-app-header',
    '#global_nav_tray_container',
    '.ic-Login',
    '#flash_message_holder',
    'script[src*="instructure"], link[href*="instructure"]',
    'script[src*="canvas-lms"], link[href*="canvas-lms"]',
  ];
  return weak.filter((selector) => document.querySelector(selector)).length >= 2;
}
