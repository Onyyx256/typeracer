import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import logo from "@/app/icon.png";
import { getCurrentUser } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

const BUTTON =
  "flex h-12 w-full items-center justify-center px-6 font-medium transition-[color,border-color,filter] rounded-leaf sm:w-44";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
      {/* Signed-in members go straight to the rooms, so the page waits for the session before showing anything. */}
      <Suspense fallback={null}>
        <Landing />
      </Suspense>
    </main>
  );
}

async function Landing() {
  const [user, dict, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);
  if (user) {
    redirect(localePath(locale, "/rooms"));
  }
  const t = dict.landing;

  return (
    <>
      <Image src={logo} alt="" width={144} height={144} priority className="size-28 sm:size-36" />
      <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        Nelumbo<span className="text-accent-text">Type</span>
      </h1>
      <p className="mt-4 max-w-md font-display text-2xl leading-snug text-muted sm:text-3xl">
        {t.tagline}
      </p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href={localePath(locale, "/login")}
          className={`${BUTTON} border border-line hover:border-primary-text`}
        >
          {t.login}
        </Link>
        <Link
          href={localePath(locale, "/practice")}
          className={`${BUTTON} border border-line hover:border-primary-text`}
        >
          {t.practice}
        </Link>
        <Link
          href={localePath(locale, "/rooms")}
          className={`${BUTTON} bg-primary text-on-primary hover:brightness-110`}
        >
          {t.join}
        </Link>
      </div>
    </>
  );
}
