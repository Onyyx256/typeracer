import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.statsPage.title };
}

export default async function StatsPage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {dict.statsPage.heading}
      </h1>
      {/* Reads the session cookie, so it streams in after the static shell. */}
      <Suspense fallback={null}>
        <Stats />
      </Suspense>
    </main>
  );
}

async function Stats() {
  const [, dict] = await Promise.all([requireUser(), getDictionary()]);

  // Filled in once races are saved (AUTH-06, HIST-01).
  return (
    <p className="mt-6 font-mono text-sm text-muted">
      &gt; {dict.statsPage.empty}
    </p>
  );
}
