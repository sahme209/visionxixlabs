import "server-only";
import { boundedText, getJson, isoTime, isRecord } from "../readOnlyHttp";

/**
 * LaunchDarkly read-only client: flag state in ONE project and environment, so V19 can show which
 * flags are on beside a release and flag stale temporary flags. Never toggles, edits targeting or
 * archives. Use a reader-role access token. Live acceptance with a real account is pending.
 */
export type LaunchDarklyCredential = { token: string };
export interface LaunchDarklyFlag { key: string; name: string; kind: "boolean" | "multivariate" | null; on: boolean | null; temporary: boolean; archived: boolean; tags: string[]; lastModified: string | null; createdAt: string | null }
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class LaunchDarklyReadClient {
  constructor(private readonly projectKey: string, private readonly environmentKey: string, private readonly credential: LaunchDarklyCredential) {
    if (!KEY.test(projectKey) || !KEY.test(environmentKey)) throw new Error("launchdarkly_scope_invalid");
    if (!credential.token || credential.token.length > 200) throw new Error("launchdarkly_token_invalid");
  }

  async listFlags(): Promise<LaunchDarklyFlag[]> {
    const q = new URLSearchParams({ env: this.environmentKey, summary: "true", limit: "100" });
    const body = await getJson(`https://app.launchdarkly.com/api/v2/flags/${encodeURIComponent(this.projectKey)}?${q}`, { authorization: this.credential.token }, "launchdarkly");
    if (!isRecord(body) || !Array.isArray(body.items) || body.items.length > 100) throw new Error("launchdarkly_response_invalid");
    return body.items.filter(isRecord).flatMap((f) => {
      const key = typeof f.key === "string" && KEY.test(f.key) ? f.key : null;
      const name = boundedText(f.name, 256);
      if (!key || !name) return [];
      const envs = isRecord(f.environments) ? f.environments : {};
      const env = isRecord(envs[this.environmentKey]) ? (envs[this.environmentKey] as Record<string, unknown>) : null;
      const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? new Date(v).toISOString() : isoTime(v));
      return [{ key, name, kind: f.kind === "boolean" || f.kind === "multivariate" ? f.kind : null, on: env && typeof env.on === "boolean" ? env.on : null, temporary: f.temporary === true, archived: f.archived === true, tags: Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === "string" && KEY.test(t)).slice(0, 20) : [], lastModified: ms(env?.lastModified), createdAt: ms(f.creationDate) }];
    });
  }
}

/** Temporary flags still on in this environment for longer than `days`: candidates for clean-up. */
export function staleTemporaryFlags(flags: readonly LaunchDarklyFlag[], now: Date, days = 30): LaunchDarklyFlag[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return flags.filter((f) => f.temporary && !f.archived && f.on === true && f.lastModified !== null && Date.parse(f.lastModified) < cutoff);
}
