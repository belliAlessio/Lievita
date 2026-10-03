import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it.json';
import en from './locales/en.json';

void i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: 'it',
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (language) => {
  const locale = language.startsWith('en') ? 'en' : 'it';
  document.documentElement.lang = locale;
  document.title = i18n.t('app.documentTitle', { lng: locale });
});

export default i18n;
