import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const requiredFiles = [
  ".omp/AGENTS.md",
  ".omp/RULES.md",
  "WATCHDOG.md",
  "WATCHDOG.yml",
  "docs/OMP_OPERATOR_PROTOCOL.md",
  "scripts/agent-release-triage.mjs",
  ".omp/agents/forensics.md",
  ".omp/agents/implementer.md",
  ".omp/agents/verifier.md",
  ".omp/agents/release-auditor.md",
  ".omp/agents/reviewer.md",
];

for (const relativePath of requiredFiles) {
  await access(new URL(relativePath, root));
}

const read = async (relativePath) =>
  readFile(new URL(relativePath, root), "utf8");

const nativeContext = await read(".omp/AGENTS.md");
const stickyRules = await read(".omp/RULES.md");
const watchdog = await read("WATCHDOG.md");
const protocol = await read("docs/OMP_OPERATOR_PROTOCOL.md");
const watchdogRoster = await read("WATCHDOG.yml");

for (const [label, content, needles] of [
  [
    "native OMP context",
    nativeContext,
    ["@../AGENTS.md", "@../docs/OMP_OPERATOR_PROTOCOL.md"],
  ],
  ["sticky OMP rules", stickyRules, ["L3_PRODUCTION_PROVEN", "OWNER_ACTION"]],
  [
    "OMP watchdog",
    watchdog,
    ["Release-truth drift", "workspace/RBAC boundaries"],
  ],
  [
    "OMP protocol",
    protocol,
    ["SPEC → IMPLEMENT → TEST", "Do not simulate or fabricate these proofs."],
  ],
  [
    "WATCHDOG roster",
    watchdogRoster,
    ["advisors:", "ReleaseTruth", "SecurityRuntime"],
  ],
]) {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(label + " is missing required marker: " + needle);
    }
  }
}

function parseAgentFrontmatter(content, relativePath) {
  if (!content.startsWith("---\n")) {
    throw new Error(relativePath + " must start with YAML frontmatter");
  }

  const end = content.indexOf("\n---", 4);
  if (end < 0) {
    throw new Error(
      relativePath + " must have a closing frontmatter delimiter",
    );
  }

  const block = content.slice(4, end).split(/\r?\n/);
  const name = block
    .find((line) => /^name:\s*/.test(line))
    ?.replace(/^name:\s*/, "")
    .trim();
  const description = block
    .find((line) => /^description:\s*/.test(line))
    ?.replace(/^description:\s*/, "")
    .trim();

  if (!name || !description) {
    throw new Error(
      relativePath + " must define name and description inside frontmatter",
    );
  }

  return { name, description };
}

const agentPaths = [
  ".omp/agents/forensics.md",
  ".omp/agents/implementer.md",
  ".omp/agents/verifier.md",
  ".omp/agents/release-auditor.md",
  ".omp/agents/reviewer.md",
];

const names = [];
for (const relativePath of agentPaths) {
  const content = await read(relativePath);
  names.push(parseAgentFrontmatter(content, relativePath).name);
}

if (new Set(names).size !== names.length) {
  throw new Error("OMP agent names must be unique: " + names.join(", "));
}

console.log("omp_contract=PASS");
console.log("omp_agents=" + names.join(","));
