import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2eName } from "./database";

// When the host leaves, the role goes to the signed-in member who has been
// there longest, never to a guest. With only guests left, the room is
// deleted and their pages say so.

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

async function hostRoom(browser: Browser): Promise<{ host: Page; code: string }> {
  const hostName = e2eName();
  const host = await (await browser.newContext()).newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  return { host, code: host.url().split("/").at(-1) ?? "" };
}

async function joins(browser: Browser, code: string, account: boolean) {
  const name = e2eName();
  const page = await (await browser.newContext()).newPage();
  if (account) {
    await signUp(page, name);
  }
  await page.goto(`/en/rooms/${code}`);
  await page.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = page.getByRole("dialog", { name: "Your name in this room" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeVisible();
  return { page, name };
}

test("the host role skips a guest and goes to a signed-in member", async ({ browser }) => {
  const { host, code } = await hostRoom(browser);
  const guest = await joins(browser, code, false);
  const account = await joins(browser, code, true);

  await host.getByRole("button", { name: "Leave the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms$/);

  // The guest joined first, but the account becomes host, live on both pages.
  for (const page of [guest.page, account.page]) {
    await expect(page.getByRole("listitem").filter({ hasText: account.name })).toContainText(/host/i);
    await expect(page.getByRole("listitem").filter({ hasText: guest.name })).not.toContainText(/host/i);
  }
  await expect(
    account.page.getByRole("button", { name: `Remove ${guest.name} from the room` }),
  ).toBeVisible();

  await browser.contexts().reduce((done, context) => done.then(() => context.close()), Promise.resolve());
});

test("with only a guest left, the room is deleted and the guest is told", async ({ browser }) => {
  const { host, code } = await hostRoom(browser);
  const guest = await joins(browser, code, false);

  // The host is the last account, so leaving deletes the room: it asks first.
  await host.getByRole("button", { name: "Leave the room" }).click();
  const confirm = host.getByRole("dialog", { name: "Delete the room?" });
  await confirm.getByRole("button", { name: "Stay" }).click();
  await expect(confirm).toBeHidden();
  await expect(host).toHaveURL(new RegExp(`/en/rooms/${code}$`));
  await host.getByRole("button", { name: "Leave the room" }).click();
  await confirm.getByRole("button", { name: "Leave and delete the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms$/);

  const notice = guest.page.getByRole("dialog", { name: "Your room has been deleted" });
  await expect(notice).toBeVisible();
  await notice.getByRole("link", { name: "Browse rooms" }).click();
  await expect(guest.page).toHaveURL(/\/en\/rooms$/);

  await guest.page.goto(`/en/rooms/${code}`);
  await expect(guest.page.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await browser.contexts().reduce((done, context) => done.then(() => context.close()), Promise.resolve());
});
