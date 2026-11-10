import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/[lang]/login/actions";
import { requireUser } from "@/lib/auth/current-user";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatNumber, interpolate, plural } from "@/lib/i18n/format";
import { DEFAULT_COSMETICS } from "@/lib/profile/cosmetics";
import { getLooks, getPlayerProgress } from "@/lib/profile/profile";
import { CosmeticsForm } from "./cosmetics-form";
import { NameForm } from "./name-form";
import { PhotoForm } from "./photo-form";

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
      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line pt-6">
      <h2 id={id} className="font-display text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Account() {
  const [user, dict, locale] = await Promise.all([
    requireUser(),
    getDictionary(),
    getLocale(),
  ]);
  const [looks, progress] = await Promise.all([getLooks([user.id]), getPlayerProgress(user.id)]);
  const look = looks[user.id];
  const t = dict.accountPage;
  const c = t.cosmetics;

  return (
    <div className="mt-8 grid gap-10">
      <Section id="photo-heading" title={t.photo.heading}>
        <PhotoForm name={user.displayName} avatarUrl={look?.avatarUrl ?? null} dict={t} />
      </Section>

      <Section id="name-heading" title={t.name.heading}>
        <NameForm displayName={user.displayName} dict={t} />
      </Section>

      <Section id="flower-heading" title={c.heading}>
        <p className="text-muted">{c.lead}</p>
        <p className="font-mono text-sm text-accent-text">
          &gt; {plural(locale, c.races, progress.races, { count: progress.races })} ·{" "}
          {plural(locale, c.wins, progress.wins, { count: progress.wins })} ·{" "}
          {interpolate(c.best, { wpm: formatNumber(locale, progress.bestWpm) })}
        </p>
        <CosmeticsForm
          current={look?.cosmetics ?? DEFAULT_COSMETICS}
          progress={progress}
          dict={c}
          errors={t.errors}
          locale={locale}
        />
      </Section>

      <form action={logout} className="border-t border-line pt-6">
        {/* Server Actions can't read the route's locale, so the form sends it. */}
        <input type="hidden" name="lang" value={locale} />
        <button
          type="submit"
          className="h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-danger hover:text-danger rounded-leaf"
        >
          {t.logout}
        </button>
      </form>
    </div>
  );
}
