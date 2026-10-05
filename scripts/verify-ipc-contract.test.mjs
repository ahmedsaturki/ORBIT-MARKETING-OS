#!/usr/bin/env node
/**
 * Contract test for scripts/verify-ipc.mjs.
 *
 * That script gates five workflows (ci, release-desktop, release-evidence,
 * release-mobile, self-hosted-verify) and enforces two properties that are
 * security-relevant rather than cosmetic:
 *
 *   1. Every Tauri command registered in generate_handler! carries
 *      #[tauri::command], and every command the UI invokes is registered.
 *   2. Actor identity for approval_request / approval_decide is derived inside
 *      the runtime. The desktop UI must not be able to assert who is asking.
 *
 * It had no test, so a regression in either property would only have surfaced
 * by luck. ORBIT_IPC_ROOT points it at a fixture tree; unset, it reads the repo.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const VERIFIER = join(root, "scripts", "verify-ipc.mjs");

/** Write a fixture tree from { rust, ui } path->contents maps; return its path. */
async function fixture({ rust = {}, ui = {} }) {
  const base = await mkdtemp(join(tmpdir(), "orbit-ipc-"));
  for (const [dir, files] of [
    [join(base, "packages/desktop/src-tauri/src"), rust],
    [join(base, "packages/desktop/src"), ui],
  ]) {
    // Both roots must exist even when a spec supplies no files for one of them.
    // The verifier readdir()s both unconditionally, so a missing directory
    // surfaces as ENOENT rather than as the rule under test.
    await mkdir(dir, { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
      const full = join(dir, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body);
    }
  }
  return base;
}

/** Run the real verifier; resolve to { code, stdout, stderr }. */
function run(tree) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [VERIFIER], {
      env: { ...process.env, ORBIT_IPC_ROOT: tree ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}
// A minimal tree that passes: one command, registered, invoked, plus both
// approval entry points. Those two are mandatory — the verifier treats a
// missing approval_request the same as one that accepts requested_by, because
// either way actor identity is not derived in the runtime.
const PASSING = {
  rust: {
    "lib.rs": `
      #[tauri::command]
      fn do_thing(value: String) -> String { value }
      #[tauri::command]
      fn approval_request() -> String {
        let actor = current_actor();
        actor
      }
      #[tauri::command]
      fn approval_decide() -> String {
        let actor = current_actor();
        actor
      }
      fn main() {
        let _ = tauri::generate_handler![
          do_thing,
          approval_request,
          approval_decide
        ];
      }
    `,
  },
  ui: { "App.tsx": `const run = () => invoke("do_thing", { value: "x" });` },
};

// Both approval entry points must exist in every fixture, including the ones
// testing a different rule. A fixture missing them trips the mandatory check
// first and would "pass" its rejection for the wrong reason, proving nothing
// about the rule under test.
const REQUEST_OK = `
  #[tauri::command]
  fn approval_request() -> String {
    let actor = current_actor();
    actor
  }
`;
const DECIDE_OK = `
  #[tauri::command]
  fn approval_decide() -> String {
    let actor = current_actor();
    actor
  }
`;

const trees = [];
async function assertPasses(label, spec) {
  const tree = await fixture(spec);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(r.code, 0, `${label}: expected pass, got code ${r.code}`);
  console.log(`  ok - ${label}`);
}

async function assertRejects(label, spec, needle) {
  const tree = await fixture(spec);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(r.code, 1, `${label}: expected rejection, got code ${r.code}`);
  const combined = r.stdout + r.stderr;
  assert.match(
    combined,
    needle,
    `${label}: rejection message did not mention ${needle}`,
  );
  console.log(`  ok - ${label}`);
}

console.log("verify-ipc contract");

// The override must be inert when unset: this is the repo the guard protects.
{
  const r = await run(undefined);
  assert.equal(r.code, 0, `real repository tree failed: ${r.stderr}`);
  assert.match(r.stdout, /Desktop IPC contract checks passed/);
  console.log("  ok - the real repository tree still passes (override inert)");
}

await assertPasses("a consistent fixture passes", PASSING);

await assertRejects(
  "generate_handler! registering a function without #[tauri::command]",
  {
    rust: {
      "lib.rs": `
        #[tauri::command]
        fn do_thing() {}
        ${REQUEST_OK}
        ${DECIDE_OK}
        fn other() {}
        fn main() {
          let _ = tauri::generate_handler![
            do_thing,
            other,
            approval_request,
            approval_decide
          ];
        }
      `,
    },
    ui: {},
  },
  /registers a function without #\[tauri::command\]: other/,
);

await assertRejects(
  "the UI invoking a command that is not registered",
  {
    rust: {
      "lib.rs": `
        ${REQUEST_OK}
        ${DECIDE_OK}
        #[tauri::command]
        fn known() {}
        fn main() {
          let _ = tauri::generate_handler![
            known,
            approval_request,
            approval_decide
          ];
        }
      `,
    },
    ui: { "App.tsx": `const run = () => invoke("ghost_command");` },
  },
  /Desktop UI invokes missing Tauri command: ghost_command/,
);

await assertRejects(
  "approval_request accepting requested_by from the caller",
  {
    rust: {
      "lib.rs": `
        ${DECIDE_OK}
        #[tauri::command]
        fn approval_request(requested_by: String) -> String { requested_by }
        fn main() {
          let _ = tauri::generate_handler![approval_request, approval_decide];
        }
      `,
    },
    ui: {},
  },
  /approval_request must derive actor identity inside the runtime/,
);

await assertRejects(
  "approval_decide accepting decided_by from the caller",
  {
    rust: {
      "lib.rs": `
        ${REQUEST_OK}
        #[tauri::command]
        fn approval_decide(decided_by: String) -> String { decided_by }
        fn main() {
          let _ = tauri::generate_handler![approval_request, approval_decide];
        }
      `,
    },
    ui: {},
  },
  /approval_decide must derive actor identity inside the runtime/,
);

await assertRejects(
  "the desktop UI asserting requested_by itself",
  {
    rust: {
      "lib.rs": `
        ${REQUEST_OK}
        ${DECIDE_OK}
        fn main() {
          let _ = tauri::generate_handler![approval_request, approval_decide];
        }
      `,
    },
    ui: {
      "Approval.tsx": `
        const run = () =>
          invoke("approval_request", { requested_by: "local-user" });
      `,
    },
  },
  /Desktop UI must not supply requested_by for approval requests/,
);

await assertRejects(
  "the desktop UI asserting decided_by itself",
  {
    rust: {
      "lib.rs": `
        ${REQUEST_OK}
        ${DECIDE_OK}
        fn main() {
          let _ = tauri::generate_handler![approval_request, approval_decide];
        }
      `,
    },
    ui: {
      "Approval.tsx": `
        const run = () =>
          invoke("approval_decide", { decided_by: "local-user" });
      `,
    },
  },
  /Desktop UI must not supply decided_by for approval decisions/,
);

for (const tree of trees) await rm(tree, { recursive: true, force: true });

console.log("verify-ipc-contract=PASS");
