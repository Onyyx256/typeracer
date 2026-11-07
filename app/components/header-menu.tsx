"use client";

import { usePathname } from "next/navigation";
import { useId, useState } from "react";

type HeaderMenuProps = {
  /** Accessible name of the toggle button. */
  label: string;
  children: React.ReactNode;
};

/**
 * Below the lg breakpoint the links and settings don't fit beside the logo,
 * so they fold behind a toggle; from lg up they are always shown inline.
 */
export function HeaderMenu({ label, children }: HeaderMenuProps) {
  const pathname = usePathname();
  const id = useId();
  // Remembering where it was opened closes the menu after any navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="order-2 grid size-10 cursor-pointer place-items-center rounded-full border border-line transition-colors hover:bg-surface lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h10" />
          )}
        </svg>
      </button>
      <div
        id={id}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpenOn(null);
        }}
        className={`${open ? "flex" : "hidden"} order-3 w-full flex-col gap-4 border-t border-line pt-3 lg:order-1 lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:gap-6 lg:border-0 lg:pt-0`}
      >
        {children}
      </div>
    </>
  );
}
