import { expect, type Page } from "@playwright/test";

/** A throwaway password for the test accounts; this only ever runs against typeracer_test. */
export const PASSWORD = "e2e-password-1234";

/** Creates an account through the sign-up form, which also signs it in. */
export async function signUp(page: Page, username: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/en\/rooms$/);
}
