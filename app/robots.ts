import type { MetadataRoute } from "next";

/** Rooms, invites and accounts are short-lived or personal, so only the public pages are crawled. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/rooms/", "/*/invite/", "/*/account", "/*/stats", "/*/login"],
    },
  };
}
