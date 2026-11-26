import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PagerDutyReadClient } from "../pagerDutyReadClient";
afterEach(() => vi.unstubAllGlobals());
describe("PagerDuty read-only client", () => {
  it("lists open incidents with one bounded GET and drops malformed rows and foreign links", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe("https://api.pagerduty.com/incidents?statuses%5B%5D=triggered&statuses%5B%5D=acknowledged&limit=100&sort_by=created_at%3Adesc&service_ids%5B%5D=PSVC01");
      expect(init.method).toBe("GET"); expect(init.redirect).toBe("error"); expect(init.headers.authorization).toBe("Token token=fixture");
      return Response.json({ incidents: [
        { id: "PINC01", incident_number: 42, title: "Checkout errors", status: "triggered", urgency: "high", service: { summary: "Checkout" }, created_at: "2026-11-26T10:00:00Z", html_url: "https://acme.pagerduty.com/incidents/PINC01" },
        { id: "PINC02", title: "Old", status: "resolved" },
        { id: "PINC03", title: "Phish", status: "acknowledged", html_url: "https://evil.example/x" },
      ] });
    });
    vi.stubGlobal("fetch", fetcher);
    const out = await new PagerDutyReadClient({ token: "fixture" }).listOpenIncidents(["PSVC01"]);
    expect(out).toEqual([
      { id: "PINC01", number: 42, title: "Checkout errors", status: "triggered", urgency: "high", service: "Checkout", createdAt: "2026-11-26T10:00:00.000Z", url: "https://acme.pagerduty.com/incidents/PINC01" },
      { id: "PINC03", number: null, title: "Phish", status: "acknowledged", urgency: null, service: null, createdAt: null, url: null },
    ]);
    expect(Object.getOwnPropertyNames(PagerDutyReadClient.prototype).filter((m) => m !== "constructor")).toEqual(["listOpenIncidents"]);
  });
  it("uses the EU host, refuses bad service ids and surfaces API failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { expect(url.startsWith("https://api.eu.pagerduty.com/")).toBe(true); return new Response("no", { status: 401 }); }));
    await expect(new PagerDutyReadClient({ token: "t", region: "eu" }).listOpenIncidents()).rejects.toThrow("pagerduty_api_failed:401");
    await expect(new PagerDutyReadClient({ token: "t" }).listOpenIncidents(["x&y"])).rejects.toThrow("pagerduty_service_ids_invalid");
  });
});
