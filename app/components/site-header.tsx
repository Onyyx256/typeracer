import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/[lang]/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LanguageSwitch } from "./language-switch";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <header className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
      <Link href={localePath(locale, "/")} className="flex items-center gap-2">
        {/* The logo file has an opaque white background, hence the white badge. */}
        <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white">
          <Image
            src="/logo.png"
            alt=""
            width={320}
            height={265}
            priority
            className="h-9 w-auto"
          />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">
          Nelumbo<span className="text-accent-text">Type</span>
        </span>
      </Link>
      <div className="flex items-center gap-4">
        {/* Reads the session cookie, so it streams in after the static header. */}
        <Suspense fallback={null}>
          <AccountStatus />
        </Suspense>
        <LanguageSwitch current={locale} label={dict.header.language} />
        <ThemeToggle
          label={dict.header.themeLabel}
          title={dict.header.themeTitle}
        />
      </div>
    </header>
  );
}

async function AccountStatus() {
  const [user, dict, locale] = await Promise.all([
    getCurrentUser(),
    getDictionary(),
    getLocale(),
  ]);
  if (!user) {
    return null;
  }

  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      {/* Server Actions can't read the route's locale, so the form sends it. */}
      <input type="hidden" name="lang" value={locale} />
      <span className="font-mono">{user.displayName}</span>
      <button
        type="submit"
        className="cursor-pointer font-medium text-primary-text underline-offset-4 hover:underline"
      >
        {dict.header.logout}
      </button>
    </form>
  );
}
