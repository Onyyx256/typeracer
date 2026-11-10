import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import * as z from "zod";
import { RaceResults } from "@/app/components/race/race-results";
import { requireUser } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import { getLooks } from "@/lib/profile/profile";
import { getRaceResultsFor } from "@/lib/race/results";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.statsPage.race.title };
}

export default function PastRacePage({ params }: PageProps<"/[lang]/stats/races/[raceId]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
      <Suspense fallback={null}>
        <PastRace params={params} />
      </Suspense>
    </main>
  );
}

async function PastRace({ params }: { params: Promise<{ raceId: string }> }) {
  const [{ raceId }, user, dict, locale] = await Promise.all([
    params,
    requireUser(),
    getDictionary(),
    getLocale(),
  ]);
  const parsed = z.uuid().safeParse(raceId);
  if (!parsed.success) {
    notFound();
  }
  const view = await getRaceResultsFor(parsed.data, user.id);
  if (!view) {
    notFound();
  }
  const looks = await getLooks(view.results.flatMap((row) => (row.userId ? [row.userId] : [])));
  const t = dict.statsPage.race;

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <Link
          href={localePath(locale, "/stats")}
          className="w-fit font-mono text-sm text-primary-text underline decoration-line underline-offset-4 hover:decoration-current"
        >
          <span aria-hidden="true">←</span> {t.back}
        </Link>
        <h1 className="font-display text-4xl leading-tight font-semibold">
          {interpolate(t.heading, { date: formatDateTime(locale, view.endedAt) })}
        </h1>
      </header>
      <RaceResults
        view={view}
        userId={user.id}
        looks={looks}
        dict={dict.results}
        roomDict={dict.room}
        locale={locale}
      />
    </div>
  );
}
