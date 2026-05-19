/**
 * Lightweight AWS SCP / IAM policy simulator.
 *
 * Pure local evaluation — no AWS SDK call. Given a policy JSON and
 * a synthetic "test request" descriptor, returns whether the policy
 * would Allow, Deny, or not-apply. Designed for the runbook ↔ policy
 * pre-flight loop: an operator drafts a hardening SCP, simulates
 * against representative requests, then promotes the policy.
 *
 * Coverage:
 *   ✓ Action matching (exact or trailing-glob like "s3:Delete*")
 *   ✓ Resource matching (exact or trailing-glob)
 *   ✓ NotAction / NotResource
 *   ✓ String[Not]Equals + Bool[IfExists] + Null + NumericEquals
 *     condition operators (the ones the Phase 102 recipe library uses)
 *   ✓ Multi-statement aggregation — explicit Deny beats any Allow
 *
 * NOT covered:
 *   ✗ Permission-boundary semantics
 *   ✗ Trust-policy evaluation (assume-role chain)
 *   ✗ ResourcePolicy ↔ identity policy combination
 *
 * That's deliberate — those need real AWS SDK calls. The simulator's
 * job is "does this candidate SCP express what I think it does?".
 *
 * Hard rules:
 *   - Pure function. No network.
 *   - Never mutates the input policy.
 *   - Unknown condition operators → Skip (don't crash, don't fake an
 *     answer). Returns a `limitations` array so the operator knows.
 */

export type SimulationVerdict = "Allow" | "Deny" | "NotApplicable";

export interface SimulationRequest {
  /** AWS-style action string, e.g. "s3:PutBucketPublicAccessBlock". */
  action: string;
  /** ARN (or "*"). */
  resource?: string;
  /** Principal context — used by Condition keys like aws:PrincipalTag/... */
  principalTags?: Record<string, string>;
  /** Resource context — used by aws:ResourceTag/... */
  resourceTags?: Record<string, string>;
  /** Numeric / boolean conditions Axiom recipes touch. */
  context?: Record<string, string | number | boolean | undefined>;
}

export interface StatementResult {
  sid?: string;
  effect: "Allow" | "Deny";
  matched: boolean;
  reason: string;
}

export interface SimulationResult {
  verdict: SimulationVerdict;
  /** Aggregated reasoning across all matching statements. */
  summary: string;
  statements: StatementResult[];
  /** Condition operators we couldn't evaluate. */
  limitations: string[];
}

interface IamStatement {
  Sid?: string;
  Effect?: "Allow" | "Deny";
  Action?: string | string[];
  NotAction?: string | string[];
  Resource?: string | string[];
  NotResource?: string | string[];
  Condition?: Record<string, Record<string, string | string[] | number | number[] | boolean>>;
}

interface IamPolicy {
  Version?: string;
  Statement?: IamStatement | IamStatement[];
}

