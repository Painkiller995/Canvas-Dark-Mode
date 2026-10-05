import { createSignal, For, Show } from 'solid-js';
import { hostOf, originOf, patternFor } from '../../shared/sites';
import { addSites, removeSites, type Sites, setSitePaused } from '../../shared/storage';
import { GlobeIcon } from '../components/Icons';
import { t } from '../lib/i18n';

/** Accepts bare hosts ("canvas.school.edu") as well as full URLs. */
const parseOrigin = (input: string): string | null => {
  const value = input.trim();
  if (!value) return null;
  const origin = originOf(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  return origin && hostOf(origin).includes('.') ? origin : null;
};

const SiteRow = (props: { origin: string; paused: boolean }) => {
  const remove = async () => {
    await chrome.permissions.remove({ origins: [patternFor(props.origin)] }).catch(() => false);
    await removeSites([props.origin]);
  };

  return (
    <li class="site-row">
      <span class="site-favicon">
        <GlobeIcon size={14} />
      </span>
      <span class="site-row-host">{hostOf(props.origin)}</span>
      <Show when={props.paused}>
        <span class="badge">{t('sitesPausedBadge')}</span>
      </Show>
      <span class="site-row-actions">
        <button type="button" class="btn btn-sm" onClick={() => setSitePaused(props.origin, !props.paused)}>
          {props.paused ? t('actionResume') : t('actionPause')}
        </button>
        <button type="button" class="btn btn-sm btn-danger" onClick={remove}>
          {t('actionRemove')}
        </button>
      </span>
    </li>
  );
};

export const SitesPanel = (props: { sites: Sites }) => {
  const [draft, setDraft] = createSignal('');
  const [error, setError] = createSignal<string>();

  const add = async (event: SubmitEvent) => {
    event.preventDefault();
    setError();
    const origin = parseOrigin(draft());
    if (!origin) {
      setError(t('errorInvalidAddress'));
      return;
    }
    const granted = await chrome.permissions.request({ origins: [patternFor(origin)] });
    if (!granted) {
      setError(t('errorPermissionDenied'));
      return;
    }
    await addSites([origin]);
    setDraft('');
  };

  return (
    <section class="panel">
      <h2 class="panel-title">{t('sectionSites')}</h2>

      <div class="panel-block">
        <div class="row-text">
          <span class="row-title">{t('sitesTitle')}</span>
          <span class="row-hint">{t('sitesHint')}</span>
        </div>

        <Show when={props.sites.enabled.length > 0} fallback={<p class="empty">{t('sitesEmpty')}</p>}>
          <ul class="site-list">
            <For each={props.sites.enabled}>
              {(origin) => <SiteRow origin={origin} paused={props.sites.paused.includes(origin)} />}
            </For>
          </ul>
        </Show>

        <form class="add-site" onSubmit={add} novalidate>
          <input
            class="input"
            type="text"
            inputmode="url"
            autocomplete="off"
            spellcheck={false}
            placeholder={t('sitesAddPlaceholder')}
            aria-label={t('sitesAddLabel')}
            aria-invalid={error() ? 'true' : undefined}
            aria-describedby={error() ? 'add-site-error' : undefined}
            value={draft()}
            onInput={(event) => {
              setDraft(event.currentTarget.value);
              setError();
            }}
          />
          <button type="submit" class="btn" disabled={!draft().trim()}>
            {t('actionAdd')}
          </button>
        </form>
        <Show when={error()}>
          <p id="add-site-error" class="field-error" role="alert">
            {error()}
          </p>
        </Show>
      </div>
    </section>
  );
};
