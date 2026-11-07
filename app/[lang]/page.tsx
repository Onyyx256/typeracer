import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/app/components/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
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
  const user = await getCurrentUser();

  return (
    <>
      <h1 className="font-display text-4xl leading-tight font-semibold">
        Bonjour {user ? user.displayName : "invité"}
      </h1>
      {!user && (
        <Link
          href="/login"
          className="mt-4 font-medium text-primary-text underline-offset-4 hover:underline"
        >
          Se connecter
        </Link>
      )}
    </>
  );
}
