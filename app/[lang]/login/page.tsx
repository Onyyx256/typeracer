import type { Metadata } from "next";
import { SiteHeader } from "@/app/components/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { AuthScreen } from "./auth-screen";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: dict.loginPage.title,
    description: dict.loginPage.description,
  };
}

export default async function LoginPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      {/* Only the auth strings are sent to the browser, not the whole dictionary. */}
      <AuthScreen dict={dict.auth} locale={locale} />
    </div>
  );
}
