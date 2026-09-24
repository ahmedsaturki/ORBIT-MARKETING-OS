import { expect, test } from "@playwright/test";

test.describe("PWA manifest and service worker (WEB-01)", () => {
  test("manifest is linked, served, and its icons resolve", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Orbit Marketing OS");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), `${icon.src} should be 200`).toBe(200);
    }
  });

  test("service worker installs, activates, and controls the page", async ({
    page,
  }) => {
    await page.goto("/");
    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return {
        hasActive: Boolean(reg.active),
        scope: reg.scope,
        scriptUrl: reg.active?.scriptURL ?? null,
      };
    });
    expect(registration.hasActive).toBe(true);
    expect(registration.scriptUrl).toContain("/sw.js");

    // clients.claim() hands control to the already-open page.
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 20_000 },
    );
  });

  test("app shell loads while offline after one controlled visit", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 20_000 },
    );

    // One online controlled reload: the fetch handler caches the hashed
    // JS/CSS assets so the shell is complete offline.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "SOCIAL AUTOMATION OS" }),
    ).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // Served from the cache (network is down).
    await expect(
      page.getByRole("heading", { name: "SOCIAL AUTOMATION OS" }),
    ).toBeVisible();
    await expect(page.getByText("All Systems Operational")).toBeVisible();

    await context.setOffline(false);
  });
});
