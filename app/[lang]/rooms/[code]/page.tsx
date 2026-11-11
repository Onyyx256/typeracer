import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRoom } from "@/app/components/live-updates";
import { Notice } from "@/app/components/notice";
import { RoomSummary } from "@/app/components/room-summary";
import { getViewer } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate, plural } from "@/lib/i18n/format";
import { MIN_RUNNERS } from "@/lib/race/manager";
import { getLatestRaceResults } from "@/lib/race/results";
import { getLooks } from "@/lib/profile/profile";
import { requestIp, requestOrigin } from "@/lib/request";
import { roomCodeSchema } from "@/lib/rooms/code";
import { recordCodeMiss, tooManyCodeMisses } from "@/lib/rooms/code-attempts";
import { listInvites } from "@/lib/rooms/invites";
import { findCurrentRoom, getRoom, isBanned, type RoomMemberView } from "@/lib/rooms/rooms";
import { JOINABLE_STATES } from "@/lib/rooms/settings";
import { DeleteRoom } from "./delete-room";
import { EditSettings } from "./edit-settings";
import { InviteLinks, type InviteLink } from "./invite-links";
import { JoinRoom } from "./join-room";
import { KickMember } from "./kick-member";
import { LeaveRoom } from "./leave-room";
import { MakeHost } from "./make-host";
import { RaceResults } from "@/app/components/race/race-results";
import { RaceView } from "./race/race-view";
import { NewGame } from "./race/new-game";
import { StartRace } from "./race/start-race";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/rooms/[code]">): Promise<Metadata> {
  const [{ code }, dict] = await Promise.all([params, getDictionary()]);
  return { title: interpolate(dict.room.title, { code: code.toUpperCase() }) };
}

export default function RoomPage({ params }: PageProps<"/[lang]/rooms/[code]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
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
  const t = dict.room;
  // Someone the host removed sees why, whatever the room's visibility.
  if (room && user && !member && (await isBanned(user.id, room.code))) {
    return <Notice title={t.kicked.title} lead={t.kicked.lead} back={t.kicked.back} locale={locale} />;
  }
  // The URL holds the code, so opening it is a code attempt like the join field (SALLE-10).
  if (!member && room?.visibility !== "public") {
    const ip = await requestIp();
    if (tooManyCodeMisses(ip)) {
      return <Notice title={t.tooMany.title} lead={t.tooMany.lead} back={t.kicked.back} locale={locale} />;
    }
    // Only an invite link opens a private room; its code alone says nothing.
    if (!room || room.visibility === "private") {
      recordCodeMiss(ip);
      notFound();
    }
  }
  if (!room) {
    notFound();
  }
  const current = member || !user ? null : await findCurrentRoom(user.id);

  const runners = room.members.filter((entry) => entry.role === "participant");
  const spectators = room.members.filter((entry) => entry.role === "spectator");
  const joinable = JOINABLE_STATES.includes(room.state);
  const isHost = user !== null && room.hostId === user.id;
  const inRace = room.state === "countdown" || room.state === "racing";
  const results = room.state === "results" ? await getLatestRaceResults(room.code) : null;
  // The podium can show someone who has left the room since.
  const looks = await getLooks([
    ...room.members.map((entry) => entry.userId),
    ...(results?.results.flatMap((row) => (row.userId ? [row.userId] : [])) ?? []),
  ]);
  const settings = { ...room.config, visibility: room.visibility, capacity: room.capacity };
  const invites =
    isHost && room.visibility === "private" && !inRace ? await inviteLinks(user.id, room.code) : null;

  return (
    // During the race the settings can't change, so the race takes the whole width.
    <div
      className={`grid gap-10 lg:items-start ${inRace ? "" : "lg:grid-cols-[minmax(0,1fr)_20rem]"}`}
    >
      <LiveRoom code={room.code} />
      {/* Tighter during the race, so the whole race fits on screen. */}
      <div className={`grid ${inRace ? "gap-5" : "gap-8"}`}>
        <header className={`grid ${inRace ? "gap-2" : "gap-4"}`}>
          {/* The leave and delete buttons line up with the title, not the state below it. */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-4xl leading-tight font-semibold">
              {t.heading}{" "}
              <span className="font-mono tracking-widest text-accent-text">
                {room.code}
              </span>
            </h1>
            {member && (
              <div className="flex flex-wrap gap-3">
                {isHost && <DeleteRoom dict={t} locale={locale} />}
                <LeaveRoom dict={t} locale={locale} />
              </div>
            )}
          </div>
          <p className="font-mono text-sm text-muted">
            &gt; {t.states[room.state]}
            {room.state === "waiting" && <> · {t.waitingNote}</>}
          </p>
        </header>

        {inRace && (
          <RaceView
            code={room.code}
            userId={user?.id ?? null}
            looks={looks}
            dict={dict.race}
            roomDict={t}
            locale={locale}
          />
        )}
        {results && (
          <RaceResults
            view={results}
            userId={user?.id ?? null}
            looks={looks}
            dict={dict.results}
            roomDict={t}
            locale={locale}
          />
        )}
        {inRace && !member && (
          <p className="font-mono text-sm text-accent-text">&gt; {t.errors.notJoinable}</p>
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
      </div>

      {/* The start and join buttons sit under the settings they will race with. */}
      {!inRace && (
        <div className="grid gap-4 lg:sticky lg:top-6">
          <aside className="border border-line bg-surface p-6 rounded-leaf">
            <h2 className="font-display text-xl font-semibold">{t.settings}</h2>
            <div className="mt-4">
              <RoomSummary dict={dict.createRoom} locale={locale} settings={settings} />
            </div>
            {isHost && (
              <EditSettings
                dict={t}
                fieldsDict={dict.createRoom}
                locale={locale}
                settings={settings}
              />
            )}
          </aside>
          {invites && <InviteLinks dict={t.invites} invites={invites} />}
          {isHost && room.state === "waiting" && (
            <StartRace dict={dict.race} runners={runners.length} minRunners={MIN_RUNNERS} />
          )}
          {isHost && results && <NewGame dict={dict.race} />}
          {!member && joinable && (
            <JoinRoom
              dict={t}
              locale={locale}
              code={room.code}
              full={runners.length >= room.capacity}
              elsewhere={current?.code ?? null}
              defaultName={user?.displayName ?? ""}
              hasSession={user !== null}
            />
          )}
          {!member && !joinable && (
            <p className="font-mono text-sm text-accent-text">&gt; {t.errors.notJoinable}</p>
          )}
        </div>
      )}
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
  /** Only for the host. */
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

/** Without the locale, so the link opens in the guest's own language. */
async function inviteLinks(hostId: string, code: string): Promise<InviteLink[]> {
  const [invites, origin] = await Promise.all([listInvites(hostId, code), requestOrigin()]);
  return invites.map(({ token, status, name }) => ({ url: `${origin}/invite/${token}`, status, name }));
}
