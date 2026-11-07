import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/format";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-5 text-center sm:px-8">
        {/* Reads the session cookie, so it streams in after the static shell. */}
        <Suspense fallback={null}>
          <Greeting />
        </Suspense>
      </main>
    </div>
  );
}

async function Greeting() {
  const [user, dict, locale] = await Promise.all([
    getCurrentUser(),
    getDictionary(),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {interpolate(dict.home.greeting, {
          name: user ? user.displayName : dict.home.guest,
        })}
      </h1>
      {!user && (
        <Link
          href={localePath(locale, "/login")}
          className="mt-4 font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {dict.home.login}
        </Link>
      )}
    </>
  );
}
