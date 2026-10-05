/**
 * DOC-01: the user guide must describe the product that actually ships.
 *
 * The guide is prose, so it cannot be proven correct by reading it. What it
 * *can* do is name concrete, falsifiable claims: the environment variables
 * the runtime reads, and the guarantee that remote AI endpoints are
 * rejected. Those are asserted here against the source of truth, so a guide
 * that drifts from the code fails CI instead of misleading an operator.
 */
import { readFileSync } from "node:fs";

const guide = readFileSync("docs/USER_GUIDE.md", "utf8");
const server = readFileSync("server.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

// Every variable the guide tells an operator to set must be one the runtime
// actually reads. A guide variable the runtime ignores sends the operator
// through setup that has no effect.
const documentedVars = [...guide.matchAll(/^(OLLAMA_[A-Z_]+)=/gm)].map(
  (match) => match[1],
);

if (documentedVars.length === 0) {
  throw new Error("USER_GUIDE.md no longer documents any Ollama variables");
}

for (const name of documentedVars) {
  if (!new RegExp(`\\b${name}\\b`).test(server)) {
    throw new Error(
      `USER_GUIDE.md documents ${name} but server.ts never reads it`,
    );
  }
  if (!new RegExp(`^${name}=`, "m").test(envExample)) {
    throw new Error(
      `USER_GUIDE.md documents ${name} but .env.example does not offer it`,
    );
  }
}

// The guide states the runtime accepts Ollama only over loopback HTTP. That is
// a safety claim, so it is checked against the enforcement site itself rather
// than merely for the presence of the words.
if (!/OLLAMA_BASE_URL must use loopback HTTP only/.test(server)) {
  throw new Error(
    "USER_GUIDE.md promises remote Ollama endpoints are rejected, but " +
      "server.ts no longer enforces it",
  );
}
const baseUrlGuard = server.indexOf("loopback HTTP only");
const protocolGuard = server.indexOf('url.protocol !== "http:"');
if (baseUrlGuard < 0 || protocolGuard < 0 || protocolGuard > baseUrlGuard) {
  throw new Error(
    "Ollama base URL must reject both non-HTTP and non-loopback hosts",
  );
}

// The guide must not instruct an operator to point the runtime at a hosted
// model endpoint, which would contradict the guarantee above.
if (/OLLAMA_BASE_URL=https?:\/\/(?!127\.0\.0\.1|localhost)/.test(guide)) {
  throw new Error(
    "USER_GUIDE.md shows a non-loopback OLLAMA_BASE_URL, contradicting its own " +
      "loopback guarantee",
  );
}

console.log(
  `user_guide_contract=PASS documented_vars=${documentedVars.length}`,
);
