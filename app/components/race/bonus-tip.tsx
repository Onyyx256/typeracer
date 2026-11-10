"use client";

import { useEffect, useState } from "react";
import { WeatherIcon } from "@/app/components/weather-icon";
import type { BonusKind } from "@/lib/race/bonuses";

type Anchor = { top: number; bottom: number; right: number };

/** Fixed, not absolute: the results table scrolls, and it would clip the tip. */
export function BonusTip({ kind, name, description }: { kind: BonusKind; name: string; description: string }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const show = (element: HTMLElement) => {
    const { top, bottom, right } = element.getBoundingClientRect();
    setAnchor({ top, bottom, right });
  };
  const hide = () => setAnchor(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  const below = anchor !== null && anchor.top < 120;

  return (
    <li
      tabIndex={0}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={hide}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={hide}
      onKeyDown={(event) => event.key === "Escape" && hide()}
      className="cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
    >
      <WeatherIcon kind={kind} className="size-5" />
      <span className="sr-only">
        {name}: {description}
      </span>
      {anchor && (
        <span
          aria-hidden="true"
          style={{
            top: below ? anchor.bottom + 8 : anchor.top - 8,
            left: anchor.right,
          }}
          className={`pointer-events-none fixed z-50 grid w-64 -translate-x-full gap-0.5 border border-line bg-panel px-3 py-2 text-left text-xs text-on-panel shadow-lg rounded-leaf ${
            below ? "" : "-translate-y-full"
          }`}
        >
          <span className="font-mono tracking-wide uppercase">{name}</span>
          <span className="font-sans text-on-panel-muted">{description}</span>
        </span>
      )}
    </li>
  );
}
