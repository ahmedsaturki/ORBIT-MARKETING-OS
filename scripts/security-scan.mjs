import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const secretFilePatterns = [
  /^\.env(?:\.|$)/u,
  /(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\..*)?$/iu,
  /(^|\/).*\.(?:pem|key|p12|pfx)$/iu,
];

const allowedEnvFiles = new Set([".env.example", ".env.sample"]);

const secretPatterns = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /(?:ghp|gho|ghs|ghr)_[A-Za-z0-9]{20,}/u,
  /github_pat_[A-Za-z0-9_]{20,}/u,
  /AKIA[0-9A-Z]{16}/u,
  /(?:xox[baprs])-[A-Za-z0-9-]{20,}/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /AIza[0-9A-Za-z_-]{30,}/u,
];

const extensionAllowlist = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".sh",
  ".ps1",
  ".rs",
  ".css",
  ".html",
  ".svg",
]);

const failures = [];

for (const path of tracked) {
  const envLike = path.startsWith(".env");
  if (envLike && !allowedEnvFiles.has(path)) {
    failures.push(
      path + ": tracked environment file is not an approved example",
    );
    continue;
  }

  if (
    secretFilePatterns.some(
      (pattern) => pattern.test(path) && !allowedEnvFiles.has(path),
    )
  ) {
    failures.push(path + ": tracked private-key/secret file pattern");
    continue;
  }

  const dot = path.lastIndexOf(".");
  if (dot < 0 || !extensionAllowlist.has(path.slice(dot).toLowerCase()))
    continue;

  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    continue;
  }

  if (secretPatterns.some((pattern) => pattern.test(content))) {
    failures.push(path + ": possible embedded credential/token pattern");
  }
}

if (failures.length) {
  console.error("ORBIT secret scan failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "passed",
    trackedFiles: tracked.length,
    checkedTextFiles: tracked.filter((path) => {
      const dot = path.lastIndexOf(".");
      return dot >= 0 && extensionAllowlist.has(path.slice(dot).toLowerCase());
    }).length,
  }),
);
