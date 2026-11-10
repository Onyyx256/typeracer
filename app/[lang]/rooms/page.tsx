import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionaries";

export default async function RoomsPage() {
  redirect(localePath(await getLocale(), "/"));
}
