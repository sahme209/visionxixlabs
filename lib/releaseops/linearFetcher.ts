/**
 * Phase 470 — Linear GraphQL fetcher.
 *
 * Single-page issue list pull. Linear's API authenticates via an
 * `Authorization: <key>` header — note: no "Bearer" prefix, unlike
 * GitHub.
 */

import type { LinearIssue } from "./providers/changeTicketProjectors";
import type { LinearFetcher } from "./changeTicketSyncResponder";

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

const ISSUE_QUERY = `
  query ListIssues($first: Int!) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        url
        priority
        state { name type }
        labels { nodes { name } }
        assignee { id }
        creator { id }
        createdAt
        completedAt
        canceledAt
      }
    }
  }
`;

interface GraphQLResponse {
  data?: { issues?: { nodes?: LinearIssue[] } };
  errors?: ReadonlyArray<{ message: string }>;
}

export interface CreateLinearFetcherOptions {
  /** Linear API key. Falls back to process.env.LINEAR_API_KEY at call time. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export function createLinearFetcher(opts: CreateLinearFetcherOptions = {}): LinearFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  return {
    async listIssues(listOpts) {
      const apiKey = opts.apiKey ?? process.env.LINEAR_API_KEY;
      if (!apiKey) throw new Error("LINEAR_API_KEY not configured");
      const r = await fetchImpl(LINEAR_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey,
        },
        body: JSON.stringify({
          query: ISSUE_QUERY,
          variables: { first: listOpts.first ?? 100 },
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Linear ${r.status}: ${text.slice(0, 200)}`);
      }
      const body = (await r.json()) as GraphQLResponse;
      if (body.errors && body.errors.length > 0) {
        throw new Error(`Linear GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
      }
      return body.data?.issues?.nodes ?? [];
    },
  };
}
