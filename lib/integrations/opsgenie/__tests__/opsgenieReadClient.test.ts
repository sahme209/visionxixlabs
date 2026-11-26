import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OpsgenieReadClient } from "../opsgenieReadClient";
afterEach(() => vi.unstubAllGlobals());
const KEY = "0123456789abcdef-0123-4567";
describe("Opsgenie read-only client", () => {
  it("lists open alerts for a tag with one GET", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(new URL(url).searchParams.get("query")).toBe('status:open AND tag:"service:checkout"');
      expect(init.method).toBe("GET"); expect(init.headers.authorization).toBe(`GenieKey ${KEY}`);
      return Response.json({ data: [{ id: "a-1", tinyId: "17", message: "High latency", priority: "P1", acknowledged: false, tags: ["service:checkout", "bad tag!"], createdAt: "2026-11-26T09:00:00Z" }, { id: "a-2" }] });
    }));
    expect(await new OpsgenieReadClient({ apiKey: KEY }).listOpenAlerts("service:checkout")).toEqual([{ id: "a-1", tinyId: "17", message: "High latency", priority: "P1", acknowledged: false, tags: ["service:checkout"], createdAt: "2026-11-26T09:00:00.000Z" }]);
  });
  it("refuses bad keys, query injection through tags and malformed responses", async () => {
    expect(() => new OpsgenieReadClient({ apiKey: "nope" })).toThrow("opsgenie_api_key_invalid");
    await expect(new OpsgenieReadClient({ apiKey: KEY }).listOpenAlerts('x" OR status:closed')).rejects.toThrow("opsgenie_tag_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: "x" })));
    await expect(new OpsgenieReadClient({ apiKey: KEY, region: "eu" }).listOpenAlerts()).rejects.toThrow("opsgenie_response_invalid");
  });
});
