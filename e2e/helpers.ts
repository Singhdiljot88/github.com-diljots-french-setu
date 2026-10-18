import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;

/** Signs up and completes onboarding with defaults (absolute beginner, starting today). */
export async function signUpAndOnboard(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  for (let i = 0; i < 10; i++) {
    const start = page.getByRole("button", { name: /^Start Day/ });
    if (await start.isVisible()) { await start.click(); break; }
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.waitForURL("**/today");
  return { email, password: "password123" };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/today");
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
