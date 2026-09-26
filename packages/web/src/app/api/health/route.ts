import { NextResponse } from "next/server";

const version = "0.2.0";
const releaseSha = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA ?? "unreleased";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      service: "ORBIT Marketing OS Web",
      version,
      releaseSha,
      provenance: releaseSha === "unreleased" ? "unproven" : "declared",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
