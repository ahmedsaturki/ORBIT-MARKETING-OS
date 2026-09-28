import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const requiredFiles = [
  ".omp/AGENTS.md",
  ".omp/RULES.md",
  "WATCHDOG.md",
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

for (const [label, content, needles] of [
  [
    "native OMP context",
    nativeContext,
    ["@../AGENTS.md", "@../docs/OMP_OPERATOR_PROTOCOL.md"],
  ],
  [
    "sticky OMP rules",
    stickyRules,
    ["L3_PRODUCTION_PROVEN", "OWNER_ACTION"],
  ],
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
]) {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${label} is missing required marker: ${needle}`);
    }
  }
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
  const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) {
    throw new Error(`${relativePath} must define name and description frontmatter`);
  }
  names.push(name);
}

if (new Set(names).size !== names.length) {
  throw new Error(`OMP agent names must be unique: ${names.join(", ")}`);
}

console.log("omp_contract=PASS");
console.log(`omp_agents=${names.join(",")}`);
