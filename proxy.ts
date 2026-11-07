import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, hasLocale, negotiateLocale } from "@/lib/i18n/config";

/**
 * Every page lives under /fr or /en. A URL without a locale is redirected to
 * the saved choice, or else to the browser's preferred language (I18N-02).
 */
export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) {
    return undefined;
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    saved && hasLocale(saved)
      ? saved
      : negotiateLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skips Next internals, API routes and files with an extension (logo, favicon...).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
