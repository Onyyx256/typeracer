import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2eName } from "./database";

// TEST-02: a visitor with no account finds a public room, joins it as a
// guest under a nickname (AUTH-02), and leaves. The host's page, in another
// browser, follows along live.

/** A throwaway password for the test account; this only ever runs against typeracer_test. */
const PASSWORD = "e2e-password-1234";

/** Signs up through the form (TEST-03: username and password, no OAuth). */
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

/** Creates a public room with the default settings and returns its code. */
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

  // The host signs in through the login form, in their own browser.
  await createAccount(browser, hostName);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await logIn(host, hostName);
  const code = await createRoom(host, hostName);
  const hostRunners = host.locator("section", { has: host.getByRole("heading", { name: /Runners/ }) });
  await expect(hostRunners.getByRole("listitem")).toHaveCount(1);

  // The visitor: a fresh browser with no session, finding the room in the list.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto("/en/rooms");
  await guest.getByRole("link", { name: new RegExp(code) }).click();
  await expect(guest).toHaveURL(new RegExp(`/en/rooms/${code}$`));
  await expect(guest.getByRole("heading", { level: 1 })).toContainText(code);
  await expect(guest.getByRole("button", { name: "Leave the room" })).toHaveCount(0);

  // Picking a name in the dialog.
  await guest.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = guest.getByRole("dialog", { name: "Your name in this room" });
  await expect(dialog).toBeVisible();
  const nameField = dialog.getByLabel("Name");
  const submit = dialog.getByRole("button", { name: "Join as a runner" });
  await expect(nameField).toHaveValue("");

  // Too short.
  await nameField.fill("ab");
  await submit.click();
  await expect(dialog.getByText("your name must be 3 to 20 characters")).toBeVisible();

  // A character that isn't allowed.
  await nameField.fill("<script>");
  await submit.click();
  await expect(dialog.getByText("letters, numbers, spaces and . _ ' - only")).toBeVisible();

  // The host's username, in other letter case: it belongs to their account.
  await nameField.fill(hostName.toUpperCase());
  await submit.click();
  await expect(
    dialog.getByText("this name belongs to another account, pick another one"),
  ).toBeVisible();

  // A free nickname gets them in, as a guest.
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

  // The host sees the guest arrive without reloading (Socket.IO).
  const guestOnHostPage = hostRunners.getByRole("listitem").filter({ hasText: nickname });
  await expect(guestOnHostPage).toBeVisible();
  await expect(guestOnHostPage).toContainText("guest");

  // The session survives a reload: still in the room.
  await guest.reload();
  await expect(me).toContainText("(you)");

  // Leaving goes back to the room list, and the host sees them go.
  await guest.getByRole("button", { name: "Leave the room" }).click();
  await expect(guest).toHaveURL(/\/en\/rooms$/);
  await expect(guestOnHostPage).toHaveCount(0);
  await expect(hostRunners.getByRole("listitem")).toHaveCount(1);

  // Coming back, the guest's nickname is already filled in.
  await guest.goto(`/en/rooms/${code}`);
  await guest.getByRole("button", { name: "Join as a spectator" }).click();
  await expect(dialog.getByLabel("Name")).toHaveValue(nickname);

  await guestContext.close();
  await hostContext.close();
});
