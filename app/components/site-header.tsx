import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line px-5 py-3 sm:px-8">
      <Link href="/" className="flex items-center gap-2">
        {/* The logo file has an opaque white background, hence the white badge. */}
        <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white">
          <Image
            src="/logo.png"
            alt=""
            width={320}
            height={265}
            priority
            className="h-9 w-auto"
          />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">
          Nelumbo<span className="text-accent-text">Type</span>
        </span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
