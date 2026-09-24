import { expect, test } from "@playwright/test";

test.describe("critical E2E paths (QA-02)", () => {
  test("boots to the branded app shell", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SOCIAL AUTOMATION OS" }),
    ).toBeVisible();
    await expect(
      page.locator("header").getByText("Local-First Social Media Automation Platform", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByText("All Systems Operational")).toBeVisible();
    await expect(page).toHaveTitle(/Orbit Marketing OS/);
  });

  test("production API health responds ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("Orbit Marketing OS Backend");
  });

  test("navigation switches primary workspaces and keeps the shell", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.locator("header nav");

    // Default tab: AI chatbot panel.
    await expect(nav.getByText("المساعد الذكي (AI Chatbot)")).toBeVisible();

    // Campaigns workspace.
    await nav.getByRole("button", { name: "إدارة الحملات والجدولة" }).click();
    await expect(
      page.getByRole("heading", { name: "إدارة وجدولة الحملات متعددة المنصات" }),
    ).toBeVisible();

    // Unified inbox workspace.
    await nav.getByRole("button", { name: "صندوق المحادثات الموحد" }).click();
    await expect(
      page.getByRole("heading", {
        name: "صندوق المحادثات الموحد وإدارة علاقات العملاء (CRM)",
      }),
    ).toBeVisible();

    // Shell (header/footer) survives navigation.
    await expect(
      page.getByRole("heading", { name: "SOCIAL AUTOMATION OS" }),
    ).toBeVisible();
    await expect(page.getByText("All Systems Operational")).toBeVisible();
  });

  test("static production assets are served", async ({ request }) => {
    for (const path of ["/", "/manifest.webmanifest", "/sw.js"]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be 200`).toBe(200);
    }
  });
});
