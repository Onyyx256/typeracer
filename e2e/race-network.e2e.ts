import { expect, test, type Page } from "@playwright/test";
import { e2eName } from "./database";

// A Wi-Fi stall in the middle of a race: the browser keeps sending, the
// network holds the messages and delivers them together. The server judges
// the speed on when they were sent, so nothing typed is lost (COURSE-06,
// COURSE-08).

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

test("keys typed during a network stall all reach the server", async ({ browser }) => {
  test.slow();
  const hostName = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("60");
  // A night would add words and change the progress checked below.
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/en/rooms/${code}`);
  await guest.waitForLoadState("networkidle");
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(e2eName());
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  await host.getByRole("button", { name: "Start the race" }).click();
  await expect(host.getByText("The race starts in")).toBeVisible();
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });
  const text = (await host.locator('p[aria-label="Text to type"]').textContent()) ?? "";

  // A human pace, then the network stalls for about 5 s while typing goes on.
  await host.keyboard.type(text.slice(0, 20), { delay: 80 });
  await hostContext.setOffline(true);
  await host.keyboard.type(text.slice(20, 120), { delay: 50 });
  await hostContext.setOffline(false);

  // The guest's track shows what the server has: all 120 characters, typed
  // without a mistake. Progress counts every correct character, not whole
  // words, and is rounded the way the track rounds it.
  const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }).format(
    120 / text.length,
  );
  await expect(guest.getByRole("listitem", { name: new RegExp(`^${hostName}:`) })).toHaveAttribute(
    "aria-label",
    new RegExp(`: ${percent},`),
    { timeout: 15_000 },
  );

  await browser.contexts().reduce((closed, context) => closed.then(() => context.close()), Promise.resolve());
});
