/**
 * Structured logger.
 *
 * The platform already has `lib/observability/events.ts` (legacy Phase 7 — a
 * narrow `console.info(JSON)` emitter for engine events). This module is the
 * canonical structured logger every new module should use:
 *
 *  - JSON output, never pretty-printed in production
 *  - redaction runs over every message + metadata before emit
 *  - tenant / correlation / module ids are always attached
 *  - severity-based filtering via LOG_LEVEL env
 *  - pluggable sink for tests + future OTel/datadog backing
 *
 * Why a new module rather than extending the legacy events.ts: the legacy
 * file ships a fixed `EventType` enum tied to engine flows. This is the
 * general-purpose logger every subsystem (security, reliability, governance,
 * copilot) needs. The two coexist intentionally.
 */

import { redact, redactDeep } from "@/lib/security/redaction";
import type { CorrelationId, OrganizationId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };

function currentMinLevel(): LogLevel {
  const env = (typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined)?.toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error" || env === "critical") return env;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

export interface LogContext {
  organizationId?: OrganizationId;
  userId?: string;
  correlationId?: CorrelationId;
  module: string;
  operation?: string;
  /** Optional event id when this log corresponds to a typed AxiomEvent. */
  eventId?: string;
  errorCode?: string;
}

export interface LogRecord {
  ts: string;
  level: LogLevel;
  module: string;
  operation?: string;
  message: string;
  organizationId?: OrganizationId;
  userId?: string;
  correlationId?: CorrelationId;
  eventId?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Sink — pluggable so tests + future backends can replace stdout
// ---------------------------------------------------------------------------

export type LogSink = (record: LogRecord) => void;

const defaultSink: LogSink = (record) => {
  const line = JSON.stringify(record);
  if (record.level === "error" || record.level === "critical") {
    console.error(line);
  } else if (record.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
};

let _sink: LogSink = defaultSink;
export function configureLogSink(sink: LogSink | null): void { _sink = sink ?? defaultSink; }

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

function emit(level: LogLevel, ctx: LogContext, message: string, metadata?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentMinLevel()]) return;
  const record: LogRecord = {
    ts: new Date().toISOString(),
    level,
    module: ctx.module,
    operation: ctx.operation,
    message: redact(message),
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    correlationId: ctx.correlationId,
    eventId: ctx.eventId,
    errorCode: ctx.errorCode,
    metadata: metadata ? (redactDeep(metadata) as Record<string, unknown>) : undefined,
  };
  try {
    _sink(record);
  } catch {
    // Never let a broken sink crash a caller.
  }
}

// ---------------------------------------------------------------------------
// Module-scoped logger — the typical entry point
// ---------------------------------------------------------------------------

export interface ModuleLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  critical(message: string, metadata?: Record<string, unknown>): void;
  /** Return a child logger with extra context (correlation / operation / tenant). */
  with(extra: Partial<LogContext>): ModuleLogger;
}

export function createLogger(module: string, base: Partial<LogContext> = {}): ModuleLogger {
  const ctx: LogContext = { module, ...base };
  const log = (level: LogLevel) => (msg: string, meta?: Record<string, unknown>) => emit(level, ctx, msg, meta);
  return {
    debug:    log("debug"),
    info:     log("info"),
    warn:     log("warn"),
    error:    log("error"),
    critical: log("critical"),
    with(extra) {
      return createLogger(module, { ...ctx, ...extra });
    },
  };
}
