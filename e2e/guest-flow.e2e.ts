import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2eName } from "./database";

// A visitor with no account finds a public room, joins it as a guest under
// a nickname, and leaves. The host's page, in another browser, follows along.

/** A throwaway password for the test account; this only ever runs against typeracer_test. */
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

/** Signs in through the login form, first with a wrong password, which is refused. */
async function logIn(page: Page, username: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Username").fill(username);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill(`${PASSWORD}-wrong`);
  // Enter submits: the mode tab is also a "Log in" button.
  await password.press("Enter");
  await expect(page.getByText("incorrect username or password")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/login$/);

  await password.fill(PASSWORD);
  await password.press("Enter");
  await expect(page).toHaveURL(/\/en$/);
}

/** An account made in a browser of its own, so the test then signs in from scratch. */
async function createAccount(browser: Browser, username: string): Promise<void> {
  const context = await browser.newContext();
  await signUp(await context.newPage(), username);
  await context.close();
}

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto("/en/rooms/new");
  await page.getByLabel("Your name in this room").fill(name);
  await page.getByRole("button", { name: "Create the room" }).click();
  await expect(page).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  return page.url().split("/").at(-1) ?? "";
}

test("a guest joins a public room under a nickname, then leaves", async ({ browser }) => {
  const hostName = e2eName();
  const nickname = e2eName();

  await createAccount(browser, hostName);
  // An account that never enters the room: its username stays free there.
  await createAccount(browser, nickname);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await logIn(host, hostName);
  const code = await createRoom(host, hostName);
  const hostRunners = host.locator("section", { has: host.getByRole("heading", { name: /Runners/ }) });
  await expect(hostRunners.getByRole("listitem")).toHaveCount(1);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto("/en/rooms");
  await guest.getByRole("link", { name: new RegExp(code) }).click();
  await expect(guest).toHaveURL(new RegExp(`/en/rooms/${code}$`));
  await expect(guest.getByRole("heading", { level: 1 })).toContainText(code);
  await expect(guest.getByRole("button", { name: "Leave the room" })).toHaveCount(0);

  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await expect(dialog).toBeVisible();
  const nameField = dialog.getByLabel("Name");
  const submit = dialog.getByRole("button", { name: "Join as a runner" });
  await expect(nameField).toHaveValue("");

  await nameField.fill("ab");
  await submit.click();
  await expect(dialog.getByText("your name must be 3 to 20 characters")).toBeVisible();

  await nameField.fill("<script>");
  await submit.click();
  await expect(dialog.getByText("letters, numbers, spaces and . _ ' - only")).toBeVisible();

  // The host's name, in other letter case: someone in the room already uses it.
  await nameField.fill(hostName.toUpperCase());
  await submit.click();
  await expect(dialog.getByText("someone in this room already goes by that name")).toBeVisible();

  // The nickname is also another account's username, but that account isn't
  // in the room, so the guest gets in under it.
  await nameField.fill(nickname);
  await submit.click();
  await expect(dialog).toBeHidden();
  const guestRunners = guest.locator("section", { has: guest.getByRole("heading", { name: /Runners/ }) });
  const me = guestRunners.getByRole("listitem").filter({ hasText: nickname });
  await expect(me).toContainText("(you)");
  await expect(me).toContainText("guest");
  await expect(guestRunners.getByRole("listitem").filter({ hasText: hostName })).toContainText(
    "host",
  );
  await expect(guest.getByRole("button", { name: "Leave the room" })).toBeVisible();

  const guestOnHostPage = hostRunners.getByRole("listitem").filter({ hasText: nickname });
  await expect(guestOnHostPage).toBeVisible();
  await expect(guestOnHostPage).toContainText("guest");

  await guest.reload();
  await expect(me).toContainText("(you)");

  await guest.getByRole("button", { name: "Leave the room" }).click();
  await expect(guest).toHaveURL(/\/en\/rooms$/);
  await expect(guestOnHostPage).toHaveCount(0);
  await expect(hostRunners.getByRole("listitem")).toHaveCount(1);

  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a spectator" }).click();
  await expect(dialog.getByLabel("Name")).toHaveValue(nickname);

  await guestContext.close();
  await hostContext.close();
});
