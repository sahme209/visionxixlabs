import { describe, expect, it } from "vitest";
import { EXAMPLE_PLUGIN_MANIFEST, validatePluginManifest } from "../pluginManifest";

describe("V19 plugin manifest v1", () => {
  it("accepts the published example and summarizes what a reviewer must look at", () => {
    const r = validatePluginManifest(EXAMPLE_PLUGIN_MANIFEST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.review).toEqual({ readOnlyTools: 1, writeTools: [{ name: "post_maintenance_notice", effect: "Publishes a notice on the public status page." }], host: "mcp.example.com", scopes: ["release_gate:read"], events: ["deployment.freeze_ended", "deployment.freeze_started"] });
  });
  it("requires an effect for writing tools and refuses unknown events, broad scopes and local URLs", () => {
    const bad = (over: Record<string, unknown>) => { const r = validatePluginManifest({ ...EXAMPLE_PLUGIN_MANIFEST, ...over }); return r.ok ? [] : r.errors; };
    expect(bad({ tools: [{ name: "delete_all", description: "Deletes", readOnly: false }] }).join()).toMatch(/must describe their effect/);
    expect(bad({ webhookEvents: ["everything"] }).join()).toMatch(/not a V19 event/);
    expect(bad({ apiScopes: ["*"] }).join()).toMatch(/cannot be requested/);
    expect(bad({ transport: { type: "mcp_streamable_http", url: "http://localhost:8080" } }).join()).toMatch(/public https URL/);
    expect(bad({ tools: [{ name: "a_tool", description: "x", readOnly: true }, { name: "a_tool", description: "y", readOnly: true }] }).join()).toMatch(/appears twice/);
    expect(bad({ extra: true }).length).toBeGreaterThan(0);
  });
});
