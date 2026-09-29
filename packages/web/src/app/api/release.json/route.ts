import { NextResponse } from "next/server";
import { resolveReleaseIdentity } from "../../../lib/release-identity";

export const dynamic = "force-static";

const { version, releaseSha, source } = resolveReleaseIdentity();

export function GET(): NextResponse {
  return NextResponse.json(
    {
      application: "ORBIT Marketing OS",
      version,
      releaseSha,
      releaseProvenance: {
        declaredByEnvironment: releaseSha !== "unreleased",
        source,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
