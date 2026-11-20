import { expect, test } from "@playwright/test";
import { signUp } from "./accounts";
import { e2eName } from "./database";

// A whole race between two browsers: the host types the text to the end,
// with a mistake fixed on the way; the guest gives up. Both pages then
// show the results.

test("two runners race; one finishes, the other gives up", async ({ browser }) => {
  test.slow();
  const hostName = e2eName();
  const nickname = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  // Random words: the e2e database has no passage corpus.
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("10");
  // A night would add words while the host types the text; bonuses have their own test.
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  const start = host.getByRole("button", { name: "Start the race" });
  await expect(start).toBeDisabled();
  await expect(host.getByText("at least 2 runners are needed")).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(nickname);
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();
  await expect(guest.getByRole("button", { name: "Start the race" })).toHaveCount(0);

  await expect(start).toBeEnabled();
  await start.click();

  // Both pages count down together.
  await expect(host.getByText("The race starts in")).toBeVisible();
  await expect(guest.getByText("The race starts in")).toBeVisible();
  const text = (await host.locator('p[aria-label="Text to type"]').innerText()).trim();
  expect(text.split(" ")).toHaveLength(10);
  await expect(guest.locator('p[aria-label="Text to type"]')).toHaveText(text);
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  await guest.getByRole("button", { name: "Give up" }).click();
  const abandon = guest.getByRole("dialog", { name: "Give up the race?" });
  await abandon.getByRole("button", { name: "Keep racing" }).click();
  await expect(abandon).toBeHidden();
  await guest.getByRole("button", { name: "Give up" }).click();
  await abandon.getByRole("button", { name: "Give up", exact: true }).click();
  await expect(guest.getByText("You gave up.")).toBeVisible();
  await expect(host.getByRole("listitem", { name: new RegExp(`^${nickname}:`) })).toContainText(
    "gave up",
  );

  await host.getByLabel("Type the text here").focus();
  const wrong = text[0] === "q" ? "z" : "q";
  await host.keyboard.type(wrong, { delay: 60 });
  await host.keyboard.press("Backspace");
  await host.keyboard.type(text, { delay: 60 });

  for (const page of [host, guest]) {
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    const rows = page.getByRole("table", { name: "Full ranking of the race" }).getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText(hostName);
    await expect(rows.nth(1)).toContainText("Finished");
    await expect(rows.nth(2)).toContainText(nickname);
    await expect(rows.nth(2)).toContainText("Gave up");
  }
  // One wrong key out of all of them, so accuracy is below 100 %.
  await expect(host.getByRole("row").nth(1).getByRole("cell").nth(4)).not.toHaveText("100.0%");
  // Each runner sees only their own missed keys, the guest included.
  await expect(guest.getByRole("row").nth(2)).toContainText("(you)");
  await expect(host.getByText("Most missed:")).toBeVisible();
  await expect(guest.getByText("no missed keys before you gave up")).toBeVisible();
  await expect(guest.getByText("Most missed:")).toHaveCount(0);
  await expect(host.getByRole("button", { name: "Start the race" })).toHaveCount(0);
  await expect(guest.getByText("the host can start a new game")).toBeVisible();
  await host.getByRole("button", { name: "New game" }).click();

  for (const page of [host, guest]) {
    await expect(page.getByRole("heading", { name: "Results" })).toHaveCount(0);
    await expect(page.getByText("> Waiting")).toBeVisible();
  }
  await expect(host.getByRole("button", { name: "Start the race" })).toBeEnabled();
  await expect(guest.getByRole("button", { name: "New game" })).toHaveCount(0);

  await guestContext.close();
  await hostContext.close();
});

test("pasting or dropping the text into the typing box does nothing", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/en/practice");
  await page.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await page.getByLabel("Length").fill("10");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const shown = page.locator('p[aria-label="Text to type"]');
  const text = (await shown.innerText()).trim();
  await expect(page.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  const field = page.getByLabel("Type the text here");
  await field.focus();
  // Headless Chromium on macOS doesn't turn Cmd+V into a paste, so the
  // events a paste or a drop fires are sent to the box directly. One letter
  // only: the engine already refuses a whole text arriving at once, and this
  // checks the box itself.
  const refused = await field.evaluate((element, value) => {
    const events = [
      new ClipboardEvent("paste", { bubbles: true, cancelable: true }),
      new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertFromPaste", data: value }),
      new DragEvent("drop", { bubbles: true, cancelable: true }),
      new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertFromDrop", data: value }),
    ];
    return events.map((event) => !element.dispatchEvent(event));
  }, text[0]);
  expect(refused).toEqual([true, true, true, true]);

  // The box still takes keys, and they land from the first letter on, so
  // nothing pasted or dropped got in before them.
  await page.keyboard.type(text.slice(0, 3), { delay: 60 });
  await expect(shown.locator("span.text-primary-text")).toHaveCount(3);
  await expect(shown.locator("span.text-danger")).toHaveCount(0);

  await context.close();
});
