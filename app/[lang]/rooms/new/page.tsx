import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { CreateRoomForm } from "./create-room-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.createRoom.title };
}

export default async function CreateRoomPage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {dict.createRoom.heading}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">{dict.createRoom.lead}</p>
      {/* Guests can't create rooms (AUTH-03), so the form waits for the session check. */}
      <Suspense fallback={null}>
        <SignedInForm />
      </Suspense>
    </main>
  );
}

async function SignedInForm() {
  const [user, dict, locale] = await Promise.all([
    requireUser(),
    getDictionary(),
    getLocale(),
  ]);

  // Only the form's strings are sent to the browser, not the whole dictionary.
  return (
    <CreateRoomForm dict={dict.createRoom} locale={locale} defaultName={user.displayName} />
  );
}
