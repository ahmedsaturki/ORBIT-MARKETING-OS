import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("scripts/soak.ts", "utf8");

for (const marker of [
  'import { createServer } from "node:net";',
  "const requestedPort = readNumericArg(\"--port\");",
  "async function findFreeLoopbackPort(): Promise<number>",
  "server?.signalCode !== null",
  "child.signalCode !== null",
  "serverExitCode,",
  "serverSignalCode,",
]) {
  assert.equal(source.includes(marker), true, `missing soak resilience marker: ${marker}`);
}

console.log("soak_runner_resilience_contract=PASS");
