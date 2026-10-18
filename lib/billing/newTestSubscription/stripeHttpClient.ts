import "server-only";
import { Agent, request as httpsRequest, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import type Stripe from "stripe";
import { denyIsolatedExternalIO } from "../isolatedApplication/runtime";
import { stripeDeadlineFromHeaders, internalDeadlineHeader } from "./stripeDeadline";

type NativeRequest = (options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;
const responseLimit = 262_144;
const unsupportedConfiguration = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy", "NODE_USE_ENV_PROXY", "NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AWS_CA_BUNDLE", "NODE_TLS_REJECT_UNAUTHORIZED", "OPENSSL_CONF"] as const;
/** Own the request, socket agent and complete body until success or hard abort.
 * An explicit synthetic native wire/configuration is an internal test seam.
 * The actual default always derives configuration refusal from process state;
 * it neither replaces managed trust nor bypasses an inherited proxy. */
export function createBoundedStripeHttpClient(fixture?: { syntheticRequest: NativeRequest; configuredTransportKeys: readonly string[] }): Stripe.HttpClient<Stripe.HttpClientResponse<IncomingMessage, never>> {
  denyIsolatedExternalIO();
  if (fixture?.syntheticRequest === httpsRequest) throw new Error("stripe_synthetic_wire_required");
  const nativeRequest = fixture?.syntheticRequest ?? httpsRequest;
  const guard = () => {
    denyIsolatedExternalIO();
    // Inspect key presence only. Never read/log proxy URLs, certificates or
    // credentials; supporting the managed route/trust requires a separate gate.
    const configured = fixture ? fixture.configuredTransportKeys : unsupportedConfiguration.filter(name => Object.prototype.hasOwnProperty.call(process.env, name));
    if (configured.length) throw new Error("stripe_managed_transport_unsupported");
  };
  return {
    getClientName: () => "axiom-owned-bounded-https",
    async makeRequest(host, port, path, method, headers, requestData, protocol, timeout) {
      guard();
      if (host !== "api.stripe.com" || Number(port) !== 443 || protocol !== "https" || !path.startsWith("/v1/") || path.length > 16_384 || /[\r\n]/.test(path) || !["GET", "POST", "PUT", "DELETE"].includes(method)) throw new Error("stripe_endpoint_unsupported");
      const owner = stripeDeadlineFromHeaders(headers);
      const check = () => { guard(); if (owner.closed || performance.now() >= owner.deadline) throw Object.assign(new Error("stripe_hard_deadline"), { code: "ETIMEDOUT" }); };
      check();
      if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 10_000) throw new Error("stripe_deadline_unsupported");
      const effectiveTimeout = Math.min(timeout, Math.max(0, Math.floor(owner.deadline - performance.now())));
      if (effectiveTimeout <= 0) throw Object.assign(new Error("stripe_hard_deadline"), { code: "ETIMEDOUT" });
      const forwarded = { ...headers } as Record<string, string | number | string[] | undefined>;
      for (const key of Object.keys(forwarded)) if (["host", "proxy-authorization", "accept-encoding", "connection", internalDeadlineHeader.toLowerCase()].includes(key.toLowerCase())) delete forwarded[key];
      forwarded.host = "api.stripe.com"; forwarded["accept-encoding"] = "identity"; forwarded.connection = "close";
      const agent = new Agent({ keepAlive: false, maxSockets: 1, rejectUnauthorized: true });
      return new Promise<Stripe.HttpClientResponse<IncomingMessage, never>>((resolve, reject) => {
        let req: ClientRequest | undefined; let res: IncomingMessage | undefined; let done = false;
        let completeBody = false;
        const cleanup = (error?: Error) => { owner?.cancel.delete(fail); clearTimeout(timer); req?.destroy(error); res?.destroy(error); agent.destroy(); };
        const fail = (error: Error) => { if (done) return; done = true; cleanup(error); reject(error); };
        const timer = setTimeout(() => fail(Object.assign(new Error("stripe_hard_deadline"), { code: "ETIMEDOUT" })), effectiveTimeout);
        owner?.cancel.add(fail);
        try {
          check();
          req = nativeRequest({ hostname: "api.stripe.com", port: 443, protocol: "https:", method, path, headers: forwarded, agent, rejectUnauthorized: true, servername: "api.stripe.com", minVersion: "TLSv1.2", maxHeaderSize: 16_384 }, response => {
            res = response;
            response.once("error", fail); response.once("aborted", () => fail(new Error("stripe_response_aborted")));
            response.once("close", () => { if (!completeBody && !done) fail(new Error("stripe_response_incomplete")); });
            try {
              check();
              if (!response.statusCode || response.statusCode >= 300 && response.statusCode < 400) throw new Error("stripe_redirect_unsupported");
              if (typeof response.headers["content-type"] !== "string" || !response.headers["content-type"].toLowerCase().startsWith("application/json") || response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") throw new Error("stripe_response_unsupported");
              if (response.headers["content-length"] && Number(response.headers["content-length"]) > responseLimit) throw new Error("stripe_response_bounds");
            } catch (error) { fail(error as Error); return; }
            const chunks: Buffer[] = []; let bytes = 0;
            response.on("data", (chunk: Buffer | string) => {
              if (done) return;
              try { check(); const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); bytes += value.byteLength; if (bytes > responseLimit) throw new Error("stripe_response_bounds"); chunks.push(value); } catch (error) { fail(error as Error); }
            });
            response.once("end", () => {
              if (done) return;
              try {
                check();
                const body: unknown = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
                if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("stripe_response_unsupported");
                const received: Record<string, string> = {};
                for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) received[key] = Array.isArray(value) ? value.join(",") : value;
                completeBody = true; done = true; cleanup();
                resolve({ getStatusCode: () => response.statusCode!, getHeaders: () => received, getRawResponse: () => response, toJSON: async () => body, toStream: () => { throw new Error("stripe_stream_unsupported"); } });
              } catch (error) { fail(error as Error); }
            });
          });
          req.once("error", fail);
          req.once("close", () => { req?.removeListener("error", fail); });
          check(); req.end(requestData ?? undefined);
        } catch (error) { fail(error as Error); }
      });
    },
  };
}
