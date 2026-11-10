import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";

export async function LanguageSwitcher() {
  const common = await getTranslations("common");
  const shell = await getTranslations("shell");
  const active = await getLocale();
  const labels: Record<Locale, string> = {
    en: common("languages.en"),
    es: common("languages.es"),
  };

  return (
    <nav aria-label={shell("language")}>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {locales.map((locale) => (
          <li key={locale}>
            <form action={setLocale.bind(null, locale)}>
              <Button
                type="submit"
                variant={locale === active ? "secondary" : "outline"}
                aria-current={locale === active ? "true" : undefined}
                className="h-11 min-h-11 px-3 text-base"
              >
                {labels[locale]}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </nav>
  );
}
