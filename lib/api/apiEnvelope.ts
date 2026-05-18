/**
 * Canonical API response envelope.
 *
 * Every typed read-only HTTP response on the platform should ship inside
 * one of these envelopes. The envelope adds:
 *
 *   - `correlationId` so the client can join logs / audit / traces
 *   - `generatedAt` so the UI can render an honest "last sync" timestamp
 *   - `sourceMode` so the UI can render the right pill
 *   - `safetyContract` so the contract is literal in the response body
 *   - `redacted` flag whenever the payload was passed through
 *     `redactPayload`
 *
 * Both `apiOk` and `apiErr` build the same envelope shape so the client
 * can switch on `ok` and read `correlationId` either way.
 */

import { NextResponse } from "next/server";
import {
  toErrorDTO,
  type ErrorDTO,
} from "@/lib/api/dtoMappers";
import { AxiomError, httpStatusFor } from "@/lib/errors/axiomErrors";
import { CORRELATION_ID_HEADER } from "./correlation";
import type { ApiSafetyContract } from "./safetyContracts";
import type { ApiSourceMode } from "./sourceMode";

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

export interface ApiEnvelopeMeta {
  correlationId: string;
  generatedAt: string;
  sourceMode?: ApiSourceMode;
  safetyContract?: ApiSafetyContract;
  /** True when the payload passed through redaction. */
  redacted?: boolean;
}

export interface ApiEnvelopeSuccess<T> {
  ok: true;
  data: T;
  meta: ApiEnvelopeMeta;
}

export interface ApiEnvelopeFailure {
  ok: false;
  error: ErrorDTO;
  meta: ApiEnvelopeMeta;
}

export type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeFailure;

export interface ApiOkOptions {
  correlationId: string;
  sourceMode?: ApiSourceMode;
  safetyContract?: ApiSafetyContract;
  redacted?: boolean;
  /** HTTP status. Defaults to 200. */
  status?: number;
}

export interface ApiErrOptions {
  correlationId: string;
  sourceMode?: ApiSourceMode;
  safetyContract?: ApiSafetyContract;
  /** HTTP status. Defaults from the error category if omitted. */
  status?: number;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function apiOk<T>(data: T, opts: ApiOkOptions): NextResponse<ApiEnvelopeSuccess<T>> {
  const body: ApiEnvelopeSuccess<T> = {
    ok: true,
    data,
    meta: {
      correlationId: opts.correlationId,
      generatedAt: new Date().toISOString(),
      sourceMode: opts.sourceMode,
      safetyContract: opts.safetyContract,
      redacted: opts.redacted ?? false,
    },
  };
  const res = NextResponse.json(body, { status: opts.status ?? 200 });
  res.headers.set(CORRELATION_ID_HEADER, opts.correlationId);
  if (opts.safetyContract) res.headers.set("x-api-safety-contract", opts.safetyContract);
  if (opts.sourceMode) res.headers.set("x-api-source-mode", opts.sourceMode);
  return res;
}

export function apiErr(err: unknown, opts: ApiErrOptions): NextResponse<ApiEnvelopeFailure> {
  const axiomErr = err instanceof AxiomError ? err : normaliseError(err);
  const body: ApiEnvelopeFailure = {
    ok: false,
    error: toErrorDTO(axiomErr),
    meta: {
      correlationId: opts.correlationId,
      generatedAt: new Date().toISOString(),
      sourceMode: opts.sourceMode,
      safetyContract: opts.safetyContract,
    },
  };
  const res = NextResponse.json(body, { status: opts.status ?? httpStatusFor(axiomErr.category) });
  res.headers.set(CORRELATION_ID_HEADER, opts.correlationId);
  if (opts.safetyContract) res.headers.set("x-api-safety-contract", opts.safetyContract);
  if (opts.sourceMode) res.headers.set("x-api-source-mode", opts.sourceMode);
  return res;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normaliseError(err: unknown): AxiomError {
  if (err instanceof AxiomError) return err;
  const message = err instanceof Error ? err.message : "Unexpected internal error.";
  return new AxiomError({
    code: "internal.unexpected",
    category: "internal",
    userMessage: "Something went wrong. The request was not completed.",
    detail: message,
  });
}

