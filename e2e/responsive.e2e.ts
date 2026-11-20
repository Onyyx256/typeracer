import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUp } from "./accounts";
import { e2eName } from "./database";

// Every page at the narrowest supported width (360 px): nothing scrolls
// sideways, and a runner on a phone gets the physical keyboard message in a
// real race instead of the typing box.

const PHONE = { width: 360, height: 740 };
const MOBILE_MESSAGE = "Racing needs a computer with a physical keyboard";

async function phonePage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true });
  return context.newPage();
}

async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  // Waits for the fonts, which change the width of long words.
  await page.evaluate(() => document.fonts.ready);
  const { width, suspects } = await page.evaluate((screen) => {
    // Absolutely positioned elements first: one with no positioned ancestor
    // escapes a scrolling frame and widens the whole page.
    const past = [...document.querySelectorAll("body *")].filter(
      (element) => element.getBoundingClientRect().right > screen + 0.5,
    );
    const absolute = past.filter((element) => getComputedStyle(element).position === "absolute");
    return {
      width: document.documentElement.scrollWidth,
      suspects: [...absolute, ...past]
        .slice(0, 5)
        .map((element) => `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}">`),
    };
  }, PHONE.width);
  expect(width, `${where} is wider than the screen; past its edge: ${suspects.join(", ")}`).toBeLessThanOrEqual(
    PHONE.width,
  );
}

async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expectNoSidewaysScroll(page, path);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await expectNoSidewaysScroll(page, `${path} with the menu open`);
}

async function closeAll(browser: Browser): Promise<void> {
  await browser.contexts().reduce((done, context) => done.then(() => context.close()), Promise.resolve());
}

test("pages fit a 360 px screen for a visitor", async ({ browser }) => {
  const page = await phonePage(browser);
  for (const path of ["/en", "/fr", "/en/login", "/en/rooms", "/en/practice", "/en/no-such-page"]) {
    await visit(page, path);
  }
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expectNoSidewaysScroll(page, "the sign-up form");
  await closeAll(browser);
});

test("a runner on a phone races with the keyboard message, then every page fits 360 px", async ({
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

  const phone = await phonePage(browser);
  const phoneName = e2eName();
  await signUp(phone, phoneName);
  await visit(phone, "/en/rooms/new");
  await phone.goto(`/en/rooms/${code}`);
  await expectNoSidewaysScroll(phone, "the room before joining");
  await phone.getByRole("button", { name: "Join as a runner" }).click();
  const dialog = phone.getByRole("dialog", { name: "Your name in this room" });
  await expectNoSidewaysScroll(phone, "the join dialog");
  await dialog.getByLabel("Name").fill(phoneName);
  await dialog.getByRole("button", { name: "Join as a runner" }).click();
  await expect(phone.getByRole("button", { name: "Leave the room" })).toBeVisible();
  await expectNoSidewaysScroll(phone, "the waiting room");

  await host.getByRole("button", { name: "Start the race" }).click();
  const text = (await host.locator('p[aria-label="Text to type"]').innerText()).trim();
  await expect(host.getByText("The race starts in")).toBeHidden({ timeout: 6_000 });

  await expect(phone.getByText(MOBILE_MESSAGE)).toBeVisible();
  await expect(phone.getByLabel("Type the text here")).toBeHidden();
  await expect(phone.getByRole("listitem", { name: new RegExp(`^${hostName}:`) })).toBeVisible();
  await expectNoSidewaysScroll(phone, "the race");

  await phone.getByRole("button", { name: "Give up" }).click();
  await phone
    .getByRole("dialog", { name: "Give up the race?" })
    .getByRole("button", { name: "Give up", exact: true })
    .click();
  await host.getByLabel("Type the text here").focus();
  await host.keyboard.type(text, { delay: 40 });

  await expect(phone.getByRole("heading", { name: "Results" })).toBeVisible();
  await expectNoSidewaysScroll(phone, "the results");

  await phone.getByRole("button", { name: "Leave the room" }).click();
  await expect(phone).toHaveURL(/\/en\/rooms$/);

  await visit(phone, "/en/stats");
  const raceLink = phone.locator('a[href*="/en/stats/races/"]').first();
  await expect(raceLink).toBeVisible();
  await visit(phone, (await raceLink.getAttribute("href")) ?? "");
  await visit(phone, "/en/account");
  await visit(phone, "/en/practice");

  await phone.getByRole("radio", { name: /^Random/ }).check({ force: true });
  await phone.getByLabel("Length").fill("5");
  await phone.getByRole("button", { name: "Start", exact: true }).click();
  await expect(phone.getByText(MOBILE_MESSAGE)).toBeVisible({ timeout: 6_000 });
  await expect(phone.getByLabel("Type the text here")).toBeHidden();
  await expectNoSidewaysScroll(phone, "a practice run");

  await closeAll(browser);
});

test("a private room's invite page fits 360 px", async ({ browser }) => {
  const hostName = e2eName();
  const host = await (await browser.newContext()).newPage();
  await signUp(host, hostName);
  await host.goto("/en/rooms/new");
  await host.getByLabel("Your name in this room").fill(hostName);
  await host.getByRole("radio", { name: /^Private/ }).check({ force: true });
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-HJKMNP-Z2-9]{6}$/);
  await host.getByRole("button", { name: "Make a link" }).click();
  const link = host.getByRole("textbox", { name: "Link 1" });
  await expect(link).toBeVisible();
  const invitePath = new URL(await link.inputValue()).pathname;

  const phone = await phonePage(browser);
  await visit(phone, invitePath);
  await expect(phone.getByRole("heading", { name: "Invitation to a private room" })).toBeVisible();

  await closeAll(browser);
});
