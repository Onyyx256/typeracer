import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { LiveRoom } from "@/app/components/live-updates";
import { RoomSummary } from "@/app/components/room-summary";
import { getViewer } from "@/lib/auth/current-user";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate, plural } from "@/lib/i18n/format";
import { MIN_RUNNERS } from "@/lib/race/manager";
import { getLatestRaceResults } from "@/lib/race/results";
import { roomCodeSchema } from "@/lib/rooms/code";
import { findCurrentRoom, getRoom, isBanned, type RoomMemberView } from "@/lib/rooms/rooms";
import { JOINABLE_STATES } from "@/lib/rooms/settings";
import { EditSettings } from "./edit-settings";
import { JoinRoom } from "./join-room";
import { KickMember } from "./kick-member";
import { LeaveRoom } from "./leave-room";
import { MakeHost } from "./make-host";
import { RaceResults } from "./race/race-results";
import { RaceView } from "./race/race-view";
import { StartRace } from "./race/start-race";

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
  // SALLE-07: someone the host removed sees why, whatever the room's visibility.
  if (room && user && !member && (await isBanned(user.id, room.code))) {
    return <Kicked dict={dict.room} locale={locale} />;
  }
  // Code-only and private rooms can't be joined yet, so only their members see them.
  if (!room || (!member && room.visibility !== "public")) {
    notFound();
  }
  const current = member || !user ? null : await findCurrentRoom(user.id);

  const runners = room.members.filter((entry) => entry.role === "participant");
  const spectators = room.members.filter((entry) => entry.role === "spectator");
  const joinable = JOINABLE_STATES.includes(room.state);
  const t = dict.room;
  const isHost = user !== null && room.hostId === user.id;
  // COURSE-01: the page follows the room's state, which only the server changes.
  const inRace = room.state === "countdown" || room.state === "racing";
  const results = room.state === "results" ? await getLatestRaceResults(room.code) : null;
  const settings = { ...room.config, visibility: room.visibility, capacity: room.capacity };

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
            <LeaveRoom dict={t} locale={locale} />
          )}
        </header>

        {inRace && (
          <RaceView
            code={room.code}
            userId={user?.id ?? null}
            dict={dict.race}
            roomDict={t}
            locale={locale}
          />
        )}
        {results && (
          <RaceResults
            view={results}
            userId={user?.id ?? null}
            dict={dict.results}
            roomDict={t}
            locale={locale}
          />
        )}
        {!inRace && isHost && (
          <StartRace
            dict={dict.race}
            label={results ? dict.race.restart : dict.race.start}
            runners={runners.length}
            minRunners={MIN_RUNNERS}
          />
        )}
        {results && member && !isHost && (
          <p className="font-mono text-sm text-muted">&gt; {dict.results.waitingHost}</p>
        )}

        {!inRace && (
          <>
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
              kickDict={isHost ? t : null}
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
              kickDict={isHost ? t : null}
            />
          </>
        )}

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
          <RoomSummary dict={dict.createRoom} locale={locale} settings={settings} />
        </div>
        {/* CONF: the host changes the settings between races, never during one. */}
        {isHost && !inRace && (
          <EditSettings
            dict={t}
            fieldsDict={dict.createRoom}
            locale={locale}
            settings={settings}
          />
        )}
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
  kickDict,
}: {
  title: string;
  count: string;
  members: RoomMemberView[];
  empty: string;
  you: string;
  host: string;
  guest: string;
  userId: string | null;
  /** Only for the host, who may remove the other members (SALLE-07) or hand over the role. */
  kickDict: RoomDictionary | null;
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
              <span className="flex shrink-0 items-center gap-3 font-mono text-xs tracking-wide uppercase">
                {entry.isGuest && <span className="text-muted">{guest}</span>}
                {entry.isHost && <span className="text-accent-text">{host}</span>}
                {kickDict && entry.userId !== userId && !entry.isGuest && (
                  <MakeHost dict={kickDict} userId={entry.userId} name={entry.displayName} />
                )}
                {kickDict && entry.userId !== userId && (
                  <KickMember dict={kickDict} userId={entry.userId} name={entry.displayName} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Kicked({ dict, locale }: { dict: RoomDictionary; locale: Locale }) {
  return (
    <div className="mx-auto max-w-lg border border-line bg-surface p-8 rounded-leaf">
      <h1 className="font-display text-3xl leading-tight font-semibold">{dict.kicked.title}</h1>
      <p className="mt-3 text-muted">{dict.kicked.lead}</p>
      <Link
        href={localePath(locale, "/rooms")}
        className="mt-6 inline-flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
      >
        {dict.kicked.back}
      </Link>
    </div>
  );
}
