import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2eName } from "./database";

// The host deletes the room at once, instead of kicking everyone out
// first: the members are released and their pages say so (SALLE-08).

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

/** A new signed-in host with an open room; returns the page and the room code. */
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

/** Joins as a runner from a new browser, signed in so the host role could pass to them. */
async function accountJoins(browser: Browser, code: string): Promise<Page> {
  const name = e2eName();
  const page = await (await browser.newContext()).newPage();
  await signUp(page, name);
  await page.goto(`/en/rooms/${code}`);
  await page.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = page.getByRole("dialog", { name: "Your name in this room" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeVisible();
  return page;
}

test("the host deletes the room and the members are told", async ({ browser }) => {
  const { host, code } = await hostRoom(browser);
  const member = await accountJoins(browser, code);

  // Only the host gets the button.
  await expect(member.getByRole("button", { name: "Delete the room" })).toHaveCount(0);

  await host.getByRole("button", { name: "Delete the room" }).click();
  const confirm = host.getByRole("dialog", { name: "Delete the room?" });
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(confirm).toBeHidden();
  await expect(host).toHaveURL(new RegExp(`/en/rooms/${code}$`));

  await host.getByRole("button", { name: "Delete the room" }).click();
  await confirm.getByRole("button", { name: "Delete the room" }).click();
  await expect(host).toHaveURL(/\/en$/);

  // Another account was there, but the room is deleted rather than handed over.
  const notice = member.getByRole("dialog", { name: "Your room has been deleted" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("The host deleted the room");
  await notice.getByRole("link", { name: "Browse rooms" }).click();
  await expect(member).toHaveURL(/\/en$/);

  await member.goto(`/en/rooms/${code}`);
  await expect(member.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await browser.contexts().reduce((done, context) => done.then(() => context.close()), Promise.resolve());
});
