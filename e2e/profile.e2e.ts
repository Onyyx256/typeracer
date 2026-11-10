import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2eName } from "./database";

// The account page: profile photo, display name and flower colours, for a
// new account that has never raced.

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

test("a new account sets a photo, a display name and its free colours", async ({ page }) => {
  const username = e2eName();
  await signUp(page, username);
  await page.goto("/en/account");
  // A file chosen before hydration would be lost: no change handler yet.
  await page.waitForLoadState("networkidle");

  const photoInput = page.locator('input[type="file"][name="photo"]');
  const status = page.getByRole("status").first();
  const headerPhoto = page.getByRole("banner").locator('img[src^="/api/avatars/"]');

  // A text file renamed .png is refused: the server reads the bytes.
  await photoInput.setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await expect(status).toHaveText("> this file isn't a JPEG, PNG or WebP photo");
  await expect(headerPhoto).toHaveCount(0);

  const photo = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#309975" },
  })
    .jpeg()
    .toBuffer();
  await photoInput.setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(status).toHaveText("> photo updated");
  await expect(headerPhoto).toBeVisible();
  const served = await page.request.get((await headerPhoto.getAttribute("src")) ?? "");
  expect(served.headers()["content-type"]).toBe("image/webp");
  expect((await sharp(await served.body()).metadata()).width).toBe(256);

  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(status).toHaveText("> photo removed");
  await expect(headerPhoto).toHaveCount(0);

  const name = page.getByRole("textbox", { name: "Display name" });
  const saveName = page.locator("form").filter({ has: name }).getByRole("button", { name: "Save" });
  await name.fill("x");
  await saveName.click();
  await expect(page.getByText("between 3 and 20 characters")).toBeVisible();
  const newName = `${username}-z`.slice(0, 20);
  await name.fill(newName);
  await saveName.click();
  await expect(page.getByText("> name saved")).toBeVisible();
  await expect(page.getByRole("link", { name: `My account (${newName})` })).toBeVisible();

  await expect(page.getByText("> 0 races · 0 wins · best 0 WPM")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Sky/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /^Midnight/ })).toBeDisabled();
  await page.getByRole("radio", { name: /^Fern/ }).check({ force: true });
  await page.getByRole("radio", { name: /^Snow/ }).check({ force: true });
  await page.getByRole("button", { name: "Save" }).last().click();
  await expect(page.getByText("> colours saved")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { name: /^Fern/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^Snow/ })).toBeChecked();
});
