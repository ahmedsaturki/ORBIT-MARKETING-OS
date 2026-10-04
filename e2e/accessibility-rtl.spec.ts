import { expect, test } from "@playwright/test";

test.describe("ORBIT accessibility and RTL", () => {
  test("RTL document has one primary heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("navigation links have accessible names and targets", async ({
    page,
  }) => {
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

  test("public routes pass the automated structural accessibility audit", async ({
    page,
  }) => {
    for (const path of ["/", "/pricing/", "/legal/privacy/", "/legal/terms/"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      const unnamedControls = await page
        .locator('button, input, textarea, select, [role="button"]')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const label =
                element.getAttribute("aria-label")?.trim() ??
                element.getAttribute("title")?.trim() ??
                "";
              return !label && !element.textContent?.trim();
            })
            .map((element) => element.tagName),
        );
      expect(unnamedControls).toEqual([]);

      const missingAlt = await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter((image) => !image.hasAttribute("alt"))
            .map((image) => image.getAttribute("src") ?? "unknown"),
        );
      expect(missingAlt).toEqual([]);

      const duplicateIds = await page.evaluate(() => {
        const seen = new Map<string, number>();
        for (const element of document.querySelectorAll("[id]")) {
          const id = element.id.trim();
          if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
        }
        return [...seen.entries()]
          .filter(([, count]) => count > 1)
          .map(([id]) => id);
      });
      expect(duplicateIds).toEqual([]);
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

  test("every public route exposes a working skip link to main content", async ({
    page,
  }) => {
    for (const path of ["/", "/pricing/", "/legal/privacy/", "/legal/terms/"]) {
      await page.goto(path);

      const skipLink = page.locator('a.skip-link[href="#main-content"]');
      await expect(skipLink).toHaveCount(1);

      // WCAG 2.4.1: the bypass mechanism must actually reach the target,
      // not merely exist.
      const targetId = await skipLink.getAttribute("href");
      expect(targetId).toBe("#main-content");
      await expect(page.locator("#main-content")).toHaveCount(1);

      // It must be hidden out of the visual flow until focused. In an RTL
      // document `inset-inline-start: -9999px` resolves to the inline END,
      // i.e. off-screen to the right, so the correct off-screen predicate is
      // "entirely past the right viewport edge", not "off the left".
      const box = await skipLink.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: window.innerWidth };
      });
      expect(box.left).toBeGreaterThanOrEqual(box.width);

      await page.keyboard.press("Tab");
      await expect(skipLink).toBeFocused();

      // Once focused it must actually be on screen, or it is not a usable
      // bypass mechanism.
      const focusedBox = await skipLink.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: window.innerWidth };
      });
      expect(focusedBox.right).toBeLessThanOrEqual(focusedBox.width);
      expect(focusedBox.left).toBeGreaterThanOrEqual(0);
    }
  });

  test("every public route exposes banner, navigation and contentinfo landmarks", async ({
    page,
  }) => {
    // WCAG 1.3.1 / 2.4.1: sub-pages previously rendered <main> only, so
    // assistive tech had no site-wide navigation or footer landmark to jump to.
    for (const path of [
      "/",
      "/pricing/",
      "/legal/privacy/",
      "/legal/terms/",
      "/legal/eula/",
      "/legal/refunds/",
    ]) {
      await page.goto(path);
      await expect(page.locator("main#main-content")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("navigation")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
    }
  });
});
