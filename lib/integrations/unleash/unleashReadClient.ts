import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";
import { boundedText, getJson, isRecord } from "../readOnlyHttp";

/**
 * Unleash read-only client (feature flags, self-hosted or Unleash Cloud). Uses the client API with a
 * client token, which can only read flag configuration for its own environment; V19 never toggles flags
 * or edits strategies. Public HTTPS hosts only. Live acceptance pending.
 */
export interface UnleashFlag { name: string; enabled: boolean; type: string | null; stale: boolean; strategies: number }
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export async function validateUnleashBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("unleash_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("unleash_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw || !/^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1])) throw new Error("unleash_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || /\.(localhost|local|internal|svc)$/.test(hostname)) throw new Error("unleash_private_host_blocked");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("unleash_private_host_blocked");
  return `${url.origin}${raw[1].replace(/\/$/, "")}`;
}

export class UnleashReadClient {
  constructor(private readonly baseUrl: string, private readonly clientToken: string) {
    if (!clientToken || clientToken.length > 300) throw new Error("unleash_token_invalid");
  }

  async listFlags(): Promise<UnleashFlag[]> {
    const body = await getJson(`${this.baseUrl}/api/client/features`, { authorization: this.clientToken }, "unleash");
    if (!isRecord(body) || !Array.isArray(body.features) || body.features.length > 5000) throw new Error("unleash_response_invalid");
    return body.features.filter(isRecord).flatMap((f) => {
      const name = typeof f.name === "string" && NAME.test(f.name) ? f.name : null;
      if (!name || typeof f.enabled !== "boolean") return [];
      return [{ name, enabled: f.enabled, type: boundedText(f.type, 32), stale: f.stale === true, strategies: Array.isArray(f.strategies) ? f.strategies.length : 0 }];
    }).slice(0, 500);
  }
}
