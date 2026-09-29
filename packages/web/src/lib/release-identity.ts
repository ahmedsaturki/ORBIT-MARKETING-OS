export const RELEASE_VERSION = "1.0.0";

export type ReleaseShaSource =
  "NEXT_PUBLIC_ORBIT_RELEASE_SHA" | "VERCEL_GIT_COMMIT_SHA" | "none";

export type ReleaseIdentity = {
  version: string;
  releaseSha: string;
  source: ReleaseShaSource;
};

/**
 * Single source of truth for release identity across every public route.
 * Resolution order: declared release SHA -> Vercel commit SHA -> "unreleased".
 */
export function resolveReleaseIdentity(): ReleaseIdentity {
  const declaredReleaseSha = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA?.trim();
  const vercelGitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const releaseSha = declaredReleaseSha || vercelGitCommitSha || "unreleased";
  const source: ReleaseShaSource = declaredReleaseSha
    ? "NEXT_PUBLIC_ORBIT_RELEASE_SHA"
    : vercelGitCommitSha
      ? "VERCEL_GIT_COMMIT_SHA"
      : "none";
  return { version: RELEASE_VERSION, releaseSha, source };
}
