import { expect, test, type Page } from "@playwright/test";
import { e2eName } from "./database";

// Bots race on their own: in practice (in the browser) and in a room (on
// the server). An Impossible bot finishes 10 random words in a few
// seconds; the human then gives up, which ends the race.

const PASSWORD = "e2e-password-1234";

async function signUp(page: Page, username: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

/** Random words: the e2e database has no passage corpus. */
async function shortRandomText(page: Page): Promise<void> {
  await page.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await page.getByLabel("Length").fill("10");
}

async function addImpossibleBot(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add a bot" }).click();
  await page.getByLabel("Level").last().selectOption("impossible");
}

/** The bot types to the end on its own, then the human gives up. */
async function botWinsWhileHumanGivesUp(page: Page, dialog: string): Promise<void> {
  await expect(page.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });
  const bot = page.getByRole("listitem", { name: /^Bot 1:/ });
  await expect(bot).toHaveAccessibleName(/bot Impossible/);
  await expect(bot).toHaveAccessibleName(/^Bot 1: 100%/, { timeout: 20_000 });

  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("dialog", { name: dialog }).getByRole("button", { name: "Give up", exact: true }).click();

  const rows = page.getByRole("table", { name: "Full ranking of the race" }).getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("Bot 1");
  await expect(rows.nth(1)).toContainText(/bot · Impossible/i);
  await expect(rows.nth(1)).toContainText("Finished");
  await expect(rows.nth(1).getByRole("cell").first()).toHaveText("1");
  await expect(rows.nth(2)).toContainText("Gave up");
}

test("a bot races against the player in practice", async ({ page }) => {
  await page.goto("/en/practice");
  await addImpossibleBot(page);
  await shortRandomText(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await botWinsWhileHumanGivesUp(page, "Give up this practice?");
});

test("a room's bot races on the server, and bots can't race alone", async ({ browser }) => {
  test.slow();
  const context = await browser.newContext();
  const host = await context.newPage();
  const hostName = e2eName();
  await signUp(host, hostName);

  // A spectator host with only a bot: two runners, but no human.
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Spectator/ }).check({ force: true });
  await shortRandomText(host);
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await addImpossibleBot(host);
  await addImpossibleBot(host);
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  await expect(host.getByRole("button", { name: "Start the race" })).toBeDisabled();
  await expect(host.getByText("at least one human runner is needed")).toBeVisible();

  // A runner host and one bot can race, in a new room that replaces this one.
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await shortRandomText(host);
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await addImpossibleBot(host);
  await host.getByRole("button", { name: "Create the room" }).click();
  await host.getByRole("button", { name: "Leave it and create this one" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  await expect(host.getByText("Impossible", { exact: true })).toBeVisible();
  const start = host.getByRole("button", { name: "Start the race" });
  await expect(start).toBeEnabled();
  await start.click();

  await botWinsWhileHumanGivesUp(host, "Give up the race?");
  await context.close();
});
