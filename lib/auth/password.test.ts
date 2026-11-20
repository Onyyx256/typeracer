import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing (SEC-03)", () => {
  test("stores an Argon2id hash, never the password", async () => {
    const hashed = await hashPassword("correct horse battery");
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toContain("correct horse battery");
  });

  test("uses at least OWASP's minimum parameters", async () => {
    const hashed = await hashPassword("correct horse battery");
    expect(hashed).toContain("m=19456,t=2,p=1");
  });

  test("salts each hash, so one password gives two different hashes", async () => {
    const [first, second] = await Promise.all([
      hashPassword("correct horse battery"),
      hashPassword("correct horse battery"),
    ]);
    expect(first).not.toBe(second);
  });

  test("accepts the right password and refuses a wrong one", async () => {
    const hashed = await hashPassword("correct horse battery");
    expect(await verifyPassword(hashed, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hashed, "correct horse batterY")).toBe(false);
  });

  test("always refuses an unknown user or an OAuth-only account", async () => {
    expect(await verifyPassword(null, "decoy")).toBe(false);
    expect(await verifyPassword(null, "anything")).toBe(false);
  });
});
