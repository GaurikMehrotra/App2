import en from "./locales/en.json";
import hi from "./locales/hi.json";
import bn from "./locales/bn.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import mr from "./locales/mr.json";
export const languages = { en, hi, bn, ta, te, mr };
export type Language = keyof typeof languages;
export const translateUI = (locale: Language, key: keyof typeof en) =>
  languages[locale][key] || en[key];
