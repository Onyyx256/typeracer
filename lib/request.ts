import "server-only";
import { headers } from "next/headers";

const MAX_IP_LENGTH = 64;

/**
 * Caddy adds the client's address at the end of X-Forwarded-For, so the last
 * entry is the one a client can't forge. Without a proxy (local dev) every
 * visitor shares "unknown".
 */
export async function requestIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export function ipFromHeaders(list: Headers): string {
  const forwarded = list.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = forwarded || list.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, MAX_IP_LENGTH);
}

/** Behind the proxy the request URL has the internal port, so APP_URL wins. */
export async function requestOrigin(): Promise<string> {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
