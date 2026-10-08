import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
      <Link href="/" className="flex items-center gap-2">
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
        <ThemeToggle />
      </div>
    </header>
  );
}

async function AccountStatus() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="font-mono">{user.displayName}</span>
      <button
        type="submit"
        className="cursor-pointer font-medium text-primary-text underline-offset-4 hover:underline"
      >
        Déconnexion
      </button>
    </form>
  );
}
