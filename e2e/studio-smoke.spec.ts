import { expect, test } from "@playwright/test";

test("root redirects to the studio playground shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/studio\/playground$/);
  await expect(page).toHaveTitle(/Lemostudio/i);

  const header = page.locator("header").first();
  await expect(header.getByAltText("Lemo Studio")).toBeVisible();
  await expect(header.getByRole("button", { name: "Playground", exact: true })).toBeVisible();
  await expect(header.getByRole("button", { name: "Infinite Canvas", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
