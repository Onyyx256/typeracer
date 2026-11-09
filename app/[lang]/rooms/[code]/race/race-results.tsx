import { Avatar } from "@/app/components/avatar";
import type { RaceResultsView, ResultRow } from "@/lib/race/results";
import type { Locale } from "@/lib/i18n/config";
import type { RoomDictionary, ResultsDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatNumber, formatPercent, interpolate } from "@/lib/i18n/format";

/**
 * In rank order in the page, so screen readers start with the winner;
 * shown 2nd, 1st, 3rd with the winner tallest.
 */
const PODIUM = [
  { index: 0, order: "order-2", height: "h-28" },
  { index: 1, order: "order-1", height: "h-20" },
  { index: 2, order: "order-3", height: "h-14" },
] as const;

/** RÉSULTATS: the top 3 (RES-01) and the full table (RES-02). */
export function RaceResults({
  view,
  userId,
  dict,
  roomDict,
  locale,
}: {
  view: RaceResultsView;
  userId: string | null;
  dict: ResultsDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const seconds = (row: ResultRow) =>
    interpolate(dict.seconds, { value: formatNumber(locale, row.durationMs / 1000, 1) });

  return (
    <section aria-labelledby="results-heading" className="grid gap-8">
      <h2 id="results-heading" className="font-display text-3xl font-semibold">
        {dict.heading}
      </h2>

      <div>
        <h3 className="sr-only">{dict.podium}</h3>
        <ol className="grid max-w-xl grid-cols-3 items-end gap-3">
          {PODIUM.map(({ index, order, height }) => {
            const row = view.results[index];
            if (!row) {
              return <li key={index} aria-hidden="true" className={order} />;
            }
            return (
              <li key={index} className={`grid justify-items-center gap-2 text-center ${order}`}>
                <Avatar name={row.name} className="size-10 text-lg" />
                <span className="max-w-full truncate font-medium" title={row.name}>
                  {row.name}
                  {row.userId === userId && userId !== null && <span className="text-muted"> ({roomDict.you})</span>}
                </span>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {formatNumber(locale, row.wpm)} {dict.columns.wpm}
                </span>
                <span
                  className={`flex w-full items-start justify-center pt-2 font-display text-2xl font-semibold rounded-tl-2xl rounded-tr-md ${height} ${
                    index === 0 ? "bg-primary text-on-primary" : "bg-surface border border-line"
                  }`}
                >
                  <span className="sr-only">{dict.places[index]}</span>
                  <span aria-hidden="true">{index + 1}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="overflow-x-auto border border-line rounded-leaf">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{dict.caption}</caption>
          <thead className="bg-surface font-mono text-xs tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">{dict.columns.rank}</th>
              <th scope="col" className="px-4 py-3">{dict.columns.participant}</th>
              <th scope="col" className="px-4 py-3 text-right">{dict.columns.wpm}</th>
              <th scope="col" className="px-4 py-3 text-right">{dict.columns.rawWpm}</th>
              <th scope="col" className="px-4 py-3 text-right">{dict.columns.accuracy}</th>
              <th scope="col" className="px-4 py-3 text-right">{dict.columns.errors}</th>
              <th scope="col" className="px-4 py-3 text-right">{dict.columns.time}</th>
              <th scope="col" className="px-4 py-3">{dict.columns.status}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {view.results.map((row) => {
              const you = userId !== null && row.userId === userId;
              return (
                <tr key={row.rank} className={`border-t border-line ${you ? "bg-primary/10" : ""}`}>
                  <td className="px-4 py-3 font-mono">{row.rank}</td>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {row.name}
                    {you && <span className="text-muted"> ({roomDict.you})</span>}
                    {row.isGuest && (
                      <span className="ml-2 font-mono text-xs text-muted uppercase">{roomDict.guestBadge}</span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(locale, row.wpm)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(locale, row.rawWpm)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.accuracy === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{dict.noAccuracy}</span>
                      </>
                    ) : (
                      formatPercent(locale, row.accuracy / 100, 1)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{row.errors}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{seconds(row)}</td>
                  <td className="px-4 py-3">{dict.statuses[row.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {view.source && (
        <p className="text-sm text-muted">
          {interpolate(dict.source, { title: view.source.title, author: view.source.author })}
        </p>
      )}
    </section>
  );
}
