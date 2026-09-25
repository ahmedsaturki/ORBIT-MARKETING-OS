import { expect, test, type Browser, type Page } from "@playwright/test";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
const CDP_PORT = 9340 + Number(process.env.PLAYWRIGHT_WORKER_INDEX ?? "0");

let proc: ChildProcess | null = null;
let browser: Browser | null = null;
let page: Page | null = null;
let processOutput = "";
const webview2UserDataFolders = new Set<string>();
function createWebView2UserDataFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "orbit-webview2-e2e-"));
  webview2UserDataFolders.add(folder);
  return folder;
}

function cleanupWebView2UserDataFolders(): void {
  for (const folder of webview2UserDataFolders) {
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch {
      /* WebView2 may still have a file handle during runner cleanup. */
    }
  }
  webview2UserDataFolders.clear();
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
  processOutput = "";
}

async function launchAndConnectTauri(): Promise<void> {
  if (!exe) throw new Error("Tauri executable is missing");

  try {
    execSync("taskkill /im orbit-marketing-os.exe /F", { stdio: "ignore" });
  } catch {
    /* no leftover instance */
  }

  processOutput = "";
  const webview2UserDataFolder = createWebView2UserDataFolder();
  const child = spawn(exe, [], {
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: webview2UserDataFolder,
      ORBIT_E2E_CDP_PORT: String(CDP_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  proc = child;

  const capture = (chunk: Buffer | string): void => {
    processOutput = (processOutput + String(chunk)).slice(-12_000);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);

  const { chromium } = await import("@playwright/test");
  const deadline = Date.now() + 45_000;
  let lastError = "CDP endpoint did not become available";

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Tauri process exited with code ${child.exitCode} before WebView2 CDP became ready. Output:\n${processOutput}`,
      );
    }

    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      return;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `Timed out waiting for WebView2 CDP on 127.0.0.1:${CDP_PORT}. Last error: ${lastError}. Process output:\n${processOutput}`,
  );
}

async function connectToCurrentTauri(): Promise<void> {
  const { chromium } = await import("@playwright/test");
  if (proc?.exitCode !== null) {
    throw new Error(
      `Tauri process is not running (exit ${proc.exitCode}). Output:\n${processOutput}`,
    );
  }
  const deadline = Date.now() + 15_000;
  let lastError = "CDP endpoint unavailable";
  while (Date.now() < deadline) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      return;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(
    `Timed out reconnecting to WebView2 CDP on 127.0.0.1:${CDP_PORT}. Last error: ${lastError}. Output:\n${processOutput}`,
  );
}

test.describe("Tauri renderer capability isolation (SEC-03)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);
  test.skip(
    !exe,
    "Tauri binary not built — run node scripts/build-tauri.mjs --release first",
  );

  test.afterAll(async () => {
    await killApp();
    cleanupWebView2UserDataFolders();
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
      readFileSync(
        join(root, "packages/desktop/src-tauri/tauri.conf.json"),
        "utf8",
      ),
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
    try {
      execSync("taskkill /im orbit-marketing-os.exe /F", { stdio: "ignore" });
    } catch {
      /* no leftover instance */
    }
    await launchAndConnectTauri();
    const ctx = browser.contexts()[0];
    page = ctx.pages()[0] ?? (await ctx.waitForEvent("page"));
    await page.waitForURL(/tauri\.localhost/, { timeout: 10_000 });

    await expect(page).toHaveTitle(/Orbit Marketing OS/);
    expect(await page.evaluate(() => typeof window.__TAURI_INTERNALS__)).toBe(
      "object",
    );

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
      expect(denied[cmd].ok, `${cmd} must be denied by the ACL`).toBe(false);
      expect(denied[cmd].error).toContain("not allowed by ACL");
    }

    // The destroy attempt did not take effect — window/process still alive.
    expect(await page!.evaluate(() => document.title.length)).toBeGreaterThan(
      0,
    );
    expect(proc!.killed).toBe(false);
  });

  test("native runtime restart preserves selected workspace state", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const before = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("workspace_current"),
    )) as { id: string; name: string };

    const created = (await page!.evaluate(async () => {
      const id = "e2e-restart-" + Date.now();
      return window.__TAURI_INTERNALS__.invoke("workspace_create", {
        id,
        name: "E2E Restart Workspace",
      });
    })) as { id: string; name: string };

    await page!.evaluate(
      (workspaceId) =>
        window.__TAURI_INTERNALS__.invoke("workspace_select", {
          id: workspaceId,
        }),
      created.id,
    );

    const selected = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("workspace_current"),
    )) as { id: string; name: string };
    expect(selected.id).toBe(created.id);
    expect(selected.name).toBe(created.name);

    // Abruptly terminate the native process and relaunch it. This exercises
    // persisted runtime state after a crash-like process stop.
    await killApp();

    await launchAndConnectTauri();
    const ctx = browser.contexts()[0];
    page = ctx.pages()[0] ?? (await ctx.waitForEvent("page"));
    await page.waitForURL(/tauri\.localhost/, { timeout: 10_000 });

    const after = (await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("workspace_current"),
    )) as { id: string; name: string };

    expect(after.id).toBe(created.id);
    expect(after.name).toBe(created.name);

    // Restore the original workspace so later tests do not inherit test state.
    await page.evaluate(
      (workspaceId) =>
        window.__TAURI_INTERNALS__.invoke("workspace_select", {
          id: workspaceId,
        }),
      before.id,
    );
    const restored = (await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("workspace_current"),
    )) as { id: string; name: string };
    expect(restored.id).toBe(before.id);
    expect(restored.name).toBe(before.name);
    await expect(page).toHaveTitle(/Orbit Marketing OS/);
  });

  test("native queue recovery returns interrupted sync work to pending", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const suffix = Date.now();
    const account = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("account_upsert", {
          id,
          platform: "telegram",
          display_name: "E2E Recovery Account",
          username: "orbit-recovery",
          session: "recovery-session-fixture",
          password: "e2e-recovery-password",
        }),
      `e2e-recovery-account-${suffix}`,
    )) as {
      id: string;
      status: string;
      has_encrypted_session: boolean;
    };
    expect(account.status).toBe("connected");
    expect(account.has_encrypted_session).toBe(true);

    const campaign = (await page!.evaluate(
      async (accountId) =>
        window.__TAURI_INTERNALS__.invoke("campaign_create", {
          name: "E2E Recovery Campaign",
          account_ids: [accountId],
        }),
      account.id,
    )) as { id: string };

    const now = new Date().toISOString();
    const task = (await page!.evaluate(
      async ({ campaignId, accountId, timestamp, taskId }) =>
        window.__TAURI_INTERNALS__.invoke("task_enqueue", {
          id: taskId,
          campaign_id: campaignId,
          account_id: accountId,
          platform: "telegram",
          kind: "sync",
          priority: 1,
          available_at: timestamp,
          max_attempts: 3,
          idempotency_key: taskId,
        }),
      {
        campaignId: campaign.id,
        accountId: account.id,
        timestamp: now,
        taskId: `e2e-recovery-task-${suffix}`,
      },
    )) as { id: string; status: string };
    expect(task.status).toBe("pending");

    const claimed = (await page!.evaluate(
      async (timestamp) =>
        window.__TAURI_INTERNALS__.invoke("task_claim_next", {
          now: timestamp,
        }),
      now,
    )) as { id: string; status: string };
    expect(claimed.id).toBe(task.id);
    expect(claimed.status).toBe("running");

    // Kill the native process to simulate an interrupted runtime.
    await killApp();

    await launchAndConnectTauri();
    const ctx = browser.contexts()[0];
    page = ctx.pages()[0] ?? (await ctx.waitForEvent("page"));
    await page.waitForURL(/tauri\.localhost/, { timeout: 10_000 });

    const recovered = (await page!.evaluate(
      async (campaignId) =>
        window.__TAURI_INTERNALS__.invoke("task_list", {
          campaign_id: campaignId,
        }),
      campaign.id,
    )) as Array<{ id: string; status: string }>;

    const recoveredTask = recovered.find(
      (candidate) => candidate.id === task.id,
    );
    expect(recoveredTask).toEqual({ id: task.id, status: "pending" });
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
