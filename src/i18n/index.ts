import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it.json';
import en from './locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'ricetta-pi-language';
let storedLanguage: string | null = null;
try { storedLanguage = typeof localStorage === 'undefined' ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Use the Italian default when storage is unavailable. */ }

void i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: storedLanguage === 'en' || storedLanguage === 'it' ? storedLanguage : 'it',
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (language) => {
  const locale = language.startsWith('en') ? 'en' : 'it';
  document.documentElement.lang = locale;
  document.title = i18n.t('app.documentTitle', { lng: locale });
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, locale); } catch { /* Storage may be disabled. */ }
});

export default i18n;
