import { getDictionary } from "@/lib/i18n/dictionaries";

export async function SiteFooter() {
  const dict = await getDictionary();

  return (
    <footer className="border-t border-line px-5 py-4 text-center text-sm text-muted sm:px-8">
      <p>{dict.footer.credit}</p>
    </footer>
  );
}
