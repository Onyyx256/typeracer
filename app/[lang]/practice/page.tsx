import type { Metadata } from "next";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/current-user";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { findCurrentRoom } from "@/lib/rooms/rooms";
import { InRoomNotice } from "./in-room-notice";
import { PracticeMode } from "./practice-mode";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.practice.title };
}

export default async function PracticePage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">{dict.practice.heading}</h1>
      <p className="mt-2 max-w-2xl text-muted">{dict.practice.lead}</p>
      <Suspense fallback={null}>
        <Practice />
      </Suspense>
    </main>
  );
}

async function Practice() {
  const [viewer, dict, locale] = await Promise.all([getViewer(), getDictionary(), getLocale()]);
  const current = viewer ? await findCurrentRoom(viewer.id) : null;
  if (current) {
    return <InRoomNotice code={current.code} dict={dict.practice} locale={locale} />;
  }

  // Only the strings the page uses are sent to the browser.
  return (
    <PracticeMode
      playerName={viewer?.displayName ?? dict.practice.you}
      isGuest={viewer?.isGuest ?? true}
      dict={dict.practice}
      settingsDict={dict.createRoom}
      raceDict={dict.race}
      resultsDict={dict.results}
      roomDict={dict.room}
      locale={locale}
    />
  );
}
