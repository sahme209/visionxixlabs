import "server-only";
import { request as httpsRequest } from "node:https";
import { createHttpHeaders, type HttpClient, type PipelineRequest } from "@azure/core-rest-pipeline";
import { AzureEnrollmentError, isAzureUuid, type AzureCredentialInput } from "./policy";
export interface AzureRawResponse {
    status: number;
    headers: Record<string, string>;
    body: AsyncIterable<Uint8Array>;
    destroy: () => void;
}
export type AzureRawSend = (request: PipelineRequest, signal: AbortSignal) => Promise<AzureRawResponse>;
const MAX_BYTES = 131072;
/** Fixed verified HTTPS; ignores SDK/ambient proxy, agent, endpoint and TLS options. */
const sendHttps: AzureRawSend = async (request, signal) => new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const body = request.body;
    const pending = httpsRequest({ protocol: "https:", hostname: url.hostname, port: 443, path: url.pathname + url.search, method: request.method, agent: false, maxHeaderSize: 16384, signal, headers: { ...request.headers.toJSON(), host: url.hostname, "accept-encoding": "identity" } }, response => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers))
            if (value !== undefined)
                headers[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
        resolve({ status: response.statusCode ?? 500, headers, body: response, destroy: () => response.destroy() });
    });
    pending.on("error", reject);
    pending.setTimeout(5000, () => pending.destroy(new Error("azure_request_timeout")));
    if (typeof body === "string")
        pending.end(body);
    else
        pending.end();
});
/** No caller URL is accepted by routes. This also constrains SDK discovery/redirect behavior. */
export function createBoundedAzureHttpClient(input: AzureCredentialInput & {
    operation: "validate" | "inventory";
    signal?: AbortSignal;
    send?: AzureRawSend;
    now?: () => number;
}): HttpClient {
    const now = input.now ?? Date.now, deadline = now() + 15000, seen = new Set<string>();
    let calls = 0;
    return { async sendRequest(request) {
            const fail = () => { throw new AzureEnrollmentError(input.operation === "validate" ? "azure_identity_unverified" : "azure_inventory_unavailable"); };
            let url: URL;
            try {
                url = new URL(request.url);
            }
            catch {
                return fail();
            }
            if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || /%(?:2f|5c|2e)/i.test(url.pathname) || request.body !== undefined && typeof request.body !== "string")
                return fail();
            const query = [...url.searchParams.keys()];
            let key = "";
            if (url.hostname === "login.microsoftonline.com") {
                if (request.method === "GET" && url.pathname === `/${input.tenantId}/v2.0/.well-known/openid-configuration` && query.length === 0)
                    key = "metadata";
                if (request.method === "POST" && url.pathname === `/${input.tenantId}/oauth2/v2.0/token` && query.length <= 1 && query.every(name => name === "client-request-id") && (query.length === 0 || isAzureUuid(url.searchParams.get("client-request-id")?.toLowerCase()))) {
                    const form = new URLSearchParams(typeof request.body === "string" ? request.body : "");
                    const scopes = (form.get("scope") ?? "").split(" ").filter(Boolean);
                    if (form.get("client_id") !== input.clientId || form.get("client_secret") !== input.clientSecret || form.get("grant_type") !== "client_credentials" || scopes.length !== 1 || scopes[0] !== "https://management.azure.com/.default")
                        return fail();
                    key = "token";
                }
            }
            else if (url.hostname === "management.azure.com" && request.method === "GET") {
                const base = `/subscriptions/${input.subscriptionId}`;
                if (input.operation === "validate" && url.pathname === base && query.length === 1 && url.searchParams.get("api-version") === "2022-12-01")
                    key = "subscription";
                if (input.operation === "inventory" && url.pathname === `${base}/resourcegroups` && query.length === 2 && query.includes("api-version") && query.includes("$top") && url.searchParams.get("api-version") === "2025-04-01" && url.searchParams.get("$top") === "100")
                    key = "groups";
            }
            if (!key || seen.has(key) || ++calls > 3 || now() >= deadline || input.signal?.aborted || request.abortSignal?.aborted || typeof request.body === "string" && Buffer.byteLength(request.body) > 16384)
                return fail();
            seen.add(key);
            const signal = AbortSignal.any([AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - now()))), ...(input.signal ? [input.signal] : [])]);
            // AbortSignalLike is a structural SDK type, not necessarily a platform AbortSignal.
            const onAbort = () => controller.abort();
            const controller = new AbortController();
            request.abortSignal?.addEventListener("abort", onAbort, { once: true });
            const linked = AbortSignal.any([signal, controller.signal]);
            let raw: AzureRawResponse | undefined;
            try {
                request.headers.set("accept-encoding", "identity");
                raw = await (input.send ?? sendHttps)(request, linked);
                const encoding = raw.headers["content-encoding"]?.toLowerCase();
                const length = raw.headers["content-length"];
                if (raw.status >= 300 && raw.status < 400 || encoding && encoding !== "identity" || length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
                    return fail();
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of raw.body) {
                    if (linked.aborted || now() >= deadline)
                        return fail();
                    size += chunk.byteLength;
                    if (size > MAX_BYTES)
                        return fail();
                    chunks.push(Buffer.from(chunk));
                }
                if (linked.aborted || now() >= deadline)
                    return fail();
                let bodyAsText = Buffer.concat(chunks, size).toString("utf8");
                let headers = raw.headers;
                // SDKs may log provider error descriptions internally. Never give them raw error bodies/headers.
                if (raw.status < 200 || raw.status >= 300) {
                    bodyAsText = JSON.stringify(url.hostname === "login.microsoftonline.com" ? { error: "invalid_client", error_description: "Azure credential request was rejected." } : { error: { code: "AzureReadUnavailable", message: "Azure read unavailable." } });
                    headers = { "content-type": "application/json" };
                }
                else if (key === "token") {
                    const body = JSON.parse(bodyAsText) as Record<string, unknown>;
                    if (typeof body.access_token !== "string" || body.access_token.length < 1 || body.access_token.length > 16384 || /[\u0000-\u0020\u007f]/.test(body.access_token) || body.token_type !== "Bearer" || !Number.isSafeInteger(body.expires_in) || Number(body.expires_in) < 1 || Number(body.expires_in) > 86400)
                        return fail();
                    bodyAsText = JSON.stringify({ access_token: body.access_token, token_type: "Bearer", expires_in: body.expires_in });
                    headers = { "content-type": "application/json" };
                }
                else if (key === "groups") {
                    const body = JSON.parse(bodyAsText) as Record<string, unknown>;
                    if (!Array.isArray(body.value)) return fail();
                }
                else if (key === "metadata") {
                    const body = JSON.parse(bodyAsText) as Record<string, unknown>, base = `https://login.microsoftonline.com/${input.tenantId}`;
                    const expected = { issuer: `${base}/v2.0`, authorization_endpoint: `${base}/oauth2/v2.0/authorize`, token_endpoint: `${base}/oauth2/v2.0/token`, jwks_uri: `${base}/discovery/v2.0/keys` };
                    if (Object.entries(expected).some(([name, value]) => body[name] !== value))
                        return fail();
                    bodyAsText = JSON.stringify(expected);
                    headers = { "content-type": "application/json" };
                }
                return { request, status: raw.status, headers: createHttpHeaders(headers), bodyAsText };
            }
            catch {
                return fail();
            }
            finally {
                raw?.destroy();
                request.abortSignal?.removeEventListener("abort", onAbort);
            }
        } };
}
