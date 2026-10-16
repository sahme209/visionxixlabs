import { expect, it, vi } from "vitest";
import { createAzureProviderClient } from "../providerClient";
import { input } from "./fixture";
import type { AzureRawResponse, AzureRawSend } from "../boundedHttp";
function setup(mode = "ok") {
    const urls: string[] = [];
    const send: AzureRawSend = vi.fn(async (request) => {
        const url = new URL(request.url);
        urls.push(request.url);
        let body: unknown;
        if (url.hostname === "login.microsoftonline.com") {
            body = { access_token: "synthetic-token-not-real", token_type: "Bearer", expires_in: 3600 };
        }
        else if (url.pathname.endsWith("resourcegroups")) {
            body = { value: mode === "empty" ? [] : [{ id: `/subscriptions/${input.subscriptionId}/resourceGroups/group`, name: "group", location: "eastus" }], nextLink: "https://evil.invalid/more" };
            if (mode === "missing_value")
            body = {};
        if (mode === "malformed")
                body = { value: [{ name: "group", location: "eastus" }] };
            if (mode === "echo_secret")
                body = { value: [{ id: `/subscriptions/${input.subscriptionId}/resourceGroups/${input.clientSecret}`, name: input.clientSecret, location: "eastus" }] };
        }
        else
            body = { id: `/subscriptions/${input.subscriptionId}`, subscriptionId: mode === "wrong" ? input.tenantId : input.subscriptionId, tenantId: input.tenantId };
        const status = mode === "denied" && url.hostname === "management.azure.com" ? 403 : 200;
        return { status, headers: { "content-type": "application/json" }, body: (async function* () { yield Buffer.from(JSON.stringify(body)); })(), destroy: vi.fn() } satisfies AzureRawResponse;
    });
    return { client: createAzureProviderClient({ send }), send, urls };
}
it("uses real MSAL request and a fixed exact-subscription GET without token export", async () => { const f = setup(); const r = await f.client.validate(input); expect(r).toEqual({ tenantId: input.tenantId, subscriptionId: input.subscriptionId }); expect(f.urls.some(url => url.includes("/oauth2/v2.0/token"))).toBe(true); expect(f.urls.filter(url => url.includes("management.azure.com")).length).toBe(1); expect(JSON.stringify(r)).not.toContain("token"); });
it("uses actual ARM serialization for exactly one bounded page, ignoring attacker nextLink", async () => { const f = setup(); const r = await f.client.read(input); expect(r).toMatchObject({ complete: false, limit: 100, scope: "first_resource_groups_page", resourceGroups: [{ name: "group" }] }); const arm = f.urls.filter(url => new URL(url).hostname === "management.azure.com"); expect(arm).toHaveLength(1); expect(new URL(arm[0]).searchParams.get("$top")).toBe("100"); expect(f.urls.some(url => url.includes("evil.invalid"))).toBe(false); });
it("keeps observed empty page incomplete", async () => { const f = setup("empty"); expect(await f.client.read(input)).toMatchObject({ resourceGroups: [], complete: false }); });
it("rejects wrong subscription identity", async () => { await expect(setup("wrong").client.validate(input)).rejects.toMatchObject({ code: "azure_identity_unverified" }); });
it("distinguishes denied inventory from malformed rows without SDK leakage", async () => { await expect(setup("denied").client.read(input)).rejects.toMatchObject({ code: "azure_inventory_denied" }); await expect(setup("malformed").client.read(input)).rejects.toMatchObject({ code: "azure_inventory_unavailable" }); });
it("withholds a provider echo of submitted secret in otherwise valid resource metadata", async () => { await expect(setup("echo_secret").client.read(input)).rejects.toMatchObject({ code: "azure_inventory_unavailable" }); });

it("does not let SDK missing-value fallback fabricate an observed empty page", async () => { await expect(setup("missing_value").client.read(input)).rejects.toMatchObject({code:"azure_inventory_unavailable"}); });
it("ignores ambient endpoint and credential variables",async()=>{vi.stubEnv("AZURE_AUTHORITY_HOST","https://evil.invalid");vi.stubEnv("AZURE_CLIENT_ID","other");vi.stubEnv("AZURE_CLIENT_SECRET","other");try{const f=setup();await f.client.validate(input);expect(f.urls.every(value=>["login.microsoftonline.com","management.azure.com"].includes(new URL(value).hostname))).toBe(true);}finally{vi.unstubAllEnvs();}});
