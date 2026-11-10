import { expect, test } from "@playwright/test";
import { e2eName } from "./database";

// Practice without an account: bots can be configured, then a race alone
// from the countdown to the results, and again.

test("a visitor without an account practices alone", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/en\/practice$/);
  await expect(page.getByRole("heading", { name: "Practice", level: 1 })).toBeVisible();

  // Bots can be added and removed; they don't race yet.
  await expect(page.getByText("no bots: you race alone")).toBeVisible();
  const add = page.getByRole("button", { name: "Add a bot" });
  await add.click();
  await add.click();
  await page.getByLabel("Level").first().selectOption("expert");
  await expect(page.getByLabel("Level").first()).toHaveValue("expert");
  await page.getByRole("button", { name: "Remove Bot 2" }).click();
  await expect(page.getByRole("button", { name: /^Remove Bot/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Remove Bot 1" }).click();
  await expect(page.getByText("no bots: you race alone")).toBeVisible();

  // Random words: the e2e database has no passage corpus.
  await page.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await page.getByLabel("Length").fill("10");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await expect(page.getByText("The race starts in")).toBeVisible();
  const text = (await page.locator('p[aria-label="Text to type"]').innerText()).trim();
  expect(text.split(" ")).toHaveLength(10);
  await expect(page.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  // A mistake fixed on the way (strict mode), then the rest at a human pace.
  await page.getByLabel("Type the text here").focus();
  const wrong = text[0] === "q" ? "z" : "q";
  await page.keyboard.type(wrong, { delay: 60 });
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 60 });

  await expect(page.getByRole("heading", { name: "Results" })).toBeAttached();
  const rows = page.getByRole("table", { name: "Full ranking of the race" }).getByRole("row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("You");
  await expect(rows.nth(1)).toContainText("Finished");
  await expect(rows.nth(1).getByRole("cell").nth(4)).not.toHaveText("100.0%");
  await expect(page.getByText("Practice results aren't saved.")).toBeVisible();

  // Again, with a new text and a new countdown.
  await page.getByRole("button", { name: "Go again" }).click();
  await expect(page.getByText("The race starts in")).toBeVisible();
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("dialog", { name: "Give up this practice?" }).getByRole("button", { name: "Give up" }).click();
  await expect(rows.nth(1)).toContainText("Gave up");
});

test("someone in a room can't practice", async ({ browser }) => {
  const username = e2eName();
  const password = "e2e-password-1234";
  const context = await browser.newContext();
  const practice = await context.newPage();
  await practice.goto("/en/login");
  await practice.getByRole("button", { name: "Sign up", exact: true }).click();
  await practice.getByLabel("Username").fill(username);
  await practice.getByLabel("Password", { exact: true }).fill(password);
  await practice.getByLabel("Confirm").fill(password);
  await practice.getByRole("button", { name: "Create my account" }).click();
  await expect(practice).toHaveURL(/\/en$/);

  // Practice opens while not in a room...
  await practice.goto("/en/practice");
  await practice.getByRole("radio", { name: /^Random/ }).check({ force: true });
  const start = practice.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeVisible();

  // ...then a room is created in another tab.
  const other = await context.newPage();
  await other.goto("/en/rooms/new");
  await other.getByLabel("Your name in this room").fill(username);
  await other.getByRole("button", { name: "Create the room" }).click();
  await expect(other).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = other.url().split("/").at(-1) ?? "";

  // The server refuses the text, and the page points back to the room.
  await start.click();
  await expect(practice.getByText(`You're in room ${code}. Leave it to practice.`)).toBeVisible();
  await expect(practice.getByText("The race starts in")).toHaveCount(0);

  await practice.goto("/en/practice");
  await expect(practice.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  await practice.getByRole("link", { name: `Back to ${code}` }).click();
  await expect(practice).toHaveURL(new RegExp(`/en/rooms/${code}$`));

  await context.close();
});
