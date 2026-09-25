import { readFile } from "node:fs/promises";

const manifestPath = process.argv[2] ?? "vercel-dry-run.json";
const raw = await readFile(manifestPath, "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch {
  throw new Error("Vercel dry-run output is not valid JSON");
}

const frameworkCandidates = [
  data.framework,
  data.detectedFramework,
  data.frameworkPreset,
  data.project?.framework,
  data.projectSettings?.framework,
]
  .filter((value) => value !== undefined)
  .map((value) => String(value).trim().toLowerCase());

if (frameworkCandidates.length === 0) {
  throw new Error("Vercel dry-run did not expose a framework field");
}

if (frameworkCandidates.some((value) => value.includes("vite"))) {
  throw new Error(
    "Vercel dry-run detected Vite; ORBIT requires the Next.js/Other static-export contract",
  );
}

if (
  !frameworkCandidates.some(
    (value) =>
      value.includes("nextjs") ||
      value.includes("next.js") ||
      value === "other" ||
      value === "null",
  )
) {
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
