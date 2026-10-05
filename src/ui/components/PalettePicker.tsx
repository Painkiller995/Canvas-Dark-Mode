import { createUniqueId, For, Show } from 'solid-js';
import { PALETTE_SWATCHES, PALETTES, type Palette } from '../../shared/palettes';
import { t } from '../lib/i18n';
import { CheckIcon } from './Icons';

const NAME_KEYS: Record<Palette, string> = {
  dim: 'paletteDim',
  graphite: 'paletteGraphite',
  midnight: 'paletteMidnight',
};

const HINT_KEYS: Record<Palette, string> = {
  dim: 'paletteDimHint',
  graphite: 'paletteGraphiteHint',
  midnight: 'paletteMidnightHint',
};

/** Miniature Canvas page rendered in the palette's colors. */
const Preview = (props: { palette: Palette }) => {
  const swatch = () => PALETTE_SWATCHES[props.palette];
  return (
    <svg class="palette-preview" viewBox="0 0 96 56" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="96" height="56" fill={swatch().page} />
      <rect width="14" height="56" fill={swatch().nav} />
      <circle cx="7" cy="9" r="3" fill={swatch().muted} opacity="0.7" />
      <rect x="4.5" y="18" width="5" height="5" rx="1.5" fill={swatch().muted} opacity="0.45" />
      <rect x="4.5" y="28" width="5" height="5" rx="1.5" fill={swatch().muted} opacity="0.45" />
      <rect x="22" y="9" width="34" height="4" rx="2" fill={swatch().text} />
      <rect x="22" y="18" width="66" height="30" rx="4" fill={swatch().surface} stroke={swatch().border} />
      <rect x="28" y="25" width="40" height="3" rx="1.5" fill={swatch().text} opacity="0.85" />
      <rect x="28" y="32" width="52" height="3" rx="1.5" fill={swatch().muted} opacity="0.7" />
      <rect x="28" y="39" width="30" height="3" rx="1.5" fill={swatch().muted} opacity="0.7" />
    </svg>
  );
};

interface PalettePickerProps {
  value: Palette;
  onChange: (palette: Palette) => void;
  disabled?: boolean;
  detailed?: boolean;
}

export const PalettePicker = (props: PalettePickerProps) => {
  const name = createUniqueId();
  return (
    <fieldset class="palettes" classList={{ detailed: props.detailed }} disabled={props.disabled}>
      <legend class="visually-hidden">{t('palette')}</legend>
      <For each={PALETTES}>
        {(palette) => (
          <label class="palette">
            <input
              type="radio"
              class="visually-hidden"
              name={name}
              value={palette}
              checked={props.value === palette}
              onChange={() => props.onChange(palette)}
            />
            <span class="palette-frame">
              <Preview palette={palette} />
              <Show when={props.value === palette}>
                <span class="palette-check">
                  <CheckIcon size={11} />
                </span>
              </Show>
            </span>
            <span class="palette-name">{t(NAME_KEYS[palette])}</span>
            <Show when={props.detailed}>
              <span class="palette-hint">{t(HINT_KEYS[palette])}</span>
            </Show>
          </label>
        )}
      </For>
    </fieldset>
  );
};
