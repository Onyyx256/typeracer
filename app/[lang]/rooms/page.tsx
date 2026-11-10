import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LiveLobby } from "@/app/components/live-updates";
import { getViewer } from "@/lib/auth/current-user";
import { LOCALES, LOCALE_NAMES, localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { filterQuery, parseRoomFilters, type RoomFilters } from "@/lib/rooms/filters";
import { findCurrentRoom, listPublicRooms } from "@/lib/rooms/rooms";
import { COMPLEXITIES } from "@/lib/rooms/settings";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.roomsPage.title };
}

export default async function RoomsPage({ searchParams }: PageProps<"/[lang]/rooms">) {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight font-semibold">
            {dict.roomsPage.heading}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">{dict.roomsPage.lead}</p>
        </div>
      </div>
      {/* The list changes all the time, so it renders on each request. */}
      <Suspense fallback={null}>
        <RoomList searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 font-mono text-sm text-muted">
        &gt; {dict.roomsPage.codeSoon}
      </p>
    </main>
  );
}

async function RoomList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseRoomFilters(await searchParams);
  const filtered = filters.lang !== undefined || filters.complexity !== undefined;
  const [dict, locale, viewer, rooms] = await Promise.all([
    getDictionary(),
    getLocale(),
    getViewer(),
    listPublicRooms(filters),
  ]);
  const current = viewer ? await findCurrentRoom(viewer.id) : null;
  const canCreate = viewer !== null && !viewer.isGuest;
  const t = dict.roomsPage;

  return (
    <>
      <LiveLobby />
      {current && (
        <p className="mt-6 flex flex-wrap items-center gap-3 border border-primary-text bg-surface px-4 py-3 rounded-leaf">
          {interpolate(t.current, { code: current.code })}
          <Link
            href={localePath(locale, `/rooms/${current.code}`)}
            className="font-medium text-primary-text underline underline-offset-4"
          >
            {t.backToRoom}
          </Link>
        </p>
      )}

      <Filters dict={dict} locale={locale} filters={filters} />

      {rooms.length === 0 ? (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="font-mono text-sm text-muted">&gt; {filtered ? t.noMatch : t.empty}</p>
          {filtered && (
            <Link
              href={localePath(locale, "/rooms")}
              scroll={false}
              className="font-medium text-primary-text underline underline-offset-4"
            >
              {t.clearFilters}
            </Link>
          )}
          {canCreate && (
            <Link
              href={localePath(locale, "/rooms/new")}
              className="flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
            >
              {t.create}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-xl border-collapse text-left text-sm">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr className="border-b border-line font-mono text-xs tracking-wide text-accent-text uppercase">
                <th scope="col" className="py-2 pr-4 font-normal">{t.columns.room}</th>
                <th scope="col" className="py-2 pr-4 font-normal">{t.columns.host}</th>
                <th scope="col" className="py-2 pr-4 font-normal">{t.columns.runners}</th>
                <th scope="col" className="py-2 pr-4 font-normal">{t.columns.text}</th>
                <th scope="col" className="py-2 font-normal">{t.columns.state}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rooms.map((room) => (
                <tr key={room.code}>
                  <td className="py-3 pr-4">
                    <Link
                      href={localePath(locale, `/rooms/${room.code}`)}
                      aria-label={interpolate(t.open, { code: room.code })}
                      className="font-mono font-medium tracking-widest text-primary-text underline underline-offset-4"
                    >
                      {room.code}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{room.hostName}</td>
                  <td className="py-3 pr-4 font-mono">
                    {room.participants}/{room.capacity}
                  </td>
                  <td className="py-3 pr-4">
                    {LOCALE_NAMES[room.language]} ·{" "}
                    {dict.createRoom.textType[room.textType]} ·{" "}
                    {dict.createRoom.complexity[room.complexity]}
                  </td>
                  <td className="py-3">{dict.room.states[room.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type FiltersProps = { dict: Dictionary; locale: Locale; filters: RoomFilters };

function Filters({ dict, locale, filters }: FiltersProps) {
  const t = dict.roomsPage.filters;
  const groups = [
    {
      key: "lang",
      label: t.language,
      options: LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
    },
    {
      key: "complexity",
      label: t.complexity,
      options: COMPLEXITIES.map((value) => ({ value, label: dict.createRoom.complexity[value] })),
    },
  ] as const;

  return (
    <nav aria-label={t.label} className="mt-8 grid gap-3">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-wrap items-center gap-2">
          <span
            id={`filter-${group.key}`}
            className="w-36 font-mono text-xs tracking-wide text-accent-text uppercase"
          >
            {group.label}
          </span>
          <ul aria-labelledby={`filter-${group.key}`} className="flex flex-wrap gap-2">
            {[{ value: undefined, label: t.any }, ...group.options].map((option) => {
              const active = filters[group.key] === option.value;
              return (
                <li key={option.value ?? "any"}>
                  <Link
                    href={localePath(locale, "/rooms") + filterQuery(filters, group.key, option.value)}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={`flex h-9 items-center border px-3 text-sm transition-colors rounded-leaf ${
                      active
                        ? "border-primary-text bg-surface font-medium text-primary-text"
                        : "border-line hover:border-primary-text"
                    }`}
                  >
                    {option.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
