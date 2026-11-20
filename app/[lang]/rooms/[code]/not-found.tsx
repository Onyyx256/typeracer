import { Notice } from "@/app/components/notice";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** Also what someone watching a room sees once it closes, since the page re-renders into it. */
export default async function RoomNotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.room;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
      <title>{`${t.gone.title} · NelumboType`}</title>
      <Notice title={t.gone.title} lead={t.gone.lead} back={t.kicked.back} locale={locale} />
    </main>
  );
}
