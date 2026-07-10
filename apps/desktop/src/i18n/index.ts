/**
 * i18n bootstrap (react-i18next). Bundled dictionaries only — no network
 * (RNF-004). English is the fallback; the stored preference switches the
 * language once it loads.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ptBR from "./locales/pt-br.json";
import type { Language } from "../types/session";

export const LANGUAGES: Language[] = ["en", "pt-br"];

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "pt-br": { translation: ptBR },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "pt-br"],
  // i18next uppercases region subtags (pt-br -> pt-BR) in its lookup chain by
  // default; keep them lowercase so they match our "pt-br" resource bundle.
  lowerCaseLng: true,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
