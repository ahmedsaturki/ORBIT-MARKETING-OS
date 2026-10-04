import { runTsx } from "./run-tsx.mjs";

const env = { ...process.env };
delete env.ORBIT_TELEGRAM_TEST_TOKEN;
delete env.ORBIT_TELEGRAM_TEST_CHAT_ID;
delete env.ORBIT_LINKEDIN_TEST_TOKEN;
delete env.ORBIT_LINKEDIN_TEST_AUTHOR_URN;

// spawnSync reports a non-zero exit through `status` rather than throwing.
const result = runTsx(
  ["scripts/commercial-connector-proof.ts", "--confirm-live"],
  { env },
);

if (result.error) {
  throw new Error(`proof failed to launch: ${result.error.message}`);
}
if (result.status !== 2) {
  throw new Error(
    `expected missing-input fail-closed exit 2, got ${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`,
  );
}

const output = `${result.stdout}\n${result.stderr}`;
for (const required of [
  "commercial-connector-proof=BLOCKED",
  "ORBIT_TELEGRAM_TEST_TOKEN",
  "ORBIT_TELEGRAM_TEST_CHAT_ID",
  "ORBIT_LINKEDIN_TEST_TOKEN",
  "ORBIT_LINKEDIN_TEST_AUTHOR_URN",
]) {
  if (!output.includes(required)) {
    throw new Error(`missing expected fail-closed marker: ${required}`);
  }
}

for (const argv of [
  ["--confirm-live", "--output"],
  ["--confirm-live", "--output", "--confirm-live"],
]) {
  const invalidOutput = runTsx(
    ["scripts/commercial-connector-proof.ts", ...argv],
    { env: process.env },
  );
  if (invalidOutput.status !== 2) {
    throw new Error(
      `expected invalid output operand to fail closed with exit 2, got ${invalidOutput.status} for ${argv.join(" ")}`,
    );
  }
  const invalidOutputText = `${invalidOutput.stdout}\n${invalidOutput.stderr}`;
  if (!invalidOutputText.includes("--output requires a non-flag filename.")) {
    throw new Error(
      `missing invalid-output fail-closed marker for ${argv.join(" ")}`,
    );
  }
}

console.log("commercial_connector_proof_safe_test=PASS");
