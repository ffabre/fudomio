import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { ensureDatabase } from "@/lib/db/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fudo",
  description: "Floor and orders for one restaurant",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  let databaseUnavailable = false;

  try {
    await ensureDatabase();
  } catch (error) {
    console.error("Database failed to open", error);
    databaseUnavailable = true;
  }

  const t = databaseUnavailable
    ? await getTranslations({ locale, namespace: "errors" })
    : null;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      <body className="h-dvh overflow-hidden">
        {t ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-sm">
            {t("databaseUnavailable")}
          </p>
        ) : (
          <NextIntlClientProvider locale={locale}>
            <AppShell>{children}</AppShell>
            <Toaster />
          </NextIntlClientProvider>
        )}
      </body>
    </html>
  );
}
