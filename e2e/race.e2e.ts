import { expect, test, type Page } from "@playwright/test";
import { e2eName } from "./database";

// A whole race between two browsers: the host types the text to the end,
// with a mistake fixed on the way; the guest gives up. Both pages then
// show the results (COURSE-02 to COURSE-10, RES-01, RES-02).

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
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  // Alone, the host can't start (COURSE-02).
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
  // Only the host gets the button.
  await expect(guest.getByRole("button", { name: "Start the race" })).toHaveCount(0);

  await expect(start).toBeEnabled();
  await start.click();

  // Both pages count down together, with the text already shown (COURSE-03).
  await expect(host.getByText("The race starts in")).toBeVisible();
  await expect(guest.getByText("The race starts in")).toBeVisible();
  const text = (await host.locator('p[aria-label="Text to type"]').innerText()).trim();
  expect(text.split(" ")).toHaveLength(10);
  await expect(guest.locator('p[aria-label="Text to type"]')).toHaveText(text);
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  // The guest gives up, after cancelling once (COURSE-07).
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

  // The host types at a human pace, with one mistake fixed (strict mode).
  await host.getByLabel("Type the text here").focus();
  const wrong = text[0] === "q" ? "z" : "q";
  await host.keyboard.type(wrong, { delay: 60 });
  await host.keyboard.press("Backspace");
  await host.keyboard.type(text, { delay: 60 });

  // Everyone done: both pages switch to the results (COURSE-09).
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
  // The host can start again (COURSE-11); others wait.
  await expect(host.getByRole("button", { name: "New race" })).toBeEnabled();
  await expect(guest.getByText("the host can start a new race")).toBeVisible();

  await guestContext.close();
  await hostContext.close();
});
