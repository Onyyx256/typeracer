import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { PracticeDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";

/** Shown instead of practice to someone who is in a room. */
export function InRoomNotice({
  code,
  dict,
  locale,
}: {
  code: string;
  dict: PracticeDictionary;
  locale: Locale;
}) {
  return (
    <div className="mt-8 flex max-w-2xl flex-wrap items-center gap-4 border border-primary-text bg-surface px-5 py-4 rounded-leaf">
      <p>{interpolate(dict.inRoom, { code })}</p>
      <Link
        href={localePath(locale, `/rooms/${code}`)}
        className="flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
      >
        {interpolate(dict.backToRoom, { code })}
      </Link>
    </div>
  );
}
