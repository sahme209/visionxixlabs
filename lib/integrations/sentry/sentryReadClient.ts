import "server-only";
import { boundedText, getJson, isoTime, isRecord, providerLink } from "../readOnlyHttp";

/**
 * Sentry read-only client: unresolved issues first seen in a release, so V19 can show whether a
 * deployment introduced new errors (release verification). Never resolves, assigns or mutes issues.
 * Use an internal-integration token with project:read and event:read only. Live acceptance pending.
 */
export type SentryRegion = "us" | "de";
export interface SentryIssue { id: string; shortId: string | null; title: string; level: string | null; count: number | null; userCount: number | null; firstSeen: string | null; url: string | null }
const SLUG = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const RELEASE = /^[A-Za-z0-9._+@:-]{1,200}$/;

export class SentryReadClient {
  private readonly host: string;
  constructor(private readonly org: string, private readonly project: string, private readonly token: string, region: SentryRegion = "us") {
    if (!SLUG.test(org) || !SLUG.test(project)) throw new Error("sentry_scope_invalid");
    if (!token || token.length > 200) throw new Error("sentry_token_invalid");
    this.host = region === "de" ? "https://de.sentry.io" : "https://sentry.io";
  }

  /** Unresolved issues whose first event came from this release. */
  async newIssuesInRelease(release: string): Promise<SentryIssue[]> {
    if (!RELEASE.test(release)) throw new Error("sentry_release_invalid");
    const q = new URLSearchParams({ query: `is:unresolved firstRelease:"${release}"`, limit: "100", sort: "freq" });
    const body = await getJson(`${this.host}/api/0/projects/${this.org}/${this.project}/issues/?${q}`, { authorization: `Bearer ${this.token}` }, "sentry");
    if (!Array.isArray(body) || body.length > 100) throw new Error("sentry_response_invalid");
    return body.filter(isRecord).flatMap((i) => {
      const id = typeof i.id === "string" && /^\d{1,20}$/.test(i.id) ? i.id : null;
      const title = boundedText(i.title, 512);
      if (!id || !title) return [];
      const num = (v: unknown) => (typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : typeof v === "number" && Number.isSafeInteger(v) ? v : null);
      return [{ id, shortId: boundedText(i.shortId, 64), title, level: boundedText(i.level, 16), count: num(i.count), userCount: num(i.userCount), firstSeen: isoTime(i.firstSeen), url: providerLink(i.permalink, "sentry.io") }];
    });
  }
}
