import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type PageName = "floor" | "layout" | "products";

export async function pageTitle(page: PageName): Promise<Metadata> {
  const shell = await getTranslations("shell");
  const nav = await getTranslations("nav");

  return {
    title: shell("documentTitle", { page: nav(page) }),
  };
}
