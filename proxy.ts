import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, needsSignIn } from "@/lib/auth/session-cookie";
import { LOCALE_COOKIE, hasLocale, localePath, negotiateLocale } from "@/lib/i18n/config";

/**
 * Every page lives under /fr or /en. A URL without a locale is redirected to
 * the saved choice, or else to the browser's preferred language. A page
 * that needs an account sends a visitor without a session to the login
 * page here; a stale cookie still gets the page's own redirect.
 */
export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) {
    const rest = pathname.slice(first.length + 1) || "/";
    if (needsSignIn(rest) && !request.cookies.has(SESSION_COOKIE)) {
      const url = request.nextUrl.clone();
      url.pathname = localePath(first, "/login");
      url.search = "";
      return NextResponse.redirect(url);
    }
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
