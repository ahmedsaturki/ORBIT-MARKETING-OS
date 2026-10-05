import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Without this, vitest's default glob collects the compiled test copies in
    // dist/ alongside the sources, so a local run after `pnpm build` silently
    // executes every test twice (527 reported here against 357 in CI, which
    // builds after testing and so never sees dist/).
    include: ["{src,test}/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "test/**/*.ts"],
      reporter: ["text", "json"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
