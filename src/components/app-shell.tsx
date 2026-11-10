import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppNav } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Separator } from "@/components/ui/separator";

function Wordmark() {
  return (
    <Link
      href="/floor"
      className="inline-flex min-h-11 items-center rounded-md text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Fudo
    </Link>
  );
}

export async function AppShell({ children }: { children: ReactNode }) {
  const nav = await getTranslations("nav");
  const shell = await getTranslations("shell");
  const items = [
    { href: "/floor", label: nav("floor") },
    { href: "/layout", label: nav("layout") },
    { href: "/products", label: nav("products") },
  ];

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background md:flex-row">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="ps-5 pe-4 pt-6 pb-4">
          <Wordmark />
        </div>
        <AppNav
          items={items}
          label={shell("primaryNav")}
          orientation="vertical"
          className="ps-3 pe-3"
        />
        <div className="mt-auto flex flex-col gap-3 ps-3 pe-3 pt-3 pb-4">
          <Separator />
          <LanguageSwitcher />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex max-w-full shrink-0 flex-col gap-2 border-b border-border bg-sidebar ps-3 pe-3 py-2 md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Wordmark />
            <LanguageSwitcher />
          </div>
          <AppNav
            items={items}
            label={shell("primaryNav")}
            orientation="horizontal"
          />
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