export function simulateScp(policyJson: string, request: SimulationRequest): SimulationResult {
  let policy: IamPolicy;
  try {
    policy = JSON.parse(policyJson) as IamPolicy;
  } catch (err) {
    return {
      verdict: "NotApplicable",
      summary: "Policy JSON failed to parse — cannot simulate.",
      statements: [],
      limitations: [err instanceof Error ? err.message : String(err)],
    };
  }

  const statements: IamStatement[] = Array.isArray(policy.Statement)
    ? policy.Statement
    : policy.Statement
      ? [policy.Statement]
      : [];

  const results: StatementResult[] = [];
  const limitations: string[] = [];

  let denyHit: StatementResult | undefined;
  let allowHit: StatementResult | undefined;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const effect = stmt.Effect ?? "Allow";

    const actionOk = matchesAction(stmt, request.action);
    if (!actionOk.matched) {
      results.push({ sid: stmt.Sid, effect, matched: false, reason: actionOk.reason });
      continue;
    }
    const resourceOk = matchesResource(stmt, request.resource ?? "*");
    if (!resourceOk.matched) {
      results.push({ sid: stmt.Sid, effect, matched: false, reason: resourceOk.reason });
      continue;
    }
    const condOk = matchesConditions(stmt, request, limitations);
    if (!condOk.matched) {
      results.push({ sid: stmt.Sid, effect, matched: false, reason: condOk.reason });
      continue;
    }
    const result: StatementResult = {
      sid: stmt.Sid,
      effect,
      matched: true,
      reason: `${effect} — action+resource+condition matched`,
    };
    results.push(result);
    if (effect === "Deny" && !denyHit) denyHit = result;
    if (effect === "Allow" && !allowHit) allowHit = result;
  }

  // SCP semantics: explicit Deny wins. Otherwise, an Allow lets it
  // through. With no matching statement, the SCP does not apply.
  if (denyHit) {
    return {
      verdict: "Deny",
      summary: `Denied by statement ${denyHit.sid ?? "(no Sid)"}`,
      statements: results,
      limitations,
    };
  }
  if (allowHit) {
    return {
      verdict: "Allow",
      summary: `Allowed by statement ${allowHit.sid ?? "(no Sid)"}`,
      statements: results,
      limitations,
    };
  }
  return {
    verdict: "NotApplicable",
    summary: "No statement matched this request — the SCP doesn't apply.",
    statements: results,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

function matchesAction(stmt: IamStatement, action: string): { matched: boolean; reason: string } {
  if (stmt.NotAction !== undefined) {
    const list = arr(stmt.NotAction);
    if (list.some((pat) => globMatch(pat, action))) {
      return { matched: false, reason: `NotAction matched ${action}` };
    }
    return { matched: true, reason: "NotAction did not match" };
  }
  if (stmt.Action === undefined) return { matched: true, reason: "no Action — wildcard" };
  const list = arr(stmt.Action);
  const ok = list.some((pat) => globMatch(pat, action));
  return ok
    ? { matched: true, reason: `Action matched ${action}` }
    : { matched: false, reason: `Action did not match ${action}` };
}

function matchesResource(stmt: IamStatement, resource: string): { matched: boolean; reason: string } {
  if (stmt.NotResource !== undefined) {
    const list = arr(stmt.NotResource);
    if (list.some((pat) => globMatch(pat, resource))) {
      return { matched: false, reason: `NotResource matched ${resource}` };
    }
    return { matched: true, reason: "NotResource did not match" };
  }
  if (stmt.Resource === undefined) return { matched: true, reason: "no Resource — wildcard" };
  const list = arr(stmt.Resource);
  const ok = list.some((pat) => globMatch(pat, resource));
  return ok
    ? { matched: true, reason: `Resource matched ${resource}` }
    : { matched: false, reason: `Resource did not match ${resource}` };
}

function matchesConditions(stmt: IamStatement, req: SimulationRequest, limitations: string[]): { matched: boolean; reason: string } {
  if (!stmt.Condition) return { matched: true, reason: "no Condition" };

  for (const [op, kv] of Object.entries(stmt.Condition)) {
    const operator = op as string;
    for (const [key, raw] of Object.entries(kv)) {
      const expected = Array.isArray(raw) ? raw : [raw];
      const actual = resolveContextValue(key, req);

      switch (operator) {
        case "StringEquals": {
          if (actual === undefined) return { matched: false, reason: `${key} missing for StringEquals` };
          const ok = expected.some((v) => String(v) === String(actual));
          if (!ok) return { matched: false, reason: `${key}='${actual}' did not match StringEquals` };
          break;
        }
        case "StringNotEquals": {
          if (actual === undefined) break; // Per AWS semantics, missing key → condition is satisfied for *NotEquals.
          const conflict = expected.some((v) => String(v) === String(actual));
          if (conflict) return { matched: false, reason: `${key}='${actual}' matched a forbidden StringNotEquals value` };
          break;
        }
        case "NumericEquals": {
          if (actual === undefined) return { matched: false, reason: `${key} missing for NumericEquals` };
          const ok = expected.some((v) => Number(v) === Number(actual));
          if (!ok) return { matched: false, reason: `${key}=${actual} did not match NumericEquals` };
          break;
        }
        case "Bool":
        case "BoolIfExists": {
          if (actual === undefined) {
            if (operator === "Bool") return { matched: false, reason: `${key} missing for Bool` };
            break; // BoolIfExists: missing → satisfied
          }
          const ok = expected.some((v) => String(v).toLowerCase() === String(actual).toLowerCase());
          if (!ok) return { matched: false, reason: `${key}=${actual} did not match Bool` };
          break;
        }
        case "Null": {
          const wantNull = expected.some((v) => String(v) === "true");
          if (wantNull && actual !== undefined) return { matched: false, reason: `${key} expected null but is '${actual}'` };
          if (!wantNull && actual === undefined) return { matched: false, reason: `${key} expected not-null but is missing` };
          break;
        }
        default: {
          limitations.push(`Unknown condition operator '${operator}' for key '${key}' — skipped.`);
          break;
        }
      }
    }
  }
  return { matched: true, reason: "all conditions matched" };
}

function resolveContextValue(key: string, req: SimulationRequest): string | number | boolean | undefined {
  if (key.startsWith("aws:PrincipalTag/")) {
    const tag = key.substring("aws:PrincipalTag/".length);
    return req.principalTags?.[tag];
  }
  if (key.startsWith("aws:ResourceTag/")) {
    const tag = key.substring("aws:ResourceTag/".length);
    return req.resourceTags?.[tag];
  }
  if (key === "iam:PermissionsBoundary") {
    // Special-case: Null check. The actual presence is encoded into context.
    return req.context?.[key];
  }
  return req.context?.[key];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arr<T>(v: T | T[]): T[] { return Array.isArray(v) ? v : [v]; }

function globMatch(pattern: string, value: string): boolean {
  if (pattern === "*" || pattern === value) return true;
  // Convert AWS wildcard pattern to a regex (only * and ? supported per IAM spec).
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
    "i",
  );
  return re.test(value);
}
