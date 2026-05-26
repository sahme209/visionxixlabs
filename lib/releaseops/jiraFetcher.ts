/**
 * Phase 471 — Jira REST fetcher.
 *
 * Cloud-flavor Jira uses basic auth: base64(email:api_token). Default
 * JQL = "updated >= -7d" — recent activity only — so we don't pull
 * the whole backlog on every sync. The route accepts a JQL override.
 */

import type { JiraIssue } from "./providers/changeTicketProjectors";
import type { JiraFetcher } from "./changeTicketSyncResponder";

interface JiraSearchResponse { issues?: JiraIssue[]; nextPageToken?: string | null }

const DEFAULT_JQL = "updated >= -7d ORDER BY updated DESC";
const ISSUE_FIELDS = "summary,issuetype,status,priority,assignee,reporter,labels,components,created,resolutiondate";

export interface CreateJiraFetcherOptions {
  /** Base URL, e.g. "https://acme.atlassian.net". Falls back to process.env.JIRA_BASE_URL. */
  baseUrl?: string;
  /** Account email. Falls back to process.env.JIRA_EMAIL. */
  email?: string;
  /** API token. Falls back to process.env.JIRA_API_TOKEN. */
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

export function createJiraFetcher(opts: CreateJiraFetcherOptions = {}): JiraFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    async listIssues(listOpts) {
      const baseUrl = (opts.baseUrl ?? process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
      const email = opts.email ?? process.env.JIRA_EMAIL;
      const apiToken = opts.apiToken ?? process.env.JIRA_API_TOKEN;
      if (!baseUrl || !email || !apiToken) {
        throw new Error("JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must all be configured");
      }
      const auth = base64(`${email}:${apiToken}`);
      const jql = listOpts.jql ?? DEFAULT_JQL;
      const maxResults = Math.min(listOpts.maxResults ?? 50, 100);
      const url = new URL(`${baseUrl}/rest/api/3/search/jql`);
      url.searchParams.set("jql", jql);
      url.searchParams.set("fields", ISSUE_FIELDS);
      url.searchParams.set("maxResults", String(maxResults));

      const r = await fetchImpl(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${auth}`,
        },
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Jira ${r.status}: ${text.slice(0, 200)}`);
      }
      const body = (await r.json()) as JiraSearchResponse;
      return body.issues ?? [];
    },
  };
}

function base64(input: string): string {
  // Buffer is available in Node and the Next.js runtime. Falls back to
  // btoa for any edge-case environment lacking Buffer.
  if (typeof Buffer !== "undefined") return Buffer.from(input, "utf8").toString("base64");
  // eslint-disable-next-line no-undef
  return btoa(unescape(encodeURIComponent(input)));
}
