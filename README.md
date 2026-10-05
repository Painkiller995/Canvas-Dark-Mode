# Canvas Dark Mode

A dark theme for Canvas LMS that works wherever Canvas is hosted: Instructure's cloud, a school's own domain, or the tools embedded in it, such as Panopto.

## Features

- **Works on any domain.** The popup recognizes Canvas wherever it is hosted and enables it in one click. Tools used inside Canvas, such as Panopto, can be enabled the same way.
- **No site access at install.** The extension requests access to one site at a time, only when you enable it there.
- **Adaptive theming.** Canvas renders much of its UI with component libraries whose class names change between releases. Instead of chasing selectors, the theme engine reads computed colors and remaps light surfaces, dark text and light borders. This also covers pages and tools the stylesheet has never seen.
- **No flash of light content.** The stylesheet is injected by the browser at `document_start`, and new content is restyled before the next paint.
- **Safe for coursework.** Editable content, such as the rich content editor, is never modified, so nothing the theme does can end up in a submission.
- **Three palettes.** Dim, Graphite and Midnight (OLED). Switching is instant, with no page reload.
- **Per-site control.** Pause any site from the popup, and manage sites from the settings page.
- **Private by design.** No data collection and no network requests.

## How it works

```
src/
  background/        Service worker: keeps content-script registrations in sync with
                     settings and granted permissions, and themes already-open tabs.
  content/
    theme.css        Palette tokens, Canvas-specific styling, and the remap rules.
    theme.ts         Entry point injected into covered frames; manages the engine lifecycle.
    engine.ts        Adaptive engine: tags elements whose computed colors break a dark theme.
  shared/            Storage, site helpers, palettes, Canvas fingerprinting.
  ui/                Popup and settings page (SolidJS).
scripts/
  vite-plugin-content-scripts.ts   Bundles content scripts as standalone IIFE files.
  generate-icons.mjs               Renders the icon set (no dependencies).
store/               Store listing assets: description, 512px icon, promo images, screenshot.
```

**Permissions.** At install the extension requires only `storage`, `scripting` and `activeTab`, none of which grant access to any site. `https://*/*` is declared as an *optional* host permission, so access is requested per origin, such as `https://canvas.school.edu/*`, when the user enables a site. `activeTab` lets the popup check whether the current page is Canvas before any access is granted.

**Coverage.** The content script is registered at runtime with `chrome.scripting.registerContentScripts`, matching only the enabled origins. Enabling a site never requires an extension update. Pausing a site adds an `excludeMatches` entry, and turning the extension off unregisters everything. Access revoked from the browser's site menu removes the site, and access granted there adds it.

**Theming.** Every rule in `theme.css` is scoped to `:root:not([data-cdm-off])`. The engine passes each element's original color to CSS through a custom property, for example `--cdm-src-bg`, and CSS remaps it against the active palette with relative color syntax (`oklch(from …)`). Palette changes therefore apply instantly and never need a rescan.

**Detection.** When the popup opens, `shared/detect.ts` fingerprints Canvas by markup every deployment ships, such as the `brandable_css` stylesheet path and the `#application.ic-app` shell, regardless of hostname.

## Development

```bash
pnpm install
pnpm build           # Production build into dist/
pnpm build:firefox   # Firefox build into dist/
pnpm build:watch     # Unminified rebuild on change
pnpm start           # Dev server with HMR for the popup and settings page
pnpm typecheck
pnpm lint
pnpm icons           # Regenerate the icon set after changing the brand mark
```

Load `dist/` from `chrome://extensions` with **Developer mode** enabled, using **Load unpacked**.

Requires Chrome 120 or later. The theme relies on CSS nesting and relative color syntax.

## Localization

English, German and Arabic (right-to-left) live in `public/_locales/`. Every locale must define the same keys as `en`.

## License

MIT © Painkiller995. See [LICENSE](LICENSE).
