import { expect, test, type Page } from "@playwright/test";
import { e2eName } from "./database";

// SALLE-07: the host removes a guest from the room. The guest's page
// shows it live, and they can't come back in.

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

test("the host removes a guest, who can't rejoin", async ({ browser }) => {
  const hostName = e2eName();
  const nickname = e2eName();

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await joinDialog.getByLabel("Name").fill(nickname);
  await joinDialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  // Only the host gets a remove button, and never for themself.
  await expect(guest.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  const remove = host.getByRole("button", { name: `Remove ${nickname} from the room` });
  await expect(remove).toBeVisible();
  await expect(host.getByRole("button", { name: `Remove ${hostName} from the room` })).toHaveCount(0);

  // Cancelling keeps them.
  await remove.click();
  const kickDialog = host.getByRole("dialog", { name: `Remove ${nickname}?` });
  await kickDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(kickDialog).toBeHidden();
  await expect(host.getByRole("listitem").filter({ hasText: nickname })).toBeVisible();

  // Confirming removes them, on both pages without a reload.
  await remove.click();
  await kickDialog.getByRole("button", { name: "Remove from the room" }).click();
  await expect(kickDialog).toBeHidden();
  await expect(host.getByRole("listitem").filter({ hasText: nickname })).toHaveCount(0);
  await expect(
    guest.getByRole("heading", { name: "You were removed from this room" }),
  ).toBeVisible();

  // A reload still shows the notice, with no way to join.
  await guest.reload();
  await expect(
    guest.getByRole("heading", { name: "You were removed from this room" }),
  ).toBeVisible();
  await expect(guest.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await guestContext.close();
  await hostContext.close();
});
