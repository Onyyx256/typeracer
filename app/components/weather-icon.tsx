import type { BonusKind } from "@/lib/race/bonuses";

/** Drawn in currentColor so they follow the panel or the page. */
export function WeatherIcon({ kind, className }: { kind: BonusKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {kind === "rain" && (
        <>
          <circle cx="16.5" cy="6.5" r="2.5" />
          <path d="M16.5 1.8v.9M21.2 6.5h-.9M19.8 3.2l-.6.6" />
          <path d="M6.5 15h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.5A2.8 2.8 0 0 0 6.5 15Z" fill="currentColor" fillOpacity={0.15} />
          <path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" />
        </>
      )}
      {kind === "night" && (
        <>
          <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" fill="currentColor" fillOpacity={0.15} />
          <path d="M17 3.5v2M16 4.5h2M20.5 8.5v1.5M19.75 9.25h1.5" />
        </>
      )}
      {kind === "glare" && (
        <>
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity={0.35} />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </>
      )}
    </svg>
  );
}
