import { expect, test, type Browser, type Page } from "@playwright/test";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}
const EXE_CANDIDATES = [
  process.env.TAURI_EXE,
  "D:/orbit-cargo-target/x86_64-pc-windows-msvc/release/orbit-marketing-os.exe",
  "packages/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/orbit-marketing-os.exe",
  "packages/desktop/src-tauri/target/release/orbit-marketing-os.exe",
].filter(Boolean) as string[];
const exe = EXE_CANDIDATES.find((p) => existsSync(p));
const CDP_PORT = 9340;

let proc: ChildProcess | null = null;
let browser: Browser | null = null;
let page: Page | null = null;

async function bootApp(): Promise<void> {
  try {
    execSync("taskkill /im orbit-marketing-os.exe /F", { stdio: "ignore" });
  } catch {
    /* no leftover instance */
  }

  proc = spawn(exe!, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
    },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 6000));

  const { chromium } = await import("@playwright/test");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const ctx = browser.contexts()[0];
  page = ctx.pages()[0] ?? (await ctx.waitForEvent("page"));
  await page.waitForURL(/tauri\.localhost/, { timeout: 10_000 });

  await expect(page).toHaveTitle(/Orbit Marketing OS/);
  expect(await page.evaluate(() => typeof window.__TAURI_INTERNALS__)).toBe(
    "object",
  );
}

async function killApp(): Promise<void> {
  if (browser) await browser.close().catch(() => {});
  browser = null;
  page = null;
  if (proc?.pid) {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  }
  proc = null;
}

test.describe("Tauri renderer capability isolation (SEC-03)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !exe,
    "Tauri binary not built — run node scripts/build-tauri.mjs --release first",
  );

  test.afterAll(async () => {
    await killApp();
  });

  test("capability files are deny-by-default and least-privilege (capability review)", () => {
    const capability = JSON.parse(
      readFileSync(
        join(root, "packages/desktop/src-tauri/capabilities/default.json"),
        "utf8",
      ),
    );
    // Exactly one grant: core:default — no fs/shell/http/clipboard/dialog/updater.
    expect(capability.permissions).toEqual(["core:default"]);
    expect(capability.windows).toEqual(["main"]);
    for (const perm of capability.permissions) {
      expect(perm).not.toMatch(/\*/);
      expect(perm).not.toMatch(
        /^(fs|shell|http|clipboard|dialog|updater|process|path:allow-write)/,
      );
    }

    // The build must have resolved that capability to itself — nothing broader.
    const resolved = JSON.parse(
      readFileSync(
        join(root, "packages/desktop/src-tauri/gen/schemas/capabilities.json"),
        "utf8",
      ),
    );
    expect(resolved.default.windows).toEqual(["main"]);
    expect(resolved.default.permissions).toEqual(["core:default"]);

    const conf = JSON.parse(
      readFileSync(join(root, "packages/desktop/src-tauri/tauri.conf.json"), "utf8"),
    );
    const security = conf.app.security;
    // Strict CSP: no unsafe-eval, no remote script origins, framed embedding off.
    expect(security.csp).toMatch(/default-src 'self'/);
    expect(security.csp).toMatch(/script-src 'self'/);
    expect(security.csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(security.csp).not.toMatch(/script-src[^;]*https?:/);
    expect(security.csp).toMatch(/object-src 'none'/);
    expect(security.csp).toMatch(/frame-ancestors 'none'/);
    expect(security.freezePrototype).toBe(true);
    expect(security.dangerousDisableAssetCspModification).toBe(false);
  });

  test("renderer boots in the isolated shell and IPC positive control works", async () => {
    await bootApp();

    // Positive control: scale_factor is inside core:default — proves IPC works.
    const granted = await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("plugin:window|scale_factor", {}),
    );
    expect(typeof granted).toBe("number");
    expect(granted as number).toBeGreaterThan(0);
  });

  test("denied capabilities reject at the ACL and the window survives", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const denied = await page!.evaluate(async () => {
      const out: Record<string, { ok: boolean; error: string }> = {};
      for (const cmd of ["plugin:window|destroy", "plugin:fs|read_text_file"]) {
        try {
          await window.__TAURI_INTERNALS__.invoke(
            cmd,
            cmd.includes("fs") ? { path: "C:/Windows/win.ini" } : {},
          );
          out[cmd] = { ok: true, error: "" };
        } catch (e) {
          out[cmd] = { ok: false, error: String(e) };
        }
      }
      return out;
    });

    for (const cmd of ["plugin:window|destroy", "plugin:fs|read_text_file"]) {
      expect(
        denied[cmd].ok,
        `${cmd} must be denied by the ACL`,
      ).toBe(false);
      expect(denied[cmd].error).toContain("not allowed by ACL");
    }

    // The destroy attempt did not take effect — window/process still alive.
    expect(await page!.evaluate(() => document.title.length)).toBeGreaterThan(
      0,
    );
    expect(proc!.killed).toBe(false);
  });

  test("workspace selection persists after application restart", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const workspace = (await page!.evaluate(
      async (workspaceId) => {
        return (await window.__TAURI_INTERNALS__.invoke("workspace_create", {
          id: workspaceId,
          name: "Restart Persistence Workspace",
        })) as { id: string };
      },
      "e2e-restart-" + Date.now(),
    )) as { id: string };

    await page!.evaluate(async (id) => {
      await window.__TAURI_INTERNALS__.invoke("workspace_select", { id });
    }, workspace.id);

    const beforeRestart = (await page!.evaluate(async () => {
      return (await window.__TAURI_INTERNALS__.invoke("workspace_current")) as { id: string };
    })) as { id: string };
    expect(beforeRestart.id).toBe(workspace.id);

    await killApp();
    await bootApp();

    const afterRestart = (await page!.evaluate(async () => {
      return (await window.__TAURI_INTERNALS__.invoke("workspace_current")) as { id: string };
    })) as { id: string };

    expect(afterRestart.id).toBe(workspace.id);
  });

  test("CSP blocks remote script injection", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const violations = await page!.evaluate(async () => {
      const seen: string[] = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        seen.push(`${e.violatedDirective}|${e.blockedURI}`),
      );
      const s = document.createElement("script");
      s.src = "https://example.com/probe.js";
      document.head.appendChild(s);
      await new Promise((r) => setTimeout(r, 2000));
      return seen;
    });

    expect(violations.some((v) => v.startsWith("script-src"))).toBe(true);
    expect(violations.join(",")).toContain("https://example.com/probe.js");
  });
});
