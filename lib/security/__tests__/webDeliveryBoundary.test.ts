import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";

function request(path: string, init?: RequestInit) {
    return new NextRequest(new URL(path, "https://visionxixlabs.com"), init);
}

describe("website delivery boundary", () => {
    it.each(["/dashboard", "/dashboard/releases", "/operator", "/operator/onboarding"])(
        "redirects browser product route %s to the download page",
        (path) => {
            const response = middleware(request(path));

            expect(response.status).toBe(307);
            const location = new URL(response.headers.get("location") ?? "");
            expect(location.pathname).toBe("/download");
            expect(location.searchParams.get("from")).toBe(path);
        },
    );

    it.each(["/auth/signin", "/auth/signup"])(
        "does not expose direct public auth page %s",
        (path) => {
            const response = middleware(request(path));

            expect(response.status).toBe(307);
            expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/download");
        },
    );

    it("allows desktop pairing authentication", () => {
        const callbackUrl = encodeURIComponent("/desktop/connect?challenge=pair-123");
        const response = middleware(request(`/auth/signin?callbackUrl=${callbackUrl}`));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("allows approved invitation and admin authentication callbacks", () => {
        const invite = middleware(request("/auth/signin?callbackUrl=%2Faccept-invite%2Finvite-123"));
        const admin = middleware(request("/auth/signin?callbackUrl=%2Fadmin%2Fleads"));

        expect(invite.status).toBe(200);
        expect(admin.status).toBe(200);
    });

    it("preserves desktop API CORS without exposing browser pages", () => {
        const response = middleware(
            request("/api/desktop/session", {
                headers: { origin: "tauri://localhost" },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe("tauri://localhost");
    });
});
