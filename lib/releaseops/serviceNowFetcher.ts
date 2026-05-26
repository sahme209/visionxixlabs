/**
 * Phase 471 — ServiceNow Table API fetcher.
 *
 * Pulls the change_request table. Default sysparm_query filters to
 * rows updated in the last 7 days, sorted by sys_updated_on desc.
 * Basic auth using user:password.
 */

import type { ServiceNowChange } from "./providers/changeTicketProjectors";
import type { ServiceNowFetcher } from "./changeTicketSyncResponder";

interface TableResponse { result?: ServiceNowChange[] }

const DEFAULT_QUERY = "sys_updated_on>=javascript:gs.daysAgoStart(7)^ORDERBYDESCsys_updated_on";
const FIELDS = "sys_id,number,short_description,type,state,approval,priority,assigned_to,opened_by,opened_at,closed_at,category,cmdb_ci";

export interface CreateServiceNowFetcherOptions {
  /** Instance URL, e.g. "https://acme.service-now.com". Falls back to env. */
  instanceUrl?: string;
  user?: string;
  pass?: string;
  fetchImpl?: typeof fetch;
}

export function createServiceNowFetcher(opts: CreateServiceNowFetcherOptions = {}): ServiceNowFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    async listChanges(listOpts) {
      const instanceUrl = (opts.instanceUrl ?? process.env.SERVICENOW_INSTANCE ?? "").replace(/\/$/, "");
      const user = opts.user ?? process.env.SERVICENOW_USER;
      const pass = opts.pass ?? process.env.SERVICENOW_PASS;
      if (!instanceUrl || !user || !pass) {
        throw new Error("SERVICENOW_INSTANCE, SERVICENOW_USER, and SERVICENOW_PASS must all be configured");
      }
      const auth = base64(`${user}:${pass}`);
      const limit = Math.min(listOpts.limit ?? 100, 500);
      const url = new URL(`${instanceUrl}/api/now/table/change_request`);
      url.searchParams.set("sysparm_query", DEFAULT_QUERY);
      url.searchParams.set("sysparm_limit", String(limit));
      url.searchParams.set("sysparm_fields", FIELDS);
      url.searchParams.set("sysparm_display_value", "false");
      url.searchParams.set("sysparm_exclude_reference_link", "true");

      const r = await fetchImpl(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${auth}`,
        },
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`ServiceNow ${r.status}: ${text.slice(0, 200)}`);
      }
      const body = (await r.json()) as TableResponse;
      return body.result ?? [];
    },
  };
}

function base64(input: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(input, "utf8").toString("base64");
  // eslint-disable-next-line no-undef
  return btoa(unescape(encodeURIComponent(input)));
}
