import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import logo from "@/app/icon.png";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLooks } from "@/lib/profile/profile";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { Avatar } from "./avatar";
import { HeaderMenu } from "./header-menu";
import { LanguageSwitch } from "./language-switch";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-line px-5 py-3 sm:px-8">
      <Link href={localePath(locale, "/")} className="flex items-center gap-2">
        {/* Same file as the favicon (DES-02). */}
        <Image src={logo} alt="" width={44} height={44} priority className="size-11" />
        <span className="font-display text-xl font-semibold tracking-tight">
          Nelumbo<span className="text-accent-text">Type</span>
        </span>
      </Link>

      {/* The menu reads the URL (active link, language switch). Under a route
          with a dynamic segment, like /rooms/[code], the URL is only known
          at request time, so the menu streams in instead of blocking the shell. */}
      <Suspense fallback={null}>
      <HeaderMenu label={dict.header.menu}>
        <nav
          aria-label={dict.header.nav}
          className="flex flex-col gap-1 lg:flex-1 lg:flex-row lg:items-center"
        >
          <NavLink href={localePath(locale, "/rooms")}>
            {dict.header.join}
          </NavLink>
          {/* Open to everyone, with or without an account. */}
          <NavLink href={localePath(locale, "/practice")}>
            {dict.header.practice}
          </NavLink>
          {/* Reads the session cookie, so it streams in after the static header. */}
          <Suspense fallback={null}>
            <MemberLinks />
          </Suspense>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitch current={locale} label={dict.header.language} />
          <ThemeToggle
            label={dict.header.themeLabel}
            title={dict.header.themeTitle}
          />
        </div>
      </HeaderMenu>
      </Suspense>

      <div className="order-1 ml-auto lg:order-2 lg:ml-0">
        <Suspense fallback={<span className="block size-10" />}>
          <AccountLink />
        </Suspense>
      </div>
    </header>
  );
}

/** Links only signed-in users get: guests can't create rooms (AUTH-03) or keep stats. */
async function MemberLinks() {
  const [user, dict, locale] = await Promise.all([
    getCurrentUser(),
    getDictionary(),
    getLocale(),
  ]);
  if (!user) {
    // On phones the header row has no room for it, so it moves into the menu.
    return (
      <NavLink href={localePath(locale, "/login")} className="sm:hidden">
        {dict.header.login}
      </NavLink>
    );
  }

  return (
    <>
      <NavLink href={localePath(locale, "/stats")}>{dict.header.stats}</NavLink>
      <NavLink
        href={localePath(locale, "/rooms/new")}
        variant="primary"
        className="lg:ml-auto"
      >
        <span aria-hidden="true" className="font-mono">
          +
        </span>
        {dict.header.createRoom}
      </NavLink>
    </>
  );
}

async function AccountLink() {
  const [user, dict, locale] = await Promise.all([
    getCurrentUser(),
    getDictionary(),
    getLocale(),
  ]);

  if (!user) {
    return (
      <Link
        href={localePath(locale, "/login")}
        className="hidden h-10 items-center border border-line px-4 text-sm font-medium whitespace-nowrap transition-colors hover:border-primary-text rounded-leaf sm:flex"
      >
        {dict.header.login}
      </Link>
    );
  }

  const look = (await getLooks([user.id]))[user.id];

  return (
    <Link
      href={localePath(locale, "/account")}
      title={dict.header.account}
      className="rounded-full transition-[filter] hover:brightness-110"
    >
      <Avatar name={user.displayName} src={look?.avatarUrl} className="size-10 text-lg" />
      <span className="sr-only">
        {dict.header.account} ({user.displayName})
      </span>
    </Link>
  );
}
