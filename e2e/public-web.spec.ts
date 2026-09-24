import { expect, test } from "@playwright/test";

test.describe("ORBIT public web surface", () => {
  test("home page exposes the product navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ORBIT/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ORBIT");
    await expect(page.getByRole("link", { name: "الأسعار" })).toBeVisible();
    await expect(page.getByRole("link", { name: "الخصوصية" })).toBeVisible();
    await expect(page.getByRole("link", { name: "الشروط" })).toBeVisible();
    await expect(page.getByRole("link", { name: "المستودع" })).toHaveAttribute(
      "href",
      /github.com\/ahmedsaturki\/ORBIT-MARKETING-OS/,
    );
  });

  test("pricing page renders every configured plan without a fake checkout", async ({ page }) => {
    await page.goto("/pricing/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الخطط والأسعار");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(4);
    await expect(page.getByText("Basic")).toBeVisible();
    await expect(page.getByText("Pro")).toBeVisible();
    await expect(page.getByText("Agency")).toBeVisible();
    await expect(page.getByText("Lifetime")).toBeVisible();
    await expect(page.getByText("رابط الشراء غير مضبوط")).toHaveCount(4);
  });

  test("legal pages are reachable", async ({ page }) => {
    for (const path of ["/legal/privacy/", "/legal/terms/"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /الرئيسية/ })).toHaveAttribute("href", "/");
    }
  });

  test("PWA manifest is valid and points at ORBIT branding", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toMatch(/ORBIT/i);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  test("unknown path returns a real 404 document", async ({ request }) => {
    const response = await request.get("/this-path-does-not-exist/");
    expect(response.status()).toBe(404);
  });
});
