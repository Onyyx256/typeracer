import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUp } from "./accounts";
import { e2eName } from "./database";

// Around a real race: a visitor can't join while it runs, can once the
// results are up, and the host can then close the room from the results.

async function guestJoins(browser: Browser, code: string, nickname: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/en/rooms/${code}`);
  await joinAsRunner(page, nickname);
  return page;
}

async function joinAsRunner(page: Page, nickname: string): Promise<void> {
  await page.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = page.getByRole("dialog", { name: "Your name in this room" });
  await dialog.getByLabel("Name").fill(nickname);
  await dialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeVisible();
}

test("joining is closed during a race, open on the results, and the host can close the room there", async ({
  browser,
}) => {
  test.slow();
  const hostName = e2eName();
  const host = await (await browser.newContext()).newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await host.getByLabel("Length").fill("5");
  await host.getByRole("switch", { name: /^Catch-up bonuses/ }).uncheck({ force: true });
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  const code = host.url().split("/").at(-1) ?? "";

  const runner = await guestJoins(browser, code, e2eName());
  await host.getByRole("button", { name: "Start the race" }).click();
  await expect(host.getByText("The race starts in")).toBeVisible();
  const text = (await host.locator('p[aria-label="Text to type"]').innerText()).trim();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/en/rooms/${code}`);
  await expect(visitor.getByText("a race is on, you can join when it ends")).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });
  await visitor.reload();
  await expect(visitor.getByText("a race is on, you can join when it ends")).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await runner.getByRole("button", { name: "Give up" }).click();
  await runner
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();
  await host.getByLabel("Type the text here").focus();
  await host.keyboard.type(text, { delay: 40 });
  await expect(host.getByRole("heading", { name: "Results" })).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByText("> Results")).toBeVisible();
  const visitorName = e2eName();
  await joinAsRunner(visitor, visitorName);
  await expect(host.getByRole("button", { name: `Remove ${visitorName}` })).toBeVisible();

  await host.getByRole("button", { name: "Delete the room" }).click();
  await host
    .getByRole("dialog", { name: "Delete the room?" })
    .getByRole("button", { name: "Delete the room" })
    .click();
  await expect(host).toHaveURL(/\/en\/rooms$/);
  for (const page of [runner, visitor]) {
    await expect(page.getByRole("dialog", { name: "Your room has been deleted" })).toBeVisible();
  }
  await visitor.goto(`/en/rooms/${code}`);
  await expect(visitor.getByRole("button", { name: "Join as a runner" })).toHaveCount(0);

  await browser.contexts().reduce((done, context) => done.then(() => context.close()), Promise.resolve());
});
