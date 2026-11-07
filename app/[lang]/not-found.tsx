import Link from "next/link";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export default async function NotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex flex-1 flex-col">
      {/* not-found can't export metadata, so the title is set here (React hoists it to <head>). */}
      <title>{`${dict.notFound.title} · NelumboType`}</title>
      <main className="flex flex-1 flex-col items-center justify-center px-5 text-center sm:px-8">
        <p className="font-mono text-sm text-accent-text">&gt; 404</p>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">
          {dict.notFound.heading}
        </h1>
        <p className="mt-3 text-muted">{dict.notFound.lead}</p>
        <Link
          href={localePath(locale, "/")}
          className="mt-6 font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {dict.notFound.home}
        </Link>
      </main>
    </div>
  );
}
