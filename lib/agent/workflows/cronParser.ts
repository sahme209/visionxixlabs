/**
 * Minimal cron parser + next-fire calculator.
 *
 * Handles the common cron-string shapes Axiom workflows actually use today.
 * Not a full RFC-5545 implementation — when the user writes something
 * exotic, the function returns `null` and the caller falls back to
 * "approximate next run". Honest: we expand support as real workflows
 * need it, rather than pretending to handle every cron grammar.
 *
 * Supported fields (m h dom mon dow):
 *  - "*"            → any
 *  - "N"            → exact value
 *  - "* /N"          → step (every N, starting at field min) [space added to keep TS happy in comment]
 *  - "A,B,C"        → comma list
 *  - "A-B"          → inclusive range
 *  - day-of-week as 0-6 (Sun-Sat) or 7 (also Sun for cron compatibility)
 */

export interface CronExpression {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Parse a 5-field cron string. Returns null if the string can't be parsed
 * with the supported grammar. Pure function — no IO.
 */
export function parseCron(input: string): CronExpression | null {
  if (typeof input !== "string") return null;
  const fields = input.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  try {
    const minute     = parseField(fields[0], 0, 59);
    const hour       = parseField(fields[1], 0, 23);
    const dayOfMonth = parseField(fields[2], 1, 31);
    const month      = parseField(fields[3], 1, 12);
    const dayOfWeek  = parseField(fields[4], 0, 7).map((d) => (d === 7 ? 0 : d));
    return { minute, hour, dayOfMonth, month, dayOfWeek };
  } catch {
    return null;
  }
}

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const piece of field.split(",")) {
    if (piece === "*") {
      for (let v = min; v <= max; v++) values.add(v);
      continue;
    }
    const stepMatch = piece.match(/^(\*|\d+|\d+-\d+)\/(\d+)$/);
    if (stepMatch) {
      const range = stepMatch[1];
      const step = parseInt(stepMatch[2], 10);
      if (!Number.isFinite(step) || step <= 0) throw new Error("invalid step");
      let lo = min;
      let hi = max;
      if (range !== "*") {
        if (range.includes("-")) {
          const [a, b] = range.split("-").map((n) => parseInt(n, 10));
          lo = a; hi = b;
        } else {
          lo = parseInt(range, 10);
        }
      }
      for (let v = lo; v <= hi; v += step) values.add(v);
      continue;
    }
    const rangeMatch = piece.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      if (!inRange(lo, min, max) || !inRange(hi, min, max) || lo > hi) throw new Error("invalid range");
      for (let v = lo; v <= hi; v++) values.add(v);
      continue;
    }
    const num = parseInt(piece, 10);
    if (Number.isFinite(num) && inRange(num, min, max)) {
      values.add(num);
      continue;
    }
    throw new Error(`invalid cron piece: ${piece}`);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

// ---------------------------------------------------------------------------
// Next-fire calculator
// ---------------------------------------------------------------------------

/**
 * Compute the next time after `from` that the cron expression fires.
 * Returns null when no firing exists within a 5-year horizon (e.g. impossible
 * `30 4 31 2 *`).
 */
export function nextFire(expression: CronExpression, from: Date = new Date()): Date | null {
  // Search forward minute-by-minute, capped to a 5-year horizon.
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  const horizon = new Date(from.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
  // Minute-by-minute is fine — 5-year cap means at most ~2.6M iterations
  // worst case, but in practice we exit within hours.
  while (candidate < horizon) {
    if (matches(candidate, expression)) return new Date(candidate.getTime());
    // Smart step: when month/day fails, skip forward by a day.
    if (!expression.month.includes(candidate.getUTCMonth() + 1)) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (
      !expression.dayOfMonth.includes(candidate.getUTCDate()) ||
      !expression.dayOfWeek.includes(candidate.getUTCDay())
    ) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!expression.hour.includes(candidate.getUTCHours())) {
      candidate.setUTCHours(candidate.getUTCHours() + 1, 0, 0, 0);
      continue;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}

function matches(d: Date, e: CronExpression): boolean {
  return (
    e.minute.includes(d.getUTCMinutes()) &&
    e.hour.includes(d.getUTCHours()) &&
    e.dayOfMonth.includes(d.getUTCDate()) &&
    e.month.includes(d.getUTCMonth() + 1) &&
    e.dayOfWeek.includes(d.getUTCDay())
  );
}

/**
 * Convenience: parse + compute next-fire in one call. Returns ISO string or
 * null when the cron string can't be parsed / has no firing in horizon.
 */
export function nextFireIso(cronString: string, from: Date = new Date()): string | null {
  const parsed = parseCron(cronString);
  if (!parsed) return null;
  const next = nextFire(parsed, from);
  return next ? next.toISOString() : null;
}

/**
 * Human-readable summary of a cron expression. Best-effort; falls back to
 * the raw cron string when the pattern is unfamiliar.
 */
export function describeCron(cronString: string): string {
  const parsed = parseCron(cronString);
  if (!parsed) return `Cron: ${cronString}`;
  // Common shapes
  if (cronString === "0 */6 * * *")  return "Every 6 hours";
  if (cronString === "0 */12 * * *") return "Every 12 hours";
  if (cronString === "0 0 * * *")    return "Daily at 00:00 UTC";
  if (cronString === "0 9 * * 1")    return "Weekly · Monday 09:00 UTC";
  if (cronString === "*/15 * * * *") return "Every 15 minutes";
  if (cronString === "*/5 * * * *")  return "Every 5 minutes";
  // Fall through
  return `Cron: ${cronString}`;
}
