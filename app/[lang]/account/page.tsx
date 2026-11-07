import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/[lang]/login/actions";
import { Avatar } from "@/app/components/avatar";
import { requireUser } from "@/lib/auth/current-user";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.accountPage.title };
}

export default async function AccountPage() {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {dict.accountPage.heading}
      </h1>
      {/* Reads the session cookie, so it streams in after the static shell. */}
      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const [user, dict, locale] = await Promise.all([
    requireUser(),
    getDictionary(),
    getLocale(),
  ]);

  // The photo (AUTH-04) and display name (AUTH-05) forms go here.
  return (
    <>
      <div className="mt-6 flex items-center gap-4">
        <Avatar name={user.displayName} className="size-16 text-2xl" />
        <p className="font-mono text-lg">{user.displayName}</p>
      </div>
      <p className="mt-6 font-mono text-sm text-muted">
        &gt; {dict.accountPage.soon}
      </p>
      <form action={logout} className="mt-8 border-t border-line pt-6">
        {/* Server Actions can't read the route's locale, so the form sends it. */}
        <input type="hidden" name="lang" value={locale} />
        <button
          type="submit"
          className="h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-danger hover:text-danger rounded-leaf"
        >
          {dict.accountPage.logout}
        </button>
      </form>
    </>
  );
}
