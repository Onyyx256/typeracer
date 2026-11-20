import { Notice } from "@/app/components/notice";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export default async function InviteNotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.invitePage;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <title>{`${t.invalid.title} · NelumboType`}</title>
      <Notice title={t.invalid.title} lead={t.invalid.lead} back={t.back} locale={locale} />
    </main>
  );
}
