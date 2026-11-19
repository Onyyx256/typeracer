import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/app/components/notice";
import { RoomSummary } from "@/app/components/room-summary";
import { getViewer } from "@/lib/auth/current-user";
import { localePath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/format";
import { requestIp } from "@/lib/request";
import { inviteTokenSchema, lookUpInvite } from "@/lib/rooms/invites";
import { roomLabel } from "@/lib/rooms/label";
import { findCurrentRoom, getRoom, isBanned } from "@/lib/rooms/rooms";
import { JOINABLE_STATES } from "@/lib/rooms/settings";
import { JoinRoom } from "../../rooms/[code]/join-room";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  // The token is the key to the room, so it never leaves in a Referer header.
  return { title: dict.invitePage.title, referrer: "no-referrer", robots: { index: false } };
}

export default function InvitePage({ params }: PageProps<"/[lang]/invite/[token]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      {/* Whether the link still works depends on the visitor, so it renders per request. */}
      <Suspense fallback={null}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, user, dict, locale] = await Promise.all([
    params,
    getViewer(),
    getDictionary(),
    getLocale(),
  ]);
  const t = dict.invitePage;
  const invalid = <Notice title={t.invalid.title} lead={t.invalid.lead} back={t.back} locale={locale} />;
  if (!inviteTokenSchema.safeParse(token).success) {
    return invalid;
  }

  const found = await lookUpInvite(token, user?.id ?? null, await requestIp());
  if (!found.ok) {
    return found.error === "inviteUsed" ? (
      <Notice title={t.used.title} lead={t.used.lead} back={t.back} locale={locale} />
    ) : (
      invalid
    );
  }
  const room = await getRoom(found.code);
  if (!room) {
    return invalid;
  }
  if (user && room.members.some((member) => member.userId === user.id)) {
    redirect(localePath(locale, `/rooms/${room.code}`));
  }
  if (user && (await isBanned(user.id, room.code))) {
    const kicked = dict.room.kicked;
    return <Notice title={kicked.title} lead={kicked.lead} back={kicked.back} locale={locale} />;
  }

  const current = user ? await findCurrentRoom(user.id) : null;
  const runners = room.members.filter((member) => member.role === "participant").length;
  const host = room.members.find((member) => member.isHost)?.displayName ?? "";
  const settings = { ...room.config, visibility: room.visibility, capacity: room.capacity };

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-4xl leading-tight font-semibold">
          {room.visibility === "private" ? (
            t.privateHeading
          ) : (
            <>
              {t.heading}{" "}
              <span className="font-mono tracking-widest text-accent-text">{room.code}</span>
            </>
          )}
        </h1>
        <p className="mt-2 text-muted">{interpolate(t.lead, { host })}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-start">
        <aside className="border border-line bg-surface p-6 rounded-leaf">
          <h2 className="font-display text-xl font-semibold">{dict.room.settings}</h2>
          <div className="mt-4">
            <RoomSummary dict={dict.createRoom} botsDict={dict.room.bots} locale={locale} settings={settings} />
          </div>
        </aside>
        {JOINABLE_STATES.includes(room.state) ? (
          <JoinRoom
            dict={dict.room}
            locale={locale}
            code={room.code}
            full={runners >= room.capacity}
            elsewhere={current && { code: current.code, label: roomLabel(dict.roomNames, current) }}
            defaultName={user?.displayName ?? ""}
            hasSession={user !== null}
            invite={token}
          />
        ) : (
          <p className="font-mono text-sm text-accent-text">&gt; {dict.room.errors.notJoinable}</p>
        )}
      </div>
    </div>
  );
}
