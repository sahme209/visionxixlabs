import { describe, expect, it } from "vitest";
import { decideSelfServiceMint, MAX_ACTIVE_KEYS } from "../selfServiceApiKeyPolicy";

const now = new Date("2026-11-09T00:00:00Z");
const base = { name: "cursor-ci", scopes: ["governance:read", "governance:request"], activeKeys: 0 };

describe("self-service API key policy", () => {
  it("mints governance keys that expire in 30 days by default", () => {
    const d = decideSelfServiceMint(base, now);
    expect(d).toMatchObject({ ok: true, name: "cursor-ci", env: "live" });
    if (d.ok) expect(d.expiresAt.toISOString()).toBe("2026-12-09T00:00:00.000Z");
  });
  it("never grants wildcards, trigger or admin scopes", () => {
    for (const bad of ["*", "pipeline:trigger", "webhook:admin", "governance:*", "eval:write", "nope"]) expect(decideSelfServiceMint({ ...base, scopes: ["governance:read", bad] }, now)).toEqual({ ok: false, error: "scope_not_allowed" });
  });
  it("requires an expiry between 1 and 90 days", () => {
    for (const bad of [0, 91, 1.5, "30", -1]) expect(decideSelfServiceMint({ ...base, expiresInDays: bad }, now)).toEqual({ ok: false, error: "expiry_invalid" });
    expect(decideSelfServiceMint({ ...base, expiresInDays: 90 }, now).ok).toBe(true);
  });
  it("caps active keys and validates the name and scopes", () => {
    expect(decideSelfServiceMint({ ...base, activeKeys: MAX_ACTIVE_KEYS }, now)).toEqual({ ok: false, error: "too_many_keys" });
    expect(decideSelfServiceMint({ ...base, name: "  " }, now)).toEqual({ ok: false, error: "name_required" });
    expect(decideSelfServiceMint({ ...base, scopes: [] }, now)).toEqual({ ok: false, error: "scopes_required" });
  });
});
