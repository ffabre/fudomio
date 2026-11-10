"use server";

import { cookies } from "next/headers";
import { isLocale, localeCookieName } from "@/i18n/config";
import { localeCookieOptions } from "@/i18n/locale";

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error("unsupported_locale");
  }

  const store = await cookies();
  store.set(localeCookieName, locale, localeCookieOptions);
}
