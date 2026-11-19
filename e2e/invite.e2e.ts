import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2eName } from "./database";

// The ways into a room that isn't listed: a code-only room with its code
// (or a link), a private room only with a one-time invite link.

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

async function hostRoom(browser: Browser, visibility: "By code" | "Private") {
  const name = e2eName();
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, name);
  await page.goto("/en/rooms/new");
  await page.getByLabel("Your name in this room").fill(name);
  // The radio itself is visually hidden; its label is what people click.
  await page.locator("label").filter({ hasText: visibility }).click();
  await page.getByRole("button", { name: "Create the room" }).click();
  await expect(page).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  return { page, context, code: page.url().split("/").at(-1) ?? "" };
}

async function joinAsGuest(page: Page, nickname: string): Promise<void> {
  await page.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = page.getByRole("dialog", { name: "Your name in this room" });
  await dialog.getByLabel("Name").fill(nickname);
  await dialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeVisible();
}

test("a guest joins a code-only room with its code from the home page", async ({ browser }) => {
  const host = await hostRoom(browser, "By code");
  await expect(host.page.getByRole("button", { name: "Make a link" })).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto("/en");
  await expect(guest.getByRole("link", { name: `Open room ${host.code}` })).toHaveCount(0);

  await guest.getByLabel("Room code").fill("ZZZZZZ");
  await guest.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guest.getByText("no open room has this code")).toBeVisible();

  await guest.getByLabel("Room code").fill(host.code.toLowerCase());
  await guest.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guest).toHaveURL(new RegExp(`/en/rooms/${host.code}$`));
  await joinAsGuest(guest, e2eName());

  await guestContext.close();
  await host.context.close();
});

test("a private room opens only with an invite link, once", async ({ browser }) => {
  const host = await hostRoom(browser, "Private");
  const nickname = e2eName();

  await host.page.getByRole("button", { name: "Make a link" }).click();
  const link = host.page.getByRole("textbox", { name: "Link 1" });
  await expect(link).toBeVisible();
  await expect(host.page.getByText("pending", { exact: true })).toBeVisible();
  // Only the path: APP_URL may point at another port than the test server's.
  const invitePath = new URL(await link.inputValue()).pathname;

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto("/en");
  await guest.getByLabel("Room code").fill(host.code);
  await guest.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guest.getByText("no open room has this code")).toBeVisible();

  await guest.goto(invitePath);
  await expect(guest.getByRole("heading", { name: `Invitation to room ${host.code}` })).toBeVisible();
  await joinAsGuest(guest, nickname);
  await expect(guest).toHaveURL(new RegExp(`/en/rooms/${host.code}$`));

  await expect(host.page.getByText(`accepted by ${nickname}`)).toBeVisible();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(invitePath);
  await expect(other.getByRole("heading", { name: "This link was already used" })).toBeVisible();

  await otherContext.close();
  await guestContext.close();
  await host.context.close();
});
