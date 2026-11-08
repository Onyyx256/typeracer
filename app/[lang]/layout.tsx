import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { Presence } from "@/app/components/live-updates";
import { RoomClosed } from "@/app/components/room-closed";
import { SiteHeader } from "@/app/components/site-header";
import { getViewer } from "@/lib/auth/current-user";
import { ThemeScript } from "@/app/components/theme-script";
import { LOCALES } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import "../globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

async function SessionPresence() {
  // Guests count too: their seat is freed when they close the page (SALLE-08).
  const [viewer, dict, locale] = await Promise.all([getViewer(), getDictionary(), getLocale()]);
  return (
    <>
      <Presence userId={viewer?.id ?? null} />
      {/* Only a member can be told their room was deleted (SALLE-08). */}
      {viewer && <RoomClosed dict={dict.room.closed} locale={locale} />}
    </>
  );
}

// One prerendered shell per language (required by Cache Components for root params).
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: {
      default: "NelumboType",
      template: "%s · NelumboType",
    },
    description: dict.metadata.description,
  };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[lang]">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-theme="light"
      suppressHydrationWarning
      className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        {/* In the layout so every page, including 404 and error pages, gets the language switch. */}
        <SiteHeader />
        {children}
        {/* Reads the session cookie, so it streams in after the static shell. */}
        <Suspense fallback={null}>
          <SessionPresence />
        </Suspense>
      </body>
    </html>
  );
}
