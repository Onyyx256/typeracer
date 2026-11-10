import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { ResultsDictionary, StatsDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatDateTime, formatNumber, formatPercent, interpolate, plural } from "@/lib/i18n/format";
import { historyPageSchema, keyLabel, movingAverage, pageCount } from "@/lib/stats/series";
import {
  getHistory,
  getMissedKeys,
  getPlaces,
  getStatsSummary,
  getWpmProgress,
  PLACES,
  type HistoryEntry,
  type StatsSummary,
} from "@/lib/stats/stats";
import { BarList } from "./bar-list";
import { WpmChart } from "./wpm-chart";

const AVERAGE_WINDOW = 5;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.statsPage.title };
}

export default async function StatsPage({ searchParams }: PageProps<"/[lang]/stats">) {
  const dict = await getDictionary();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-semibold">
        {dict.statsPage.heading}
      </h1>
      <Suspense fallback={null}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 border-t border-line pt-6">
      <div className="grid gap-1">
        <h2 id={id} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        {lead && <p className="text-sm text-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

async function Stats({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, dict, locale, query] = await Promise.all([
    requireUser(),
    getDictionary(),
    getLocale(),
    searchParams,
  ]);
  const t = dict.statsPage;
  const summary = await getStatsSummary(user.id);
  if (summary.races === 0) {
    return <p className="mt-6 font-mono text-sm text-muted">&gt; {t.empty}</p>;
  }

  const pages = pageCount(summary.races);
  const page = Math.min(historyPageSchema.parse(query.page), pages);
  const [progress, missed, places, history] = await Promise.all([
    getWpmProgress(user.id),
    getMissedKeys(user.id),
    getPlaces(user.id),
    getHistory(user.id, page),
  ]);
  const raceHref = (raceId: string) => localePath(locale, `/stats/races/${raceId}`);
  const averages = movingAverage(
    progress.map((entry) => entry.wpm),
    AVERAGE_WINDOW,
  );
  const points = progress.map((entry, index) => ({
    number: index + 1,
    wpm: entry.wpm,
    average: averages[index],
    date: formatDateTime(locale, entry.endedAt),
    href: raceHref(entry.raceId),
  }));
  const wpm = (value: number) => formatNumber(locale, value);

  return (
    <div className="mt-2 grid gap-10">
      <p className="text-muted">{t.lead}</p>

      <Tiles summary={summary} dict={t} locale={locale} />

      {points.length > 0 && (
        <Section
          id="progress-heading"
          title={t.progress.heading}
          lead={plural(locale, t.progress.lead, points.length)}
        >
          <WpmChart
            points={points}
            locale={locale}
            labels={{
              raceSeries: t.progress.raceSeries,
              averageSeries: interpolate(t.progress.averageSeries, { count: AVERAGE_WINDOW }),
              axis: t.progress.axis,
              race: t.progress.race,
              average: t.progress.average,
              open: t.progress.open,
              unit: dict.results.columns.wpm,
              summary: interpolate(t.progress.summary, {
                first: wpm(points[0].wpm),
                last: wpm(points[points.length - 1].wpm),
                average: wpm(averages[averages.length - 1]),
              }),
            }}
          />
        </Section>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        <Section id="keys-heading" title={t.missedKeys.heading} lead={t.missedKeys.lead}>
          {missed.keys.length === 0 ? (
            <p className="font-mono text-sm text-muted">&gt; {t.missedKeys.empty}</p>
          ) : (
            <BarList
              labelClassName="font-mono text-base"
              bars={missed.keys.map((entry) => ({
                id: entry.key,
                label: <KeyName char={entry.key} dict={t.missedKeys} />,
                value: entry.misses,
                display: interpolate(t.missedKeys.value, {
                  count: formatNumber(locale, entry.misses),
                  share: formatPercent(locale, entry.misses / missed.total),
                }),
              }))}
            />
          )}
        </Section>

        <Section id="places-heading" title={t.places.heading} lead={t.places.lead}>
          <BarList
            bars={PLACES.map((place) => ({
              id: place,
              label: t.places.labels[place],
              value: places[place],
              display: formatNumber(locale, places[place]),
            }))}
          />
        </Section>
      </div>

      <Section id="history-heading" title={t.history.heading}>
        <HistoryTable
          entries={history}
          dict={t}
          resultsDict={dict.results}
          locale={locale}
          raceHref={raceHref}
        />
        {pages > 1 && <Pagination page={page} pages={pages} dict={t} locale={locale} />}
      </Section>
    </div>
  );
}

function Tiles({ summary, dict, locale }: { summary: StatsSummary; dict: StatsDictionary; locale: Locale }) {
  const t = dict.tiles;
  const tiles = [
    {
      label: t.races,
      value: formatNumber(locale, summary.races),
      note: null,
    },
    {
      label: t.wins,
      value: formatNumber(locale, summary.wins),
      note: interpolate(t.winRate, { rate: formatPercent(locale, summary.wins / summary.races) }),
    },
    {
      label: t.best,
      value: summary.bestWpm === null ? null : formatNumber(locale, summary.bestWpm),
      note: t.bestNote,
    },
    {
      label: t.average,
      value: summary.averageWpm === null ? null : formatNumber(locale, summary.averageWpm),
      note: t.averageNote,
    },
    {
      label: t.accuracy,
      value: summary.averageAccuracy === null ? null : formatPercent(locale, summary.averageAccuracy / 100, 1),
      note: t.averageNote,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="grid content-start gap-1 border border-line bg-surface px-4 py-3 rounded-leaf">
          <dt className="text-sm text-muted">{tile.label}</dt>
          <dd className="font-display text-3xl font-semibold">
            {tile.value ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{t.none}</span>
              </>
            )}
          </dd>
          {tile.note && <dd className="text-xs text-muted">{tile.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

function KeyName({ char, dict }: { char: string; dict: StatsDictionary["missedKeys"] }) {
  const names: Record<string, string> = { " ": dict.space, "\n": dict.newline, "\t": dict.tab };
  const name = names[char];
  if (!name) {
    return <>{char}</>;
  }
  return (
    <>
      <span aria-hidden="true">{keyLabel(char)}</span>
      <span className="sr-only">{name}</span>
    </>
  );
}

function HistoryTable({
  entries,
  dict,
  resultsDict,
  locale,
  raceHref,
}: {
  entries: HistoryEntry[];
  dict: StatsDictionary;
  resultsDict: ResultsDictionary;
  locale: Locale;
  raceHref: (raceId: string) => string;
}) {
  const t = dict.history;
  return (
    <div className="overflow-x-auto border border-line rounded-leaf">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{t.caption}</caption>
        <thead className="bg-surface font-mono text-xs tracking-wide text-muted uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">{t.columns.date}</th>
            <th scope="col" className="px-4 py-3">{t.columns.text}</th>
            <th scope="col" className="px-4 py-3">{t.columns.place}</th>
            <th scope="col" className="px-4 py-3 text-right">{t.columns.wpm}</th>
            <th scope="col" className="px-4 py-3 text-right">{t.columns.accuracy}</th>
            <th scope="col" className="px-4 py-3">{t.columns.status}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {entries.map((entry) => (
            <tr key={entry.raceId} className="border-t border-line hover:bg-surface">
              <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                <Link
                  href={raceHref(entry.raceId)}
                  className="text-primary-text underline decoration-line underline-offset-4 hover:decoration-current"
                >
                  {formatDateTime(locale, entry.endedAt)}
                </Link>
              </th>
              <td className="max-w-[16rem] truncate px-4 py-3" title={entry.sourceTitle ?? undefined}>
                {entry.sourceTitle ?? <span className="text-muted">{t.noText}</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {interpolate(t.place, { rank: entry.rank, runners: entry.runners })}
              </td>
              <td className="px-4 py-3 text-right font-semibold">{formatNumber(locale, entry.wpm)}</td>
              <td className="px-4 py-3 text-right">
                {entry.accuracy === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">{resultsDict.noAccuracy}</span>
                  </>
                ) : (
                  formatPercent(locale, entry.accuracy / 100, 1)
                )}
              </td>
              <td className="px-4 py-3">{resultsDict.statuses[entry.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  pages,
  dict,
  locale,
}: {
  page: number;
  pages: number;
  dict: StatsDictionary;
  locale: Locale;
}) {
  const t = dict.history;
  const href = (target: number) => `${localePath(locale, "/stats")}?page=${target}#history-heading`;
  const link = "inline-flex h-10 items-center border border-line px-4 text-sm font-medium transition-colors hover:border-primary-text rounded-leaf";
  return (
    <nav aria-label={t.nav} className="flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          <span aria-hidden="true">←</span>&nbsp;{t.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-sm text-muted" aria-current="page">
        {interpolate(t.page, { page, pages })}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={link}>
          {t.next}&nbsp;<span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
