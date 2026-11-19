import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary, PracticeDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { roomLabel, type CurrentRoom } from "@/lib/rooms/label";

export function InRoomNotice({
  room,
  dict,
  roomNames,
  locale,
}: {
  room: CurrentRoom;
  dict: PracticeDictionary;
  roomNames: Dictionary["roomNames"];
  locale: Locale;
}) {
  const label = roomLabel(roomNames, room);
  return (
    <div className="mt-8 flex max-w-2xl flex-wrap items-center gap-4 border border-primary-text bg-surface px-5 py-4 rounded-leaf">
      <p>{interpolate(dict.inRoom, { room: label })}</p>
      <Link
        href={localePath(locale, `/rooms/${room.code}`)}
        className="flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
      >
        {interpolate(dict.backToRoom, { room: label })}
      </Link>
    </div>
  );
}
