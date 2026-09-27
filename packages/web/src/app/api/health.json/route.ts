import { NextResponse } from "next/server";

export const dynamic = "force-static";

const version = "0.2.0";
const declaredReleaseSha = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA?.trim();
const vercelGitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const releaseSha = declaredReleaseSha || vercelGitCommitSha || "unreleased";
const releaseShaSource = declaredReleaseSha
  ? "NEXT_PUBLIC_ORBIT_RELEASE_SHA"
  : vercelGitCommitSha
    ? "VERCEL_GIT_COMMIT_SHA"
    : "none";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      service: "ORBIT Marketing OS Web",
      version,
      releaseSha,
      provenance: releaseSha === "unreleased" ? "unproven" : "declared",
      provenanceSource: releaseShaSource,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
