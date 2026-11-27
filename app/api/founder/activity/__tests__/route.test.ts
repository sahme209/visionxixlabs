// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ founder: vi.fn(), activity: vi.fn(), signals: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/founder/founderAccess", () => ({ founderContext: m.founder }));
vi.mock("@/lib/founder/founderActivity", () => ({ readFounderActivity: m.activity }));
vi.mock("@/lib/founder/founderSignals", () => ({ readFounderSignals: m.signals }));
import { GET } from "../route";
const get = (q = "") => GET(new NextRequest(`http://localhost/api/founder/activity${q}`));
beforeEach(() => { vi.clearAllMocks(); m.founder.mockResolvedValue({ email: "f@x.test" }); m.activity.mockResolvedValue({ events: [], unavailable: [], readAt: "2026-11-27T12:00:00.000Z" }); m.signals.mockResolvedValue({ incidents_open: 1 }); });

describe("/api/founder/activity", () => {
  it("is invisible to anyone who is not the founder", async () => {
    m.founder.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    expect(m.activity).not.toHaveBeenCalled();
  });
  it("returns activity with live signals and passes a valid since", async () => {
    const body = await (await get("?since=2026-11-27T11:00:00Z")).json();
    expect(body.data).toMatchObject({ events: [], signals: { incidents_open: 1 } });
    expect(m.activity.mock.calls[0][0]).toEqual(new Date("2026-11-27T11:00:00Z"));
    await get("?since=not-a-date");
    expect(m.activity.mock.calls[1][0]).toBeUndefined();
  });
  it("answers 503 when records cannot be read", async () => {
    m.activity.mockRejectedValue(new Error("db"));
    expect((await get()).status).toBe(503);
  });
});
