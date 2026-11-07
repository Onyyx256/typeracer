import { notFound } from "next/navigation";

// Unmatched URLs would otherwise get Next's default 404, which sits outside
// the [lang] layout (English only, no header). Catching them here renders
// app/[lang]/not-found.tsx in the visitor's language instead.
// This page never renders (it always 404s), so there is no shell to validate.
export const instant = false;

export default function CatchAll() {
  notFound();
}
