import { expect, test } from "@playwright/test";

test.describe("ORBIT accessibility and RTL", () => {
  test("RTL document has one primary heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("navigation links have accessible names and targets", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      await expect(link).toHaveAccessibleName(/.+/);
      await expect(link).toHaveAttribute("href", /.+/);
    }
  });

  test("public controls have accessible labels", async ({ page }) => {
    await page.goto("/pricing/");
    const controls = page.locator("input, textarea, select");
    const count = await controls.count();

    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      const id = await control.getAttribute("id");
      const ariaLabel = await control.getAttribute("aria-label");
      const ariaLabelledBy = await control.getAttribute("aria-labelledby");
      const hasLabel = id
        ? (await page.locator(`label[for="${id}"]`).count()) > 0
        : false;

      expect(
        Boolean(ariaLabel || ariaLabelledBy || hasLabel),
        `control ${index} must have an accessible label`,
      ).toBe(true);
    }
  });

  test("interactive elements can receive focus", async ({ page }) => {
    await page.goto("/");
    const interactive = page.locator("a, button, input, textarea, select");
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const element = interactive.nth(index);
      await element.focus();
      await expect(element).toBeFocused();
    }
  });

  test("page has no duplicate ids", async ({ page }) => {
    await page.goto("/");
    const duplicateIds = await page.evaluate(() => {
      const seen = new Map<string, number>();

      for (const element of document.querySelectorAll("[id]")) {
        const id = element.id.trim();
        if (!id) continue;
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }

      return [...seen.entries()].filter(([, count]) => count > 1);
    });

    expect(duplicateIds).toEqual([]);
  });
});
