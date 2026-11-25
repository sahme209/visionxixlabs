import { NextResponse } from "next/server";

export function websitePreviewUnavailable() {
  return NextResponse.json({
    error: "Website preview deployment requires a qualified platform governance request.",
    code: "website_preview_requires_governance",
  }, { status: 503 });
}
