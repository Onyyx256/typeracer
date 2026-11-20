import { expect, test, type Page } from "@playwright/test";

// A slow phone or a password manager can submit the login form before React
// runs: the browser would then send the form itself, as a GET with the
// password in the URL unless the form says otherwise.

function loginForm(page: Page) {
  return page.locator("form").filter({ has: page.getByLabel("Password", { exact: true }) });
}

test.describe("the login form without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("cannot be submitted, and would never put the password in the URL", async ({ page }) => {
    await page.goto("/en/login");
    const form = loginForm(page);
    await expect(form).toHaveAttribute("method", "post");

    await page.getByLabel("Username").fill("someone");
    await page.getByLabel("Password", { exact: true }).fill("not-in-the-url");
    await expect(form.getByRole("button", { name: "Log in" })).toBeDisabled();
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/en\/login$/);
  });
});

test("the login button works once the page is ready", async ({ page }) => {
  await page.goto("/en/login");
  await expect(loginForm(page).getByRole("button", { name: "Log in" })).toBeEnabled();
});
