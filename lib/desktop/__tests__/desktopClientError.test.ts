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

  it("turns deployment-policy denials into actionable guidance", () => {
    expect(v1ApiError({ error: "branch_policy_change_ticket_required" }, 409))
      .toBe("Add a CHG, INC, or REQ ticket reference to the linked pull request before deployment.");
  });
});


const identity = { kind: "desktop_session", organizationId: "org-1", role: "operator", capabilities: ["pipeline:read"] };
const access = { allowed: true, code: "active", title: "Access active", message: "Workspace connected", planTier: "pilot", billingStatus: "active", accessRequestPath: "/contact", pricingPath: "/plans" };
const client = () => new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "axm.desk.fixture" });
function respond(data: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data }), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("desktop startup identity response boundary", () => {
  it("rejects a non-success HTTP response even when its body claims success", async () => {
    respond({ identity, access }, 503);
    expect(await client().verifyCurrentCredential()).toEqual({ ok: false, error: "HTTP 503" });
  });

  it.each([
    {}, { identity: null, access }, { identity, access: null },
    { identity: { ...identity, organizationId: "" }, access },
    { identity: { ...identity, kind: "browser" }, access },
    { identity: { ...identity, role: "superuser" }, access },
    { identity: { ...identity, capabilities: "pipeline:read" }, access },
    { identity: { ...identity, capabilities: [3] }, access },
    { identity, access: { ...access, allowed: "false" } },
    { identity, access: { ...access, code: "unknown" } },
    { identity, access: { ...access, title: null } },
    { identity: { ...identity, organizationId: "  " }, access },
    { identity: { ...identity, kind: ["desktop_session"] }, access },
    { identity: { ...identity, role: ["operator"] }, access },
    { identity: { ...identity, email: 5 }, access },
    { identity, access: { ...access, code: ["active"] } },
    { identity, access: { ...access, allowed: 1 } },
    { identity, access: { ...access, cancelAtPeriodEnd: "false" } },
  ])("returns an actionable failure for malformed identity/access %#", async (data) => {
    respond(data);
    await expect(client().verifyCurrentCredential()).resolves.toEqual({ ok: false, error: "The service returned an invalid workspace identity. Sign in again or contact support." });
  });

  it("preserves a verified identity with denied access as a separate state", async () => {
    respond({ identity, access: { ...access, allowed: false, code: "production_access_required" } });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: true, data: { organizationId: "org-1", capabilities: ["pipeline:read"], access: { allowed: false } } });
  });

  it("preserves compatibility for absent optional capabilities", async () => {
    respond({ identity: { kind: "desktop_session", organizationId: "org-1" }, access });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: true, data: { capabilities: [], access: { allowed: true } } });
  });

  it("does not accept a different credential kind from the service", async () => {
    respond({ identity: { ...identity, kind: "api_key" }, access });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: false });
  });

  it("accepts the verified API-key identity only for an API-key credential", async () => {
    respond({ identity: { ...identity, kind: "api_key" }, access });
    const apiKeyClient = new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "vxlk_fixture" });
    expect(await apiKeyClient.verifyCurrentCredential()).toMatchObject({ ok: true, data: { kind: "api_key" } });
  });
});
