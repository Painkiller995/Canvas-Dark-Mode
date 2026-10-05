import { createResource, createSignal, Match, Show, Switch as SwitchCase } from 'solid-js';
import { patternFor } from '../../shared/sites';
import { addSites, type StoredState, setSitePaused, updatePreferences } from '../../shared/storage';
import { BrandMark, GlobeIcon, SettingsIcon } from '../components/Icons';
import { PalettePicker } from '../components/PalettePicker';
import { Switch } from '../components/Switch';
import { t } from '../lib/i18n';
import { useStoredState } from '../lib/state';
import { type ActiveTab, readActiveTab, type SiteStatus, siteStatus } from './activeTab';

type SiteTab = Extract<ActiveTab, { kind: 'site' }>;

const SiteCard = (props: { tab: SiteTab; status: SiteStatus; onGranted: () => void }) => {
  const [busy, setBusy] = createSignal(false);

  /** The background worker also records the grant, in case the browser prompt closes the popup. */
  const enable = async () => {
    setBusy(true);
    try {
      const granted = await chrome.permissions.request({ origins: [patternFor(props.tab.origin)] });
      if (!granted) return;
      await addSites([props.tab.origin]);
      props.onGranted();
    } finally {
      setBusy(false);
    }
  };

  const isOn = () => props.status === 'active';

  return (
    <section class="site" data-status={props.status} aria-live="polite">
      <div class="site-header">
        <span class="site-favicon">
          <GlobeIcon size={14} />
        </span>
        <span class="site-host" title={props.tab.host}>
          {props.tab.host}
        </span>
        <Show when={props.status === 'active' || props.status === 'paused'}>
          <Switch
            checked={isOn()}
            label={t('statusSiteToggle', props.tab.host)}
            onChange={(on) => setSitePaused(props.tab.origin, !on)}
          />
        </Show>
      </div>

      <SwitchCase>
        <Match when={props.status === 'active' || props.status === 'paused'}>
          <p class="site-status">
            <span class="status-dot" />
            {isOn() ? t('statusActiveTitle') : t('statusPausedTitle')}
          </p>
        </Match>
        <Match when={props.status === 'off'}>
          <p class="site-title">{t('statusOffTitle')}</p>
          <p class="site-body">{t('statusOffBody')}</p>
        </Match>
        <Match when={props.status === 'detected'}>
          <p class="site-title">{t('statusDetectedTitle')}</p>
          <p class="site-body">{t('statusDetectedBody')}</p>
          <button type="button" class="btn btn-primary btn-block" disabled={busy()} onClick={enable}>
            {t('actionEnableSite')}
          </button>
        </Match>
        <Match when={props.status === 'needs-access'}>
          <p class="site-title">{t('statusAccessTitle')}</p>
          <p class="site-body">{t('statusAccessBody')}</p>
          <button type="button" class="btn btn-primary btn-block" disabled={busy()} onClick={enable}>
            {t('actionAllowAccess')}
          </button>
        </Match>
        <Match when={props.status === 'unrecognized'}>
          <p class="site-title">{t('statusUnrecognizedTitle')}</p>
          <p class="site-body">{t('statusUnrecognizedBody')}</p>
          <button type="button" class="btn btn-block" disabled={busy()} onClick={enable}>
            {t('actionEnableAnyway')}
          </button>
        </Match>
      </SwitchCase>
    </section>
  );
};

const EmptyCard = () => (
  <section class="site" data-status="none">
    <p class="site-title">{t('statusNoneTitle')}</p>
    <p class="site-body">{t('statusNoneBody')}</p>
  </section>
);

const PopupBody = (props: { state: StoredState }) => {
  const [tab, { refetch }] = createResource(readActiveTab);
  const enabled = () => props.state.preferences.enabled;

  return (
    <main class="popup">
      <header class="popup-header">
        <BrandMark size={28} />
        <h1 class="popup-title">{t('appName')}</h1>
        <button
          type="button"
          class="icon-btn"
          onClick={() => chrome.runtime.openOptionsPage()}
          aria-label={t('openSettings')}
          title={t('openSettings')}
        >
          <SettingsIcon size={16} />
        </button>
        <Switch checked={enabled()} label={t('darkMode')} onChange={(on) => updatePreferences({ enabled: on })} />
      </header>

      <Show when={tab()} fallback={<section class="site site-loading" aria-busy="true" />}>
        {(current) => (
          <Show when={current().kind === 'site' ? (current() as SiteTab) : undefined} fallback={<EmptyCard />}>
            {(site) => <SiteCard tab={site()} status={siteStatus(site(), props.state)} onGranted={refetch} />}
          </Show>
        )}
      </Show>

      <section class="popup-section" classList={{ muted: !enabled() }}>
        <h2 class="section-label">{t('palette')}</h2>
        <PalettePicker
          value={props.state.preferences.palette}
          disabled={!enabled()}
          onChange={(palette) => updatePreferences({ palette })}
        />
      </section>
    </main>
  );
};

export const Popup = () => {
  const state = useStoredState();
  return <Show when={state()}>{(current) => <PopupBody state={current()} />}</Show>;
};
