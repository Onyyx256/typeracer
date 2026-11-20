import { notFound } from "next/navigation";

// The proxy rewrites dead links here: a page that always 404s is
// prerendered as one, so the status survives, unlike a streamed page's.
// "gone" can never be a real code or token.
export const instant = false;

export default function Gone() {
  notFound();
}
