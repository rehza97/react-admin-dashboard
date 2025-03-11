import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslation from "./locales/en/translation.json";
import frTranslation from "./locales/fr/translation.json";
import enFaq from "./locales/en/faq.json";
import frFaq from "./locales/fr/faq.json";

// the translations
const resources = {
  en: {
    translation: {
      ...enTranslation,
      faq: enFaq,
    },
  },
  fr: {
    translation: {
      ...frTranslation,
      faq: frFaq,
    },
  },
};

i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next
  .use(initReactI18next)
  // init i18next
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    // detection options
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
