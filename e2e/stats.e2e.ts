import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./accounts";
import { e2eName } from "./database";

// A new player's stats page: empty at first, then after one race in a room
// (won with one mistake fixed, against a guest who gave up) the tiles,
// chart, missed keys, placings and history all show it, and the history
// opens that race's results again.

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The value under a summary tile's label, e.g. "Races". */
function tile(page: Page, label: string) {
  return page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
    .locator("dd")
    .first();
}

/** One race in a room: the host wins with `wrong` typed and fixed, the guest gives up. */
async function winOneRace(host: Page, guest: Page, nickname: string): Promise<string> {
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(e2eName());
  // Random words: the e2e database has no passage corpus.
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("5");
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(nickname);
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  await host.getByRole("button", { name: "Start the race" }).click();
  await expect(host.getByText("The race starts in")).toBeVisible();
  const text = (await host.locator('p[aria-label="Text to type"]').innerText()).trim();
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  await guest.getByRole("button", { name: "Give up" }).click();
  await guest
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();

  await host.getByLabel("Type the text here").focus();
  await host.keyboard.type(text[0] === "q" ? "z" : "q", { delay: 60 });
  await host.keyboard.press("Backspace");
  await host.keyboard.type(text, { delay: 60 });
  await expect(host.getByRole("heading", { name: "Results" })).toBeVisible();
  return text[0];
}

test("the stats page shows a player's races and opens one again", async ({ browser }) => {
  test.slow();
  const nickname = e2eName();
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, e2eName());

  await host.goto("/en/stats");
  await expect(host.getByRole("heading", { name: "My stats", level: 1 })).toBeVisible();
  await expect(host.getByText("your stats will show up after your first race")).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const missedKey = await winOneRace(host, guest, nickname);
  await guestContext.close();

  await host.goto("/en/stats");
  await expect(tile(host, "Races")).toHaveText("1");
  await expect(tile(host, "Wins")).toHaveText("1");
  await expect(host.getByText("100% of races")).toBeVisible();
  await expect(tile(host, "Best WPM")).not.toHaveText(/—/);
  await expect(tile(host, "Average accuracy")).toHaveText(/%$/);
  await expect(tile(host, "Average accuracy")).not.toHaveText("100.0%");

  await expect(host.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(host.getByText("WPM of your last race, abandoned races left out.")).toBeVisible();

  // The one wrong key was typed where the text's first character was expected.
  const keys = host.getByRole("region", { name: "Most-missed keys" }).getByRole("listitem");
  await expect(keys).toHaveCount(1);
  await expect(keys.first()).toHaveText(new RegExp(`^${escapeRegExp(missedKey)}\\s*1 \\(100%\\)$`));

  const places = host.getByRole("region", { name: "Placings" }).getByRole("listitem");
  await expect(places.filter({ hasText: "1st place" })).toHaveText(/1st place\s*1$/);
  await expect(places.filter({ hasText: "Abandoned" })).toHaveText(/Abandoned\s*0$/);

  const history = host.getByRole("table", { name: "Your races, newest first" });
  const rows = history.getByRole("row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("1 of 2");
  await expect(rows.nth(1)).toContainText("Finished");
  await expect(rows.nth(1)).toContainText("random words");

  await rows.nth(1).getByRole("link").click();
  await expect(host).toHaveURL(/\/en\/stats\/races\/[0-9a-f-]{36}$/);
  await expect(host.getByRole("heading", { name: /^Race of /, level: 1 })).toBeVisible();
  const ranking = host.getByRole("table", { name: "Full ranking of the race" }).getByRole("row");
  await expect(ranking).toHaveCount(3);
  await expect(ranking.nth(1)).toContainText("Finished");
  await expect(ranking.nth(2)).toContainText(nickname);
  await expect(ranking.nth(2)).toContainText("Gave up");

  await host.getByRole("link", { name: "Back to stats" }).click();
  await expect(host).toHaveURL(/\/en\/stats$/);

  await hostContext.close();
});
