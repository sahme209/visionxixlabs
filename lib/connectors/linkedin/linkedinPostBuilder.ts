/**
 * Typed LinkedIn post builder — pure / no I/O.
 *
 * Takes a SocialDraft (output of marketingContentDrafter) and produces
 * the LinkedIn UGC Posts API payload along with the OAuth scopes the
 * tenant needs to publish it. The caller never POSTs from here —
 * publishing is staged via the approval engine. This module exists so:
 *   1. operators can preview the EXACT bytes that will go to LinkedIn
 *   2. the approval engine can hash the payload for the audit row
 *   3. tests prove the payload matches LinkedIn's expectations without
 *      ever calling the API.
 *
 * The full POST path will live in a server action later — gated by an
 * AxiomApprovalItem in "applied" state and audited via SecureAudit.
 */

import type { SocialDraft } from "@/lib/agents/marketingContentDrafter";

export type LinkedInAuthorKind = "organization" | "person";

export interface LinkedInAuthor {
  kind: LinkedInAuthorKind;
  /** LinkedIn URN, e.g. urn:li:organization:1234 or urn:li:person:abc. */
  urn: string;
}

export type LinkedInOAuthScope =
  | "w_member_social"        // post on behalf of a person
  | "w_organization_social"  // post on behalf of an org page
  | "r_organization_admin";  // read org admin scope (validation)

/** Mirrors the shape LinkedIn's UGC Posts endpoint expects. */
export interface LinkedInUgcPostPayload {
  author: string;                                 // URN
  lifecycleState: "PUBLISHED" | "DRAFT";
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: string };
      shareMediaCategory: "NONE" | "ARTICLE" | "IMAGE";
      media?: ReadonlyArray<{
        status: "READY";
        originalUrl: string;
        title?: { text: string };
        description?: { text: string };
      }>;
    };
  };
  visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" | "CONNECTIONS" };
}

export type BuildPostError =
  | "draft_not_linkedin"
  | "body_too_long"
  | "body_empty"
  | "invalid_author_urn";

export type BuildPostResult =
  | {
      ok: true;
      payload: LinkedInUgcPostPayload;
      requiredScopes: readonly LinkedInOAuthScope[];
      previewText: string;
      charCount: number;
    }
  | { ok: false; error: BuildPostError; message: string };

const LINKEDIN_HARD_LIMIT = 3000;
const URN_PATTERN = /^urn:li:(organization|person):[A-Za-z0-9_-]+$/;

function appendHashtagsAndCta(draft: SocialDraft): string {
  const parts: string[] = [draft.body.trim()];
  if (draft.hashtags.length > 0) {
    parts.push(draft.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  if (draft.cta?.href) {
    parts.push(`${draft.cta.label}: ${draft.cta.href}`);
  }
  return parts.join("\n\n");
}

/** Build the exact bytes that LinkedIn's UGC endpoint expects. */
export function buildLinkedInPost(
  draft: SocialDraft,
  author: LinkedInAuthor,
  options: { lifecycleState?: "PUBLISHED" | "DRAFT"; visibility?: "PUBLIC" | "CONNECTIONS" } = {},
): BuildPostResult {
  if (draft.channel !== "linkedin") {
    return { ok: false, error: "draft_not_linkedin", message: `Draft channel is "${draft.channel}", expected "linkedin".` };
  }
  if (!URN_PATTERN.test(author.urn)) {
    return { ok: false, error: "invalid_author_urn", message: `Author URN "${author.urn}" doesn't match urn:li:(organization|person):<id>.` };
  }
  const text = appendHashtagsAndCta(draft).trim();
  if (text.length === 0) {
    return { ok: false, error: "body_empty", message: "Composed body is empty after assembly." };
  }
  if (text.length > LINKEDIN_HARD_LIMIT) {
    return { ok: false, error: "body_too_long", message: `Composed body is ${text.length} chars, LinkedIn hard limit is ${LINKEDIN_HARD_LIMIT}.` };
  }

  const lifecycleState = options.lifecycleState ?? "PUBLISHED";
  const visibility = options.visibility ?? "PUBLIC";

  const payload: LinkedInUgcPostPayload = {
    author: author.urn,
    lifecycleState,
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
  };

  const requiredScopes: LinkedInOAuthScope[] =
    author.kind === "organization" ? ["w_organization_social"] : ["w_member_social"];

  return {
    ok: true,
    payload,
    requiredScopes,
    previewText: text,
    charCount: text.length,
  };
}
