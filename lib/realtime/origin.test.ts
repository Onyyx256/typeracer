import { describe, expect, test } from "bun:test";
import { isSameOrigin } from "./origin";

describe("isSameOrigin", () => {
  test("accepts the site's own pages", () => {
    expect(isSameOrigin("https://nelumbotype.online", "nelumbotype.online")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  test("refuses another site, port or subdomain", () => {
    expect(isSameOrigin("https://evil.example", "nelumbotype.online")).toBe(false);
    expect(isSameOrigin("http://localhost:4000", "localhost:3000")).toBe(false);
    expect(isSameOrigin("https://www.nelumbotype.online", "nelumbotype.online")).toBe(false);
  });

  test("refuses a malformed origin or a missing host", () => {
    expect(isSameOrigin("null", "nelumbotype.online")).toBe(false);
    expect(isSameOrigin("https://nelumbotype.online", undefined)).toBe(false);
  });

  test("lets through a client that sends no origin", () => {
    expect(isSameOrigin(undefined, "nelumbotype.online")).toBe(true);
  });
});
