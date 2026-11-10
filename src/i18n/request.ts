import { getRequestConfig } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { resolveLocale } from "@/i18n/locale";

const catalogs = {
  en: () => import("../../messages/en.json"),
  es: () => import("../../messages/es.json"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

export default getRequestConfig(async ({ locale }) => {
  const active = locale && isLocale(locale) ? locale : await resolveLocale();

  return {
    locale: active,
    messages: (await catalogs[active]()).default,
  };
});
