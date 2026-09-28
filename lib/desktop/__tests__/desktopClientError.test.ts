import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient, legacyApiError, v1ApiError } from "../../../desktop/src/lib/desktopClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("legacyApiError", () => {
  it("surfaces field-level validation issues", () => {
    expect(legacyApiError({
      error: "invalid_payload",
      issues: [
        { field: "repositoryUrls", message: "At least one repository is required." },
        { field: "windowStartUtc", message: "Deployment window is invalid." },
      ],
    }, 400)).toBe(
      "repositoryUrls: At least one repository is required. · windowStartUtc: Deployment window is invalid.",
    );
  });

  it("supports string and legacy object errors", () => {
    expect(legacyApiError({ error: "desktop_session_required" }, 401))
      .toBe("desktop_session_required");
    expect(legacyApiError({ error: { userMessage: "Reconnect the workspace." } }, 401))
      .toBe("Reconnect the workspace.");
  });

  it("falls back honestly to the response status", () => {
    expect(legacyApiError({}, 503)).toBe("HTTP 503");
  });

  it("sends a stable request idempotency identity to the service", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      data: {
        id: "request-01",
        title: "Release",
        status: "submitted",
        version: 1,
        correlationId: "retry-identity-01",
        submittedAt: "2026-09-26T10:00:00.000Z",
        replayed: false,
      },
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new DesktopClient({
      apiBase: "https://service.example.test",
      sessionToken: "desktop-token",
    });

    const result = await client.createDeploymentRequest(
      { title: "Release" },
      "retry-identity-01",
    );

    expect(result).toMatchObject({ ok: true, data: { replayed: false } });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer desktop-token",
      "Content-Type": "application/json",
      "x-correlation-id": "retry-identity-01",
    }));
  });
});

describe("v1ApiError", () => {
  it("turns permission codes into customer recovery guidance", () => {
    expect(v1ApiError({ error: "missing_scope", requiredScope: "pipeline:read" }, 403))
      .toContain("pipeline:read permission");
  });

  it("does not expose token implementation codes as the primary message", () => {
    expect(v1ApiError({ error: "token_revoked" }, 401))
      .toBe("Your workspace sign-in is no longer valid. Sign in again to continue.");
  });
});
