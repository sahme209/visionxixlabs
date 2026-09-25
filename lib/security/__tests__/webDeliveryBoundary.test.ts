import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../../proxy";

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    return new NextRequest(new URL(path, "https://visionxixlabs.com"), init);
}

describe("website delivery boundary", () => {
    it.each(["/dashboard", "/dashboard/releases", "/operator", "/operator/onboarding"])(
        "redirects browser product route %s to the download page",
        (path) => {
            const response = proxy(request(path));

            expect(response.status).toBe(307);
            const location = new URL(response.headers.get("location") ?? "");
            expect(location.pathname).toBe("/download");
            expect(location.searchParams.get("from")).toBe(path);
        },
    );

    it.each(["/auth/signin", "/auth/signup"])(
        "does not expose direct public auth page %s",
        (path) => {
            const response = proxy(request(path));

            expect(response.status).toBe(307);
            expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/download");
        },
    );

    it("allows desktop pairing authentication", () => {
        const callbackUrl = encodeURIComponent("/desktop/connect?challenge=pair-123");
        const response = proxy(request(`/auth/signin?callbackUrl=${callbackUrl}`));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("allows approved invitation and admin authentication callbacks", () => {
        const invite = proxy(request("/auth/signin?callbackUrl=%2Faccept-invite%2Finvite-123"));
        const admin = proxy(request("/auth/signin?callbackUrl=%2Fadmin%2Fleads"));

        expect(invite.status).toBe(200);
        expect(admin.status).toBe(200);
    });

    it("preserves desktop API CORS without exposing browser pages", () => {
        const response = proxy(
            request("/api/desktop/session", {
                headers: { origin: "tauri://localhost" },
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe("tauri://localhost");
    });

    it("answers trusted desktop preflight requests with the scoped CORS contract", () => {
        const response = proxy(
            request("/api/desktop/session", {
                method: "OPTIONS",
                headers: { origin: "https://tauri.localhost" },
            }),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe("https://tauri.localhost");
        expect(response.headers.get("access-control-allow-methods")).toContain("POST");
        expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
        expect(response.headers.get("access-control-max-age")).toBe("86400");
        expect(response.headers.get("vary")).toBe("Origin");
    });

    it("does not grant CORS to untrusted origins", () => {
        const response = proxy(
            request("/api/desktop/session", {
                method: "OPTIONS",
                headers: { origin: "https://attacker.example" },
            }),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
        expect(response.headers.get("access-control-allow-methods")).toBeNull();
    });

    it("applies security headers to normal, redirect, and preflight responses", () => {
        const responses = [
            proxy(request("/")),
            proxy(request("/dashboard")),
            proxy(request("/api/desktop/session", { method: "OPTIONS" })),
        ];

        for (const response of responses) {
            expect(response.headers.get("strict-transport-security")).toContain("includeSubDomains");
            expect(response.headers.get("x-frame-options")).toBe("DENY");
            expect(response.headers.get("x-content-type-options")).toBe("nosniff");
            expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
        }
    });
});
