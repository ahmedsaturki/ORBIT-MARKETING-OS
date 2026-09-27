import { readFile } from "node:fs/promises";

const manifestPath = process.argv[2] ?? "vercel-dry-run.json";
const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8"));
if (
  ![null, "nextjs"].includes(vercelConfig.framework) ||
  vercelConfig.buildCommand !== "pnpm --dir packages/web build" ||
  vercelConfig.outputDirectory !== "packages/web/out"
) {
  throw new Error(
    "vercel.json does not match the canonical static-export deployment contract",
  );
}
const raw = await readFile(manifestPath, "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch {
  throw new Error("Vercel dry-run output is not valid JSON");
}

const normalizeFramework = (value) => {
  if (value === null) return "other";
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === "null") return "other";
  return normalized;
};

const frameworkCandidates = [
  data.framework,
  data.detectedFramework,
  data.frameworkPreset,
  data.project?.framework,
  data.projectSettings?.framework,
]
  .filter((value) => value !== undefined)
  .map(normalizeFramework);

if (frameworkCandidates.length === 0) {
  if (vercelConfig.framework === null) {
    frameworkCandidates.push("other");
  } else {
    throw new Error("Vercel dry-run did not expose a framework field");
  }
}

if (frameworkCandidates.some((value) => value.includes("vite"))) {
  throw new Error(
    "Vercel dry-run detected Vite; ORBIT requires a static-export-compatible framework",
  );
}

const allowedStaticFramework = frameworkCandidates.some((value) =>
  ["nextjs", "next.js", "other", "static"].includes(value),
);
if (!allowedStaticFramework) {
  throw new Error(
    "Vercel dry-run framework is incompatible with the ORBIT static-export contract: " +
      frameworkCandidates.join(", "),
  );
}

const serialized = JSON.stringify(data);
if (!/packages\/web/i.test(serialized)) {
  throw new Error(
    "Vercel dry-run manifest does not include the canonical packages/web deployment surface",
  );
}

console.log(
  "Vercel dry-run contract passed:",
  JSON.stringify({
    framework: frameworkCandidates,
    includesWebSurface: true,
  }),
);
