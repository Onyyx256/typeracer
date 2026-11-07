"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  /** "primary" is the filled call to action; "plain" is a regular tab. */
  variant?: "plain" | "primary";
  className?: string;
  children: React.ReactNode;
};

/** A header link that marks itself as the current page. */
export function NavLink({
  href,
  variant = "plain",
  className = "",
  children,
}: NavLinkProps) {
  const current = usePathname() === href;
  const look =
    variant === "primary"
      ? "bg-primary text-on-primary hover:brightness-110"
      : current
        ? "bg-surface text-foreground"
        : "text-muted hover:text-foreground";

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex h-10 items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition-[color,background-color,filter] rounded-leaf ${look} ${className}`}
    >
      {children}
    </Link>
  );
}
