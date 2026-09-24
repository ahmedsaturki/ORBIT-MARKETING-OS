import { describe, expect, it } from "vitest";

describe("@orbit/shared-ui package contract", () => {
  it("documents React as a peer dependency for consumers", async () => {
    const packageUrl = new URL("../package.json", import.meta.url);
    const packageJson = (await import(packageUrl.href, { with: { type: "json" } })).default as {
      peerDependencies?: Record<string, string>;
      exports?: Record<string, string>;
    };

    expect(packageJson.peerDependencies?.react).toBe("^19.2.3");
    expect(packageJson.exports?.["."]).toBe("./dist/index.js");
  });
});
