import { afterEach, describe, expect, it } from "vitest";

import { RELEASE_VERSION, resolveReleaseIdentity } from "./release-identity";

const DECLARED_SHA = "1111111111111111111111111111111111111111";
const VERCEL_SHA = "2222222222222222222222222222222222222222";

function setEnv(declared?: string, vercel?: string): void {
  if (declared === undefined) {
    delete process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA;
  } else {
    process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA = declared;
  }
  if (vercel === undefined) {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  } else {
    process.env.VERCEL_GIT_COMMIT_SHA = vercel;
  }
}

describe("resolveReleaseIdentity", () => {
  const originalDeclared = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA;
  const originalVercel = process.env.VERCEL_GIT_COMMIT_SHA;

  afterEach(() => {
    setEnv(originalDeclared, originalVercel);
  });

  it("falls back to the Vercel commit SHA when no release SHA is declared", () => {
    setEnv(undefined, VERCEL_SHA);

    expect(resolveReleaseIdentity()).toEqual({
      version: RELEASE_VERSION,
      releaseSha: VERCEL_SHA,
      source: "VERCEL_GIT_COMMIT_SHA",
    });
  });

  it("prefers the declared release SHA over the Vercel commit SHA", () => {
    setEnv(DECLARED_SHA, VERCEL_SHA);

    expect(resolveReleaseIdentity()).toEqual({
      version: RELEASE_VERSION,
      releaseSha: DECLARED_SHA,
      source: "NEXT_PUBLIC_ORBIT_RELEASE_SHA",
    });
  });

  it("treats a blank declared SHA as undeclared and uses the Vercel commit SHA", () => {
    setEnv("   ", VERCEL_SHA);

    expect(resolveReleaseIdentity()).toEqual({
      version: RELEASE_VERSION,
      releaseSha: VERCEL_SHA,
      source: "VERCEL_GIT_COMMIT_SHA",
    });
  });

  it("reports the unreleased sentinel when neither environment declares a SHA", () => {
    setEnv(undefined, undefined);

    expect(resolveReleaseIdentity()).toEqual({
      version: RELEASE_VERSION,
      releaseSha: "unreleased",
      source: "none",
    });
  });

  it("trims surrounding whitespace from the resolved SHA", () => {
    setEnv(`  ${DECLARED_SHA}  `, undefined);

    expect(resolveReleaseIdentity().releaseSha).toBe(DECLARED_SHA);
  });
});
