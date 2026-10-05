import { Show } from 'solid-js';
import { type StoredState, type UiTheme, updatePreferences } from '../../shared/storage';
import { BrandMark, InfoIcon } from '../components/Icons';
import { PalettePicker } from '../components/PalettePicker';
import { Segmented } from '../components/Segmented';
import { Switch } from '../components/Switch';
import { t } from '../lib/i18n';
import { useStoredState } from '../lib/state';
import { SitesPanel } from './SitesPanel';

const UI_THEMES: ReadonlyArray<{ value: UiTheme; label: string }> = [
  { value: 'system', label: t('themeSystem') },
  { value: 'light', label: t('themeLight') },
  { value: 'dark', label: t('themeDark') },
];

const OptionsBody = (props: { state: StoredState }) => {
  const prefs = () => props.state.preferences;

  return (
    <main class="options">
      <header class="options-header">
        <BrandMark size={40} />
        <div>
          <h1 class="options-title">{t('appName')}</h1>
          <p class="options-subtitle">{t('settingsTitle')}</p>
        </div>
      </header>

      <section class="panel">
        <h2 class="panel-title">{t('sectionGeneral')}</h2>
        <div class="row">
          <div class="row-text">
            <span class="row-title">{t('darkMode')}</span>
            <span class="row-hint">{t('generalEnabledHint')}</span>
          </div>
          <Switch
            checked={prefs().enabled}
            label={t('darkMode')}
            onChange={(enabled) => updatePreferences({ enabled })}
          />
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">{t('sectionAppearance')}</h2>
        <div class="panel-block">
          <span class="row-title">{t('palette')}</span>
          <PalettePicker detailed value={prefs().palette} onChange={(palette) => updatePreferences({ palette })} />
        </div>
        <div class="row">
          <div class="row-text">
            <span class="row-title">{t('interfaceTheme')}</span>
            <span class="row-hint">{t('interfaceThemeHint')}</span>
          </div>
          <Segmented
            label={t('interfaceTheme')}
            value={prefs().uiTheme}
            options={UI_THEMES}
            onChange={(uiTheme) => updatePreferences({ uiTheme })}
          />
        </div>
      </section>

      <SitesPanel sites={props.state.sites} />

      <footer class="options-footer">
        <span class="options-footer-note">
          <InfoIcon size={14} />
          {t('autoSaveInfo')}
        </span>
        <span>{t('version', chrome.runtime.getManifest().version)}</span>
      </footer>
    </main>
  );
};

export const Options = () => {
  const state = useStoredState();
  return <Show when={state()}>{(current) => <OptionsBody state={current()} />}</Show>;
};
