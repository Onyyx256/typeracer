import { expect, test, type Page } from "@playwright/test";
import { e2eName } from "./database";

// Catch-up bonuses in a real race between two browsers: when the host
// passes 25% of the text, the guest gets a bonus and the host a hindrance,
// shown on both tracks, and the results list what each runner received.

const PASSWORD = "e2e-password-1234";
const EFFECT = /rain and sun|night|blinding sun/;

async function signUp(page: Page, username: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

/** The runner's text as shown now (bonuses can change its end); empty once the race is over. */
async function shownText(page: Page): Promise<string> {
  const text = page.locator('p[aria-label="Text to type"]');
  return (await text.innerText({ timeout: 1_000 }).catch(() => "")).trim();
}

async function typeNextWord(page: Page, typed: number): Promise<number> {
  const text = await shownText(page);
  const space = text.indexOf(" ", typed);
  const chunk = text.slice(typed, space === -1 ? text.length : space + 1);
  await page.keyboard.type(chunk, { delay: 60 });
  return typed + chunk.length;
}

test("at 25% the last runner gets a bonus and the leader a hindrance", async ({ browser }) => {
  test.slow();
  const hostName = e2eName();
  const nickname = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("10");
  await expect(host.getByRole("switch", { name: /^Catch-up bonuses/ })).toBeChecked();
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";
  // The host's page is live before the guest joins, so it sees them arrive.
  await expect(host.getByText("at least 2 runners are needed")).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(nickname);
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  await host.getByRole("button", { name: "Start the race" }).click();
  await expect(host.getByText("The race starts in")).toBeVisible();
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  const original = await shownText(guest);

  // Past 25% of the characters (progress counts characters, not words),
  // the guest gets rain and sun, and the host night or a blinding sun.
  await host.getByLabel("Type the text here").focus();
  let typed = 0;
  while (typed < original.length * 0.3) {
    typed = await typeNextWord(host, typed);
  }
  for (const page of [host, guest]) {
    await expect(page.getByRole("listitem", { name: EFFECT })).toHaveCount(2);
    await expect(page.getByRole("listitem", { name: new RegExp(`^${nickname}:.*rain and sun`) })).toHaveCount(1);
    await expect(page.getByRole("listitem", { name: new RegExp(`^${hostName}:.*(night|blinding sun)`) })).toHaveCount(1);
  }
  await expect(guest.getByRole("status").filter({ hasText: "Rain and sun!" })).toBeVisible();
  await expect(host.getByRole("status").filter({ hasText: /Night falls|Blinding sun!/ })).toBeVisible();
  // 10% of 10 words: the guest's last word is now crossed out after the text.
  const lastWord = original.split(" ").at(-1) ?? "";
  await expect(guest.locator('p[aria-label="Text to type"] .line-through')).toContainText(lastWord);

  await guest.getByRole("button", { name: "Give up" }).click();
  await guest
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();

  // The host types whatever their text has become, word by word, to the end.
  const results = host.getByRole("heading", { name: "Results" });
  for (let step = 0; step < 60 && !(await results.isVisible()); step++) {
    if (typed < (await shownText(host)).length) {
      typed = await typeNextWord(host, typed);
    } else {
      await host.waitForTimeout(250);
    }
  }
  await expect(results).toBeVisible();

  const table = host.getByRole("table", { name: "Full ranking of the race" });
  await expect(table.getByRole("columnheader", { name: "Bonuses received" })).toBeVisible();
  await expect(table.getByRole("row").nth(1)).toContainText("Finished");
  await expect(table.getByText(EFFECT)).not.toHaveCount(0);

  await guestContext.close();
  await hostContext.close();
});

async function ownText(page: Page): Promise<string> {
  const box = page.locator('p[aria-label="Text to type"]');
  if ((await box.count()) === 0) {
    return "";
  }
  return box
    .evaluate((box) =>
      Array.from(box.children)
        .filter((child) => !child.querySelector(".line-through"))
        .map((child) => child.textContent ?? "")
        .join(""),
      undefined,
      // The box goes away when the results show.
      { timeout: 1_000 },
    )
    .catch(() => "");
}

test("a runner who misses their new text gets it from the track and can finish", async ({ browser }) => {
  test.slow();
  const hostName = e2eName();
  const nickname = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("10");
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";
  await expect(host.getByText("at least 2 runners are needed")).toBeVisible();

  // The guest's browser loses every race:text, as after a dropped
  // connection, until it asks for its text again (race:text-sync).
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  let dropped = 0;
  let asked = false;
  await guest.routeWebSocket(/socket\.io/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (typeof message === "string" && message.includes('"race:text-sync"')) {
        asked = true;
      }
      server.send(message);
    });
    server.onMessage((message) => {
      if (!asked && typeof message === "string" && message.includes('"race:text"')) {
        dropped++;
        return;
      }
      ws.send(message);
    });
  });
  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(nickname);
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  await host.getByRole("button", { name: "Start the race" }).click();
  await expect(host.getByText("The race starts in")).toBeVisible();
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });
  const original = await ownText(guest);

  // The host passes 25%: rain falls on the guest, whose race:text is dropped.
  await host.getByLabel("Type the text here").focus();
  let typed = 0;
  while (typed < original.length * 0.3) {
    typed = await typeNextWord(host, typed);
  }
  await expect(guest.getByRole("listitem", { name: new RegExp(`^${nickname}:.*rain and sun`) })).toHaveCount(1);
  // The track's text length differs: the guest asks for their text again and gets the shorter one.
  await expect(guest.locator('p[aria-label="Text to type"] .line-through')).toBeVisible({ timeout: 5_000 });
  expect(dropped).toBeGreaterThan(0);
  expect(asked).toBe(true);
  const shortened = await ownText(guest);
  expect(shortened.length).toBeLessThan(original.length);

  await host.getByRole("button", { name: "Give up" }).click();
  await host
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();
  await guest.getByLabel("Type the text here").focus();
  let guestTyped = 0;
  for (let step = 0; step < 40 && guestTyped < (await ownText(guest)).length; step++) {
    const text = await ownText(guest);
    const space = text.indexOf(" ", guestTyped);
    const chunk = text.slice(guestTyped, space === -1 ? text.length : space + 1);
    await guest.keyboard.type(chunk, { delay: 60 });
    guestTyped += chunk.length;
  }
  for (const page of [host, guest]) {
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  }

  await guestContext.close();
  await hostContext.close();
});
