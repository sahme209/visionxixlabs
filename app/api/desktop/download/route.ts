/**
 * Resolves a platform request against the same live release manifest used by
 * the download page. Missing or unreachable assets never become guessed URLs.
 */

import { NextRequest, NextResponse } from "next/server";
import {
    getDesktopReleaseManifest,
    type DesktopPlatform,
} from "@/lib/desktop/releaseManifest";
import { readDesktopRuntimeReadiness } from "@/lib/desktop/desktopRuntimeReadiness";

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux";

const PLATFORM_MAP: Record<Platform, DesktopPlatform> = {
    "mac-arm": "macos-arm",
    "mac-intel": "macos-intel",
    windows: "windows-x64",
    linux: "linux-x64",
};

const VALID_PLATFORMS = Object.keys(PLATFORM_MAP) as Platform[];

function isValidPlatform(platform: string | null): platform is Platform {
    return platform !== null && VALID_PLATFORMS.includes(platform as Platform);
}

function wantsJson(request: NextRequest): boolean {
    if (request.nextUrl.searchParams.get("format") === "json") return true;
    const accept = request.headers.get("accept") ?? "";
    return accept.includes("application/json") && !accept.includes("text/html");
}

function redirectWithinSite(location: string) {
    // Preserve the browser's origin even when the server reconstructs a different host.
    return new NextResponse(null, { status: 302, headers: { Location: location } });
}

export async function GET(request: NextRequest) {
    const platform = request.nextUrl.searchParams.get("platform");
    const json = wantsJson(request);

    if (!isValidPlatform(platform)) {
        if (json) {
            return NextResponse.json(
                { error: "Invalid platform", validPlatforms: VALID_PLATFORMS },
                { status: 400 },
            );
        }
        return redirectWithinSite("/download");
    }

    const [manifest, runtime] = await Promise.all([
        getDesktopReleaseManifest(),
        readDesktopRuntimeReadiness(),
    ]);
    if (!runtime.ready) {
        if (json) {
            return NextResponse.json(
                {
                    status: "temporarily_unavailable",
                    platform,
                    message: runtime.message,
                    releaseUrl: manifest.htmlUrl,
                },
                { status: 503 },
            );
        }
        return redirectWithinSite(`/download/preview?platform=${platform}&reason=runtime`);
    }
    const asset = manifest.assets[PLATFORM_MAP[platform]];

    if (asset) {
        if (json) {
            return NextResponse.json({
                status: "available",
                platform,
                version: manifest.tag,
                asset,
                releaseUrl: manifest.htmlUrl,
            });
        }
        return NextResponse.redirect(asset.downloadUrl, 302);
    }

    if (json) {
        return NextResponse.json(
            {
                status: "unavailable",
                platform,
                message: manifest.note ?? "No verified installable asset is published for this platform.",
                releaseUrl: manifest.htmlUrl,
            },
            { status: 404 },
        );
    }

    return redirectWithinSite(`/download/preview?platform=${platform}`);
}
