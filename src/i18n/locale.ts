import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "@/i18n/config";

const localeCookieMaxAge = 60 * 60 * 24 * 365;

export const localeCookieOptions = {
  path: "/",
  maxAge: localeCookieMaxAge,
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
} as const;

export async function resolveLocale(): Promise<Locale> {
  // A future user setting belongs first, ahead of the cookie.
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(localeCookieName)?.value;
  if (fromCookie && isLocale(fromCookie)) {
    return fromCookie;
  }

  const acceptLanguage = (await headers()).get("accept-language");
  if (prefersSpanish(acceptLanguage)) {
    return "es";
  }

  return defaultLocale;
}

function prefersSpanish(header: string | null): boolean {
  if (!header) return false;

  const spanish = preferred(header, "es");
  if (!spanish) return false;

  const english = preferred(header, "en");
  if (!english) return true;
  if (spanish.quality !== english.quality) {
    return spanish.quality > english.quality;
  }

  return spanish.index < english.index;
}

function preferred(
  header: string,
  language: "en" | "es",
): { quality: number; index: number } | undefined {
  let best: { quality: number; index: number } | undefined;

  for (const [index, part] of header.split(",").entries()) {
    const [tagPart, ...params] = part.trim().split(";");
    const tag = tagPart.trim().toLowerCase();
    const primary = tag.split("-")[0];
    if (!primary || primary !== language) continue;

    let quality = 1;
    for (const param of params) {
      const [key, raw] = param.trim().split("=");
      if (key === "q") {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) quality = parsed;
      }
    }
    if (quality <= 0) continue;
    if (
      !best ||
      quality > best.quality ||
      (quality === best.quality && index < best.index)
    ) {
      best = { quality, index };
    }
  }

  return best;
}
