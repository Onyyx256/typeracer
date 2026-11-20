import { Notice } from "@/app/components/notice";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** For unknown codes, and for someone watching a room that just closed. */
export async function RoomGone() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.room;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
      <title>{`${t.gone.title} · NelumboType`}</title>
      <Notice title={t.gone.title} lead={t.gone.lead} back={t.kicked.back} locale={locale} />
    </main>
  );
}

export async function InviteGone() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.invitePage;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <title>{`${t.invalid.title} · NelumboType`}</title>
      <Notice title={t.invalid.title} lead={t.invalid.lead} back={t.back} locale={locale} />
    </main>
  );
}
