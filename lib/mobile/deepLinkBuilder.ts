/**
 * Pure mobile deep-link builder + parser.
 *
 * Generates URLs that the mobile shell + push payloads use to drop
 * the user straight into the right screen. Shared between server-
 * side push builders and the mobile router so both speak the same
 * scheme.
 *
 * Pure / deterministic.
 */

export type DeepLinkTarget =
  | "approval_packet"
  | "incident"
  | "method_proposal"
  | "agent_activity"
  | "compliance_packet"
  | "tenant_insights"
  | "outbound_digest";

export interface DeepLinkInput {
  target: DeepLinkTarget;
  /** Resource id when the target needs one (packet id, incident id, proposal id). */
  id?: string;
  /** Optional query parameters surfaced to the mobile router. */
  params?: Record<string, string>;
}

export interface DeepLinkOptions {
  /** App URL scheme (default "axiom://"). */
  scheme?: string;
  /** Universal-link fallback (default https://visionxixlabs.com/m/). */
  universalBase?: string;
}

const DEFAULT_SCHEME = "axiom://";
const DEFAULT_UNIVERSAL = "https://visionxixlabs.com/m/";

const TARGET_PATH: Record<DeepLinkTarget, string> = {
  approval_packet:   "approvals",
  incident:          "incidents",
  method_proposal:   "proposals",
  agent_activity:    "activity",
  compliance_packet: "compliance",
  tenant_insights:   "insights",
  outbound_digest:   "outbound",
};

function appendParams(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.set(k, v);
  return `${url}?${usp.toString()}`;
}

export function buildDeepLink(input: DeepLinkInput, opts?: DeepLinkOptions): { scheme: string; universal: string } {
  // Preserve the scheme's authority slashes (axiom://) — just guarantee
  // exactly one trailing slash before the path segment.
  const rawScheme = opts?.scheme ?? DEFAULT_SCHEME;
  const scheme = rawScheme.endsWith("/") ? rawScheme : `${rawScheme}/`;
  const rawUniversal = opts?.universalBase ?? DEFAULT_UNIVERSAL;
  const universal = rawUniversal.endsWith("/") ? rawUniversal : `${rawUniversal}/`;
  const path = TARGET_PATH[input.target];
  const tail = input.id ? `${path}/${encodeURIComponent(input.id)}` : path;
  return {
    scheme: appendParams(`${scheme}${tail}`, input.params),
    universal: appendParams(`${universal}${tail}`, input.params),
  };
}

export interface ParsedDeepLink {
  target: DeepLinkTarget;
  id: string | null;
  params: Record<string, string>;
}

export interface ParseResult {
  ok: boolean;
  parsed?: ParsedDeepLink;
  reason?: "invalid_url" | "unknown_target";
}

export function parseDeepLink(input: string): ParseResult {
  try {
    const cleaned = input.startsWith("axiom://") ? input.replace("axiom://", "axiom://_/") : input;
    const url = new URL(cleaned);
    // Path looks like "/<target>" or "/<target>/<id>" for universal links,
    // or "/_/<target>(/...)" for our normalized scheme path.
    const parts = url.pathname.split("/").filter(Boolean);
    let targetCandidate: string | undefined;
    let idCandidate: string | undefined;
    if (url.protocol === "axiom:") {
      // pathname starts with "_/" → strip first segment
      if (parts[0] === "_") {
        targetCandidate = parts[1];
        idCandidate = parts[2];
      } else {
        targetCandidate = parts[0];
        idCandidate = parts[1];
      }
    } else if (url.pathname.startsWith("/m/")) {
      // strip "/m/"
      targetCandidate = parts[1];
      idCandidate = parts[2];
    } else {
      targetCandidate = parts[0];
      idCandidate = parts[1];
    }
    const target = Object.entries(TARGET_PATH).find(([, p]) => p === targetCandidate)?.[0] as DeepLinkTarget | undefined;
    if (!target) return { ok: false, reason: "unknown_target" };
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });
    return {
      ok: true,
      parsed: { target, id: idCandidate ? decodeURIComponent(idCandidate) : null, params },
    };
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
}
