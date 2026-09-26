import { NextResponse } from "next/server";

const version = "0.2.0";
const releaseSha = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA ?? "unreleased";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      application: "ORBIT Marketing OS",
      version,
      releaseSha,
      releaseProvenance: {
        declaredByEnvironment: releaseSha !== "unreleased",
        source: "NEXT_PUBLIC_ORBIT_RELEASE_SHA",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
