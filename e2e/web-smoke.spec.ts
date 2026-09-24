import { expect, test } from "@playwright/test";

test("home page exposes core product navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ORBIT Marketing OS/i);
  await expect(page.getByRole("heading", { name: /مركز تشغيل تسويقك/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "الأسعار" })).toBeVisible();
  await expect(page.getByRole("link", { name: "الخصوصية" })).toBeVisible();
  await expect(page.getByRole("link", { name: "الشروط" })).toBeVisible();
});

test("pricing page renders all license plans without fake checkout links", async ({ page }) => {
  await page.goto("/pricing/");
  await expect(page.getByRole("heading", { name: "الخطط والأسعار" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agency" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lifetime" })).toBeVisible();
  await expect(page.getByText("رابط الشراء غير مضبوط").count()).toBeGreaterThan(0);
});

test("legal pages are reachable from navigation", async ({ page }) => {
  await page.goto("/legal/privacy/");
  await expect(page.getByRole("heading", { name: "سياسة الخصوصية" })).toBeVisible();
  await page.getByRole("link", { name: /الرئيسية/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/legal/terms/");
  await expect(page.getByRole("heading", { name: "شروط الاستخدام" })).toBeVisible();
});

test("static server rejects traversal attempts", async ({ request }) => {
  const response = await request.get("/%2e%2e/package.json");
  expect([400, 404]).toContain(response.status());
  const body = await response.text();
  expect(body).not.toContain('"scripts"');
});


test("PWA manifest and service worker assets are reachable", async ({ request }) => {
  const manifest = await request.get("/manifest.json");
  expect(manifest.ok()).toBe(true);
  const manifestBody = (await manifest.json()) as { start_url?: string; display?: string; dir?: string; lang?: string };
  expect(manifestBody.start_url).toBeDefined();
  expect(manifestBody.display).toBeDefined();

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain("addEventListener");
});
