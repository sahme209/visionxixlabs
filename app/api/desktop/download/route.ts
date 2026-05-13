/**
 * GET /api/desktop/download?platform={mac-arm|mac-intel|windows|linux}
 * Issues a redirect to the latest desktop build for the requested platform.
 * During preview, returns a 302 to a hosted release artifact when available
 * or to the desktop interest-capture page when not yet shipping.
 */

import { NextRequest, NextResponse } from "next/server";

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux";

const PLATFORM_AVAILABILITY: Record<Platform, { available: boolean; releaseUrl?: string }> = {
  "mac-arm": {
    available: true,
    releaseUrl: process.env.AXIOM_DESKTOP_RELEASE_MAC_ARM,
  },
  "mac-intel": {
    available: true,
    releaseUrl: process.env.AXIOM_DESKTOP_RELEASE_MAC_INTEL,
  },
  windows: { available: false },
  linux: { available: false },
};

const VALID_PLATFORMS: Platform[] = ["mac-arm", "mac-intel", "windows", "linux"];

function isValidPlatform(p: string | null): p is Platform {
  return p !== null && (VALID_PLATFORMS as string[]).includes(p);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");

  if (!isValidPlatform(platform)) {
    return NextResponse.json(
      {
        error: "Invalid platform",
        validPlatforms: VALID_PLATFORMS,
      },
      { status: 400 }
    );
  }

  const config = PLATFORM_AVAILABILITY[platform];

  if (!config.available) {
    return NextResponse.json(
      {
        status: "preview",
        platform,
        message: `${platform} build is in active development. Notify path: /download`,
        eta: platform === "windows" ? "Q2 2026" : platform === "linux" ? "Q3 2026" : "available",
      },
      { status: 202 }
    );
  }

  if (config.releaseUrl) {
    return NextResponse.redirect(config.releaseUrl, 302);
  }

  return NextResponse.json(
    {
      status: "preview",
      platform,
      message:
        "macOS preview build available via early-access program. Visit /download to request access.",
      redirect: "/download",
    },
    { status: 202 }
  );
}
