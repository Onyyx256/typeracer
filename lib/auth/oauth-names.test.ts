import { describe, expect, test } from "bun:test";
import { signupSchema } from "./validation";
import { displayNameFor, usernameCandidate } from "./oauth-names";

const half = () => 0.5;

function isValidUsername(username: string): boolean {
  return signupSchema.safeParse({ username, password: "password1", confirm: "password1" })
    .success;
}

describe("usernames from a provider login (AUTH-01)", () => {
  test("the login itself comes first", () => {
    expect(usernameCandidate("octocat", 0, half)).toBe("octocat");
  });

  test("later tries add a random suffix", () => {
    expect(usernameCandidate("octocat", 1, half)).toBe("octocat_5000");
    expect(usernameCandidate("octocat", 2, () => 0.0042)).toBe("octocat_0042");
  });

  test("characters outside the signup rules are dropped", () => {
    expect(usernameCandidate("zoë.dev", 0, half)).toBe("zo.dev");
  });

  test("a login too short or with nothing usable falls back", () => {
    expect(usernameCandidate("ab", 0, half)).toBe("player");
    expect(usernameCandidate("李小龍", 0, half)).toBe("player");
  });

  test("long logins are cut to fit, suffix included", () => {
    const login = "a-very-long-github-login-name";
    expect(usernameCandidate(login, 0, half)).toHaveLength(20);
    expect(usernameCandidate(login, 3, half)).toHaveLength(20);
    expect(usernameCandidate(login, 3, half).endsWith("_5000")).toBe(true);
  });

  test("every candidate passes the signup rules", () => {
    for (const login of ["octocat", "x", "李小龍", "a".repeat(39), "under_score.dot-dash"]) {
      for (const attempt of [0, 1, 4]) {
        expect(isValidUsername(usernameCandidate(login, attempt, Math.random))).toBe(true);
      }
    }
  });
});

describe("display names from a provider profile (AUTH-01)", () => {
  test("the provider's name when it fits the nickname rules", () => {
    expect(displayNameFor("Zoë  Martin", "zoe")).toBe("Zoë Martin");
  });

  test("the username when there is no name or it does not fit", () => {
    expect(displayNameFor(null, "zoe")).toBe("zoe");
    expect(displayNameFor("✨ Zoë ✨", "zoe")).toBe("zoe");
    expect(displayNameFor("A name that is much too long", "zoe")).toBe("zoe");
  });
});
