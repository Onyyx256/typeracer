import { LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import type { CreateRoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { plural } from "@/lib/i18n/format";
import type { RoomSettings } from "@/lib/rooms/settings";

/** 30 → "30 s", 120 → "2 min": the same in both languages. */
export function formatSeconds(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

/** The host's role only matters while creating the room. */
export type SummarySettings = Omit<RoomSettings, "hostRole"> &
  Partial<Pick<RoomSettings, "hostRole">>;

/** Label, value, and whether the value is a raw character list. */
type Row = [label: string, value: string, chars?: boolean];

type RoomSummaryProps = {
  dict: CreateRoomDictionary;
  locale: Locale;
  settings: SummarySettings;
};

/** Every setting as a labelled row, grouped like the create form. */
export function RoomSummary({ dict, locale, settings }: RoomSummaryProps) {
  const french = settings.language === "fr";
  const random = settings.textType === "random";
  const enabledCharacters = (
    ["punctuation", "numbers", "capitals", "accents"] as const
  ).filter((key) => settings[key] && (key !== "accents" || french));

  const textRows: Row[] = [
    [dict.language, LOCALE_NAMES[settings.language]],
    [dict.textType.legend, dict.textType[settings.textType]],
    [dict.length.label, plural(locale, dict.length.value, settings.length)],
    [dict.complexity.legend, dict.complexity[settings.complexity]],
    [
      dict.characters.legend,
      enabledCharacters.length > 0
        ? enabledCharacters.map((key) => dict.characters[key]).join(", ")
        : dict.summary.lettersOnly,
    ],
  ];
  if (random && settings.includeChars) {
    textRows.push([dict.charset.include, settings.includeChars, true]);
  }
  if (random && settings.excludeChars) {
    textRows.push([dict.charset.exclude, settings.excludeChars, true]);
  }

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: dict.sections.room,
      rows: [
        ...(settings.hostRole
          ? [[dict.role.legend, dict.role[settings.hostRole]] as Row]
          : []),
        [dict.visibility.legend, dict.visibility[settings.visibility]],
        [dict.capacity.label, plural(locale, dict.capacity.value, settings.capacity)],
      ],
    },
    { title: dict.sections.text, rows: textRows },
    {
      title: dict.sections.race,
      rows: [
        [
          dict.timeLimit.legend,
          settings.timeLimit === 0
            ? dict.timeLimit.none
            : formatSeconds(settings.timeLimit),
        ],
        [dict.errorMode.legend, dict.errorMode[settings.errorMode]],
        [dict.bonuses.label, settings.bonuses ? dict.summary.on : dict.summary.off],
      ],
    },
  ];

  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="font-mono text-xs tracking-wide text-accent-text uppercase">
            <span aria-hidden="true">&gt; </span>
            {group.title}
          </h3>
          <dl className="mt-1 divide-y divide-line text-sm">
            {group.rows.map(([label, value, chars]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 py-1.5"
              >
                <dt className="text-muted">{label}</dt>
                {/* Words wrap whole; only a list of characters may break anywhere. */}
                <dd className={`text-right font-medium ${chars ? "min-w-0 break-all" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
