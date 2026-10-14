import { test, expect } from "@playwright/test";
test("feed control defaults to Following and Suggested is explicit opt in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "● Following", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Suggested", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Opt in to Suggested feed" }).click();
  await page.getByRole("button", { name: "Suggested", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Most helpful", exact: true }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Opt in to Suggested feed" }).click();
  await expect(
    page.getByRole("button", { name: "● Following", exact: true }),
  ).toBeVisible();
});
test("Hindi changes feed labels and account fields have accessible labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "HI", exact: true }).click();
  await expect(page.getByText("बातचीत", { exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByLabel("ईमेल", { exact: true })).toBeVisible();
  await expect(page.getByLabel("पासवर्ड", { exact: true })).toBeVisible();
});

test("public web controls satisfy automated WCAG AA checks", async ({
  page,
}) => {
  const AxeBuilder = (await import("@axe-core/playwright")).default;
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
