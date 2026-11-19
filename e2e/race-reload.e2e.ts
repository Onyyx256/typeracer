import { expect, test } from "@playwright/test";
import { signUp } from "./accounts";
import { e2eName } from "./database";

// A runner reloads the page in the middle of a race: the server gives back
// what they had typed, and they finish from there.

test("a runner who reloads mid-race resumes where they were", async ({ browser }) => {
  test.slow();
  const hostName = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("10");
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
  const shown = host.locator('p[aria-label="Text to type"]');
  const text = (await shown.innerText()).trim();

  const before = 15;
  await host.getByLabel("Type the text here").focus();
  await host.keyboard.type(text.slice(0, before), { delay: 60 });

  // Reloading before the keys reach the server would lose them, which is
  // the same as for a closed tab: wait until the other runner sees them.
  const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }).format(
    before / text.length,
  );
  const hostTrack = guest.getByRole("listitem", { name: new RegExp(`^${hostName}:`) });
  await expect(hostTrack).toHaveAttribute("aria-label", new RegExp(`: ${percent},`));

  await host.reload();
  await expect(shown).toHaveText(text);
  await expect(shown.locator("span.text-primary-text")).toHaveCount(before);
  await expect(host.getByText("You gave up.")).toHaveCount(0);

  await guest.getByRole("button", { name: "Give up" }).click();
  await guest
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();

  await host.getByLabel("Type the text here").focus();
  await host.keyboard.type(text.slice(before), { delay: 60 });

  await expect(host.getByRole("heading", { name: "Results" })).toBeVisible();
  const winner = host.getByRole("table", { name: "Full ranking of the race" }).getByRole("row").nth(1);
  await expect(winner).toContainText(hostName);
  await expect(winner).toContainText("Finished");

  await guestContext.close();
  await hostContext.close();
});
