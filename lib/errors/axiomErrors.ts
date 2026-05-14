/**
 * Canonical Axiom error model.
 *
 * Every layer of the platform — connectors, workflows, execution, policy —
 * raises typed errors that share a uniform shape: a stable `code`, an
 * actionable `userMessage`, a developer-facing `detail`, optional `cause`,
 * and structured `context` for logs/audit.
 *
 * Why a hand-rolled error vs `throw new Error(...)`: stable codes give the
 * UI and audit log something to switch on without parsing strings, and the
 * `userMessage / detail` split avoids leaking stack traces or PII to users.
 */

export type AxiomErrorCategory =
  | "validation"          // Input didn't pass schema/precondition checks
  | "authentication"      // Caller couldn't be identified
  | "authorization"       // Caller identified but lacking permission
  | "tenancy"             // Cross-tenant access attempt
  | "not_found"           // Referenced entity doesn't exist
  | "conflict"            // Optimistic concurrency / duplicate / state collision
  | "precondition"        // State machine guard tripped (e.g. invalid lifecycle move)
  | "policy"              // Governance rule blocked the action
  | "external"            // External provider/API failure
  | "timeout"             // Operation exceeded its budget
  | "rate_limited"        // Caller (or downstream) is being throttled
  | "internal";           // Unexpected — bug

export interface AxiomErrorContext {
  [key: string]: string | number | boolean | undefined;
}

export interface AxiomErrorShape {
  /** Stable, machine-readable code, e.g. `connector.invalid_credentials`. */
  code: string;
  category: AxiomErrorCategory;
  /** Safe to show users — no stack traces, no PII. */
  userMessage: string;
  /** Developer-facing detail — appears in logs and audit. */
  detail?: string;
  context?: AxiomErrorContext;
  /** Underlying error if this wraps another. */
  cause?: unknown;
}

export class AxiomError extends Error implements AxiomErrorShape {
  readonly code: string;
  readonly category: AxiomErrorCategory;
  readonly userMessage: string;
  readonly detail?: string;
  readonly context?: AxiomErrorContext;
  readonly cause?: unknown;

  constructor(shape: AxiomErrorShape) {
    super(shape.detail ?? shape.userMessage);
    this.name = "AxiomError";
    this.code = shape.code;
    this.category = shape.category;
    this.userMessage = shape.userMessage;
    this.detail = shape.detail;
    this.context = shape.context;
    this.cause = shape.cause;
  }

  /** Serialize for transport (API responses, audit log). Never includes `cause`. */
  toJSON(): Omit<AxiomErrorShape, "cause"> {
    return {
      code: this.code,
      category: this.category,
      userMessage: this.userMessage,
      detail: this.detail,
      context: this.context,
    };
  }
}

/** Convenience builders for the categories used most across the codebase. */
export const AxiomErrors = {
  validation(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "validation", userMessage, context });
  },
  notFound(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "not_found", userMessage, context });
  },
  tenancy(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "tenancy", userMessage, context });
  },
  precondition(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "precondition", userMessage, context });
  },
  policy(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "policy", userMessage, context });
  },
  external(code: string, userMessage: string, cause?: unknown, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "external", userMessage, cause, context });
  },
  timeout(code: string, userMessage: string, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({ code, category: "timeout", userMessage, context });
  },
  internal(code: string, detail: string, cause?: unknown, context?: AxiomErrorContext): AxiomError {
    return new AxiomError({
      code,
      category: "internal",
      userMessage: "Something went wrong. The team has been notified.",
      detail,
      cause,
      context,
    });
  },
} as const;

/** Type-guard for catch blocks. */
export function isAxiomError(e: unknown): e is AxiomError {
  return e instanceof AxiomError;
}

/** Wrap an unknown thrown value into an internal AxiomError. */
export function toAxiomError(e: unknown, fallbackCode = "internal.unknown"): AxiomError {
  if (isAxiomError(e)) return e;
  if (e instanceof Error) {
    return AxiomErrors.internal(fallbackCode, e.message, e);
  }
  return AxiomErrors.internal(fallbackCode, String(e), e);
}

/**
 * Map an AxiomErrorCategory to an HTTP status. Used by API route handlers
 * so they don't redefine the mapping individually.
 */
export function httpStatusFor(category: AxiomErrorCategory): number {
  switch (category) {
    case "validation":     return 400;
    case "authentication": return 401;
    case "authorization":  return 403;
    case "tenancy":        return 403;
    case "not_found":      return 404;
    case "conflict":       return 409;
    case "precondition":   return 412;
    case "policy":         return 422;
    case "external":       return 502;
    case "timeout":        return 504;
    case "rate_limited":   return 429;
    case "internal":       return 500;
  }
}
