import { NextResponse } from "next/server";
import { resolveReleaseIdentity } from "../../../lib/release-identity";

export const dynamic = "force-static";

const { version, releaseSha, source } = resolveReleaseIdentity();

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      service: "ORBIT Marketing OS Web",
      version,
      releaseSha,
      provenance: releaseSha === "unreleased" ? "unproven" : "declared",
      provenanceSource: source,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
