import { NextResponse, type NextRequest } from "next/server";
import { userIdFromCookieHeader } from "@/lib/auth/session";
import { LOCALE_COOKIE, hasLocale, negotiateLocale } from "@/lib/i18n/config";
import { ipFromHeaders } from "@/lib/request";
import { invitePageMissing, roomPageMissing } from "@/lib/rooms/missing-pages";

const ROOM_PAGE = /^\/[a-z]+\/rooms\/([^/]+)\/?$/;
const INVITE_PAGE = /^\/[a-z]+\/invite\/([^/]+)\/?$/;

/** Where to show a dead room or invite link, with a real 404 status. */
async function missingPage(request: NextRequest, locale: string): Promise<URL | null> {
  const { pathname } = request.nextUrl;
  const room = ROOM_PAGE.exec(pathname)?.[1];
  const invite = INVITE_PAGE.exec(pathname)?.[1];
  const isRoom = room !== undefined && room !== "new" && room !== "gone";
  if (!isRoom && (invite === undefined || invite === "gone")) {
    return null;
  }
  const userId = await userIdFromCookieHeader(request.headers.get("cookie") ?? undefined);
  const ip = ipFromHeaders(request.headers);
  try {
    const missing = isRoom
      ? await roomPageMissing(decodeURIComponent(room), userId, ip)
      : await invitePageMissing(invite ?? "", userId, ip);
    return missing ? new URL(`/${locale}/${isRoom ? "rooms" : "invite"}/gone`, request.url) : null;
  } catch {
    // The page reports a database problem better than a guessed status would.
    return null;
  }
}

/**
 * Every page lives under /fr or /en. A URL without a locale is redirected to
 * the saved choice, or else to the browser's preferred language. Room and
 * invite pages that would only say "not found" get a 404 status here.
 */
export async function proxy(request: NextRequest): Promise<NextResponse | undefined> {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) {
    const gone = await missingPage(request, first);
    return gone ? NextResponse.rewrite(gone) : undefined;
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
