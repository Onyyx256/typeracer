import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n/config";

/** A full-page message with a way back to the room list. */
export function Notice({
  title,
  lead,
  back,
  locale,
}: {
  title: string;
  lead: string;
  back: string;
  locale: Locale;
}) {
  return (
    <div className="mx-auto max-w-lg border border-line bg-surface p-8 rounded-leaf">
      <h1 className="font-display text-3xl leading-tight font-semibold">{title}</h1>
      <p className="mt-3 text-muted">{lead}</p>
      <Link
        href={localePath(locale, "/rooms")}
        className="mt-6 inline-flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
      >
        {back}
      </Link>
    </div>
  );
}
