import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.roomsPage.title };
}

// Join by code (JOIN-01) and the public room browser (JOIN-02) go here.
export default async function RoomsPage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {dict.roomsPage.heading}
      </h1>
      <p className="mt-6 font-mono text-sm text-muted">
        &gt; {dict.roomsPage.soon}
      </p>
    </main>
  );
}
