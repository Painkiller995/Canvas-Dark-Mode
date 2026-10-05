/** Falls back to the key so a missing string is visible rather than blank. */
export const t = (key: string, substitutions?: string | string[]): string =>
  chrome.i18n.getMessage(key, substitutions) || key;

export const applyDocumentLocale = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.documentElement.dir = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
};
