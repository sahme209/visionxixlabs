/**
 * GET /api/desktop/download?platform={mac-arm|mac-intel|windows|linux}
 *
 * Resolves to one of three outcomes:
 *
 *   1. Real signed binary configured for the platform — 302 to the release URL.
 *   2. Preview-state platform — 302 to /download/preview?platform=X so the
 *      browser sees a styled page (not raw JSON).
 *   3. Programmatic caller (Accept: application/json or ?format=json) — JSON
 *      response so SDKs and curl probes still get a structured answer.
 */

import { NextRequest, NextResponse } from "next/server";

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux";

const PLATFORM_AVAILABILITY: Record<Platform, { available: boolean; releaseUrl?: string }> = {
  "mac-arm": {
    available: false, // Flip to true once AXIOM_DESKTOP_RELEASE_MAC_ARM is set.
    releaseUrl: process.env.AXIOM_DESKTOP_RELEASE_MAC_ARM,
  },
  "mac-intel": {
    available: false,
    releaseUrl: process.env.AXIOM_DESKTOP_RELEASE_MAC_INTEL,
  },
  windows: { available: false },
  linux: { available: false },
};

const VALID_PLATFORMS: Platform[] = ["mac-arm", "mac-intel", "windows", "linux"];

function isValidPlatform(p: string | null): p is Platform {
  return p !== null && (VALID_PLATFORMS as string[]).includes(p);
}

function wantsJson(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get("format") === "json") return true;
  const accept = req.headers.get("accept") ?? "";
  // JSON-first clients explicitly ask for it. Browser default is text/html.
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const json = wantsJson(req);

  if (!isValidPlatform(platform)) {
    if (json) {
      return NextResponse.json(
        { error: "Invalid platform", validPlatforms: VALID_PLATFORMS },
        { status: 400 }
      );
    }
    return NextResponse.redirect(new URL("/download", req.url), 302);
  }

  const config = PLATFORM_AVAILABILITY[platform];

  // Real binary available — redirect to the release URL.
  if (config.available && config.releaseUrl) {
    return NextResponse.redirect(config.releaseUrl, 302);
  }

  // Preview / planned — JSON for programmatic clients, HTML preview page for browsers.
  if (json) {
    return NextResponse.json(
      {
        status: "preview",
        platform,
        message:
          platform === "mac-arm" || platform === "mac-intel"
            ? "macOS preview build available via early-access program."
            : platform === "windows"
              ? "Windows build ships Q2 2026 — join the early-access waitlist."
              : "Linux build ships Q3 2026 — join the early-access waitlist.",
        previewUrl: `/download/preview?platform=${platform}`,
      },
      { status: 202 }
    );
  }

  return NextResponse.redirect(
    new URL(`/download/preview?platform=${platform}`, req.url),
    302
  );
}
