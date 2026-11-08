import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRoom } from "@/app/components/live-updates";
import { RoomSummary } from "@/app/components/room-summary";
import { getViewer } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { interpolate, plural } from "@/lib/i18n/format";
import { roomCodeSchema } from "@/lib/rooms/code";
import { findCurrentRoom, getRoom, type RoomMemberView } from "@/lib/rooms/rooms";
import { JOINABLE_STATES } from "@/lib/rooms/settings";
import { leaveRoomAction } from "../actions";
import { JoinRoom } from "./join-room";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/rooms/[code]">): Promise<Metadata> {
  const [{ code }, dict] = await Promise.all([params, getDictionary()]);
  return { title: interpolate(dict.room.title, { code: code.toUpperCase() }) };
}

export default function RoomPage({ params }: PageProps<"/[lang]/rooms/[code]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      {/* The room depends on the code and the session, so it renders per request. */}
      <Suspense fallback={null}>
        <Room params={params} />
      </Suspense>
    </main>
  );
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const [{ code: raw }, user, dict, locale] = await Promise.all([
    params,
    // Anyone may look at a public room; a visitor without a session joins as a guest (AUTH-02).
    getViewer(),
    getDictionary(),
    getLocale(),
  ]);
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) {
    notFound();
  }
  if (parsed.data !== raw) {
    redirect(localePath(locale, `/rooms/${parsed.data}`));
  }

  const room = await getRoom(parsed.data);
  const member = user ? room?.members.find((entry) => entry.userId === user.id) : undefined;
  // Code-only and private rooms can't be joined yet, so only their members see them.
  if (!room || (!member && room.visibility !== "public")) {
    notFound();
  }
  const current = member || !user ? null : await findCurrentRoom(user.id);

  const runners = room.members.filter((entry) => entry.role === "participant");
  const spectators = room.members.filter((entry) => entry.role === "spectator");
  const joinable = JOINABLE_STATES.includes(room.state);
  const t = dict.room;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/* Members, host and settings re-render as soon as they change. */}
      <LiveRoom code={room.code} />
      <div className="grid gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl leading-tight font-semibold">
              {t.heading}{" "}
              <span className="font-mono tracking-widest text-accent-text">
                {room.code}
              </span>
            </h1>
            <p className="mt-2 font-mono text-sm text-muted">
              &gt; {t.states[room.state]}
              {room.state === "waiting" && <> · {t.waitingNote}</>}
            </p>
          </div>
          {member && (
            <form action={leaveRoomAction}>
              <input type="hidden" name="lang" value={locale} />
              <button
                type="submit"
                className="h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf"
              >
                {t.leave}
              </button>
            </form>
          )}
        </header>

        <MemberList
          title={t.runners}
          count={plural(locale, t.runnerCount, runners.length, {
            capacity: room.capacity,
          })}
          members={runners}
          empty={t.noRunners}
          you={t.you}
          host={t.host}
          guest={t.guestBadge}
          userId={user?.id ?? null}
        />
        <MemberList
          title={t.spectators}
          count={String(spectators.length)}
          members={spectators}
          empty={t.noSpectators}
          you={t.you}
          host={t.host}
          guest={t.guestBadge}
          userId={user?.id ?? null}
        />

        {!member && joinable && (
          <div className="max-w-sm">
            <JoinRoom
              dict={t}
              locale={locale}
              code={room.code}
              full={runners.length >= room.capacity}
              elsewhere={current?.code ?? null}
              defaultName={user?.displayName ?? ""}
              hasSession={user !== null}
            />
          </div>
        )}
        {!member && !joinable && (
          <p className="font-mono text-sm text-accent-text">&gt; {t.errors.notJoinable}</p>
        )}
      </div>

      <aside className="border border-line bg-surface p-6 rounded-leaf lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-semibold">{t.settings}</h2>
        <div className="mt-4">
          <RoomSummary
            dict={dict.createRoom}
            locale={locale}
            settings={{ ...room.config, visibility: room.visibility, capacity: room.capacity }}
          />
        </div>
      </aside>
    </div>
  );
}

function MemberList({
  title,
  count,
  members,
  empty,
  you,
  host,
  guest,
  userId,
}: {
  title: string;
  count: string;
  members: RoomMemberView[];
  empty: string;
  you: string;
  host: string;
  guest: string;
  userId: string | null;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-4 font-display text-2xl font-semibold">
        {title}
        <span className="font-mono text-sm font-normal text-muted">{count}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h2>
      {members.length === 0 ? (
        <p className="mt-3 font-mono text-sm text-muted">&gt; {empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {members.map((entry) => (
            <li
              key={entry.userId}
              className={`flex items-center justify-between gap-3 border bg-background px-4 py-3 rounded-leaf ${
                entry.userId === userId ? "border-primary-text" : "border-line"
              }`}
            >
              <span className="min-w-0 font-medium break-words">
                {entry.displayName}
                {entry.userId === userId && (
                  <span className="text-muted"> ({you})</span>
                )}
              </span>
              <span className="flex shrink-0 gap-2 font-mono text-xs tracking-wide uppercase">
                {entry.isGuest && <span className="text-muted">{guest}</span>}
                {entry.isHost && <span className="text-accent-text">{host}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
